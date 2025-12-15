import express from 'express';
import db from '../database/db.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Helper function to generate invoice number
const generateInvoiceNumber = () => {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `INV-${year}${month}-${random}`;
};

// Helper function to add invoice item when template is completed (async for PostgreSQL)
export const addInvoiceItem = async (freelancerId, ideaId, ideaTitle, amount) => {
  try {
    await db.prepare(`
      INSERT INTO invoice_items (freelancer_id, idea_id, idea_title, amount, completed_at, status)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 'pending')
    `).run(freelancerId, ideaId, ideaTitle, amount);
  } catch (error) {
    console.error('Error adding invoice item:', error);
  }
};

// Get all invoices (admin sees all, freelancers see their own)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT 
        inv.*,
        u.username as freelancer_name,
        u.email as freelancer_email,
        u.handle as freelancer_handle,
        (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = inv.id) as item_count
      FROM invoices inv
      JOIN users u ON inv.freelancer_id = u.id
    `;
    
    const params = [];
    
    if (req.user.role !== 'admin') {
      query += ' WHERE inv.freelancer_id = ?';
      params.push(req.user.id);
    }
    
    query += ' ORDER BY inv.created_at DESC';

    const invoices = await db.prepare(query).all(...params);
    res.json(invoices);
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get my invoices (freelancer-specific shortcut)
router.get('/my-invoices', authenticateToken, async (req, res) => {
  try {
    const invoices = await db.prepare(`
      SELECT 
        inv.*,
        (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = inv.id) as item_count
      FROM invoices inv
      WHERE inv.freelancer_id = ?
      ORDER BY inv.created_at DESC
    `).all(req.user.id);

    res.json(invoices);
  } catch (error) {
    console.error('Get my invoices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pending invoice items for all freelancers (admin only)
router.get('/pending', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const pendingByFreelancer = await db.prepare(`
      SELECT 
        u.id as freelancer_id,
        u.username as freelancer_name,
        u.email as freelancer_email,
        u.handle as freelancer_handle,
        COUNT(ii.id) as item_count,
        SUM(ii.amount) as total_amount,
        MIN(ii.completed_at) as period_start,
        MAX(ii.completed_at) as period_end
      FROM users u
      LEFT JOIN invoice_items ii ON u.id = ii.freelancer_id AND ii.status = 'pending'
      WHERE u.role = 'freelancer'
      GROUP BY u.id, u.username, u.email, u.handle
      HAVING COUNT(ii.id) > 0
      ORDER BY u.username
    `).all();

    res.json(pendingByFreelancer);
  } catch (error) {
    console.error('Get pending invoices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pending invoice items for specific freelancer
router.get('/pending/:freelancerId', authenticateToken, async (req, res) => {
  try {
    const { freelancerId } = req.params;
    
    if (req.user.role !== 'admin' && req.user.id !== parseInt(freelancerId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const items = await db.prepare(`
      SELECT 
        ii.*,
        i.use_case,
        i.flow_name,
        i.department
      FROM invoice_items ii
      JOIN ideas i ON ii.idea_id = i.id
      WHERE ii.freelancer_id = ? AND ii.status = 'pending'
      ORDER BY ii.completed_at DESC
    `).all(freelancerId);

    const summary = await db.prepare(`
      SELECT 
        COUNT(*) as item_count,
        SUM(amount) as total_amount,
        MIN(completed_at) as period_start,
        MAX(completed_at) as period_end
      FROM invoice_items
      WHERE freelancer_id = ? AND status = 'pending'
    `).get(freelancerId);

    res.json({
      items,
      summary: summary || { item_count: 0, total_amount: 0 }
    });
  } catch (error) {
    console.error('Get pending items error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate and pay invoice (admin only)
router.post('/generate/:freelancerId', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { freelancerId } = req.params;

    const freelancer = await db.prepare('SELECT * FROM users WHERE id = ? AND role = ?')
      .get(freelancerId, 'freelancer');

    if (!freelancer) {
      return res.status(404).json({ error: 'Freelancer not found' });
    }

    const items = await db.prepare(`
      SELECT 
        ii.*,
        i.use_case,
        i.flow_name,
        i.department
      FROM invoice_items ii
      JOIN ideas i ON ii.idea_id = i.id
      WHERE ii.freelancer_id = ? AND ii.status = 'pending'
      ORDER BY ii.completed_at ASC
    `).all(freelancerId);

    if (items.length === 0) {
      return res.status(400).json({ error: 'No pending items for this freelancer' });
    }

    const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.amount), 0);
    const periodStart = items[0].completed_at;
    const periodEnd = items[items.length - 1].completed_at;

    const invoiceNumber = generateInvoiceNumber();
    const invoiceResult = await db.prepare(`
      INSERT INTO invoices (
        freelancer_id, 
        invoice_number, 
        total_amount, 
        status, 
        period_start, 
        period_end,
        paid_at,
        paid_by
      )
      VALUES (?, ?, ?, 'paid', ?, ?, CURRENT_TIMESTAMP, ?)
    `).run(freelancerId, invoiceNumber, totalAmount, periodStart, periodEnd, req.user.id);

    const invoiceId = invoiceResult.lastInsertRowid;

    // Update each invoice item individually for PostgreSQL
    for (const item of items) {
      await db.prepare(`
        UPDATE invoice_items 
        SET invoice_id = ?, status = 'paid'
        WHERE id = ?
      `).run(invoiceId, item.id);
    }

    const csvData = generateCSV(freelancer, items, invoiceNumber, totalAmount, periodStart, periodEnd);
    const pdfHtml = generatePDFHtml(freelancer, items, invoiceNumber, totalAmount, periodStart, periodEnd);

    res.json({
      invoice: {
        id: invoiceId,
        invoice_number: invoiceNumber,
        total_amount: totalAmount,
        item_count: items.length,
        period_start: periodStart,
        period_end: periodEnd
      },
      csv: csvData,
      pdfHtml: pdfHtml,
      freelancer: {
        name: freelancer.username,
        email: freelancer.email
      }
    });
  } catch (error) {
    console.error('Generate invoice error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get invoice history (admin only)
router.get('/history', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { freelancerId, limit = 50 } = req.query;
    
    let query = `
      SELECT 
        inv.*,
        u.username as freelancer_name,
        u.email as freelancer_email,
        paid_by_user.username as paid_by_name
      FROM invoices inv
      JOIN users u ON inv.freelancer_id = u.id
      LEFT JOIN users paid_by_user ON inv.paid_by = paid_by_user.id
    `;
    
    const params = [];
    
    if (freelancerId) {
      query += ' WHERE inv.freelancer_id = ?';
      params.push(freelancerId);
    }
    
    query += ' ORDER BY inv.created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const invoices = await db.prepare(query).all(...params);
    res.json(invoices);
  } catch (error) {
    console.error('Get invoice history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get invoice details
router.get('/:invoiceId', authenticateToken, async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await db.prepare(`
      SELECT 
        inv.*,
        u.username as freelancer_name,
        u.email as freelancer_email,
        u.handle as freelancer_handle,
        paid_by_user.username as paid_by_name
      FROM invoices inv
      JOIN users u ON inv.freelancer_id = u.id
      LEFT JOIN users paid_by_user ON inv.paid_by = paid_by_user.id
      WHERE inv.id = ?
    `).get(invoiceId);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (req.user.role !== 'admin' && req.user.id !== invoice.freelancer_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const items = await db.prepare(`
      SELECT 
        ii.*,
        i.use_case,
        i.flow_name,
        i.department
      FROM invoice_items ii
      LEFT JOIN ideas i ON ii.idea_id = i.id
      WHERE ii.invoice_id = ?
      ORDER BY ii.completed_at ASC
    `).all(invoiceId);

    res.json({
      invoice,
      items
    });
  } catch (error) {
    console.error('Get invoice details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to generate CSV
function generateCSV(freelancer, items, invoiceNumber, totalAmount, periodStart, periodEnd) {
  let csv = 'Invoice Number,Freelancer,Email,Period Start,Period End,Total Amount\n';
  csv += `${invoiceNumber},${freelancer.username},${freelancer.email},${periodStart},${periodEnd},${totalAmount}\n\n`;
  csv += 'Item,Template Title,Department,Amount,Completed Date\n';
  
  items.forEach((item, index) => {
    const title = item.flow_name || item.use_case;
    csv += `${index + 1},"${title}",${item.department || 'N/A'},${item.amount},${item.completed_at}\n`;
  });
  
  csv += `\nTotal Items,${items.length}\n`;
  csv += `Total Amount,$${totalAmount}\n`;
  
  return csv;
}

// Helper function to generate PDF HTML
function generatePDFHtml(freelancer, items, invoiceNumber, totalAmount, periodStart, periodEnd) {
  const currentDate = new Date().toLocaleDateString();
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 40px; }
    .header h1 { color: #2563eb; margin: 0; font-size: 36px; }
    .header p { color: #666; margin: 5px 0; }
    .invoice-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .info-block { flex: 1; }
    .info-block h3 { margin: 0 0 10px 0; color: #333; }
    .info-block p { margin: 5px 0; color: #666; }
    .invoice-number { background: #f3f4f6; padding: 15px; text-align: center; margin: 20px 0; border-radius: 8px; }
    .invoice-number strong { color: #2563eb; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 30px 0; }
    th { background: #2563eb; color: white; padding: 12px; text-align: left; }
    td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
    tr:hover { background: #f9fafb; }
    .text-right { text-align: right; }
    .total-row { background: #f3f4f6; font-weight: bold; font-size: 18px; }
    .footer { margin-top: 50px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>INVOICE</h1>
    <p>Template Management System</p>
    <p>Generated on ${currentDate}</p>
  </div>

  <div class="invoice-number">
    <strong>Invoice Number: ${invoiceNumber}</strong>
  </div>

  <div class="invoice-info">
    <div class="info-block">
      <h3>Bill To:</h3>
      <p><strong>${freelancer.username}</strong></p>
      <p>${freelancer.email}</p>
      <p>@${freelancer.handle || 'N/A'}</p>
    </div>
    <div class="info-block" style="text-align: right;">
      <h3>Invoice Period:</h3>
      <p><strong>From:</strong> ${new Date(periodStart).toLocaleDateString()}</p>
      <p><strong>To:</strong> ${new Date(periodEnd).toLocaleDateString()}</p>
      <p><strong>Total Items:</strong> ${items.length}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Template</th>
        <th>Department</th>
        <th>Completed</th>
        <th class="text-right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${item.flow_name || item.use_case}</td>
          <td>${item.department || 'N/A'}</td>
          <td>${new Date(item.completed_at).toLocaleDateString()}</td>
          <td class="text-right">$${parseFloat(item.amount).toFixed(2)}</td>
        </tr>
      `).join('')}
      <tr class="total-row">
        <td colspan="4" class="text-right">TOTAL</td>
        <td class="text-right">$${totalAmount.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <p>Thank you for your work!</p>
    <p>This invoice has been paid and recorded in the system.</p>
  </div>
</body>
</html>
  `;
}

export default router;
