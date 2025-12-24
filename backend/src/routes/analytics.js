import express from 'express';
import db from '../database/db.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Get freelancer performance report (weekly/monthly)
router.get('/freelancer-report', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { period = 'monthly', freelancerId } = req.query;
    
    // Calculate date range based on period (PostgreSQL compatible)
    let dateFilter;
    if (period === 'weekly') {
      dateFilter = "i.created_at >= NOW() - INTERVAL '7 days'";
    } else if (period === 'monthly') {
      dateFilter = "i.created_at >= NOW() - INTERVAL '30 days'";
    } else if (period === 'all') {
      dateFilter = "1=1";
    } else {
      dateFilter = "i.created_at >= NOW() - INTERVAL '30 days'";
    }

    let query;
    let params = [];

    if (freelancerId) {
      // Report for specific freelancer
      query = `
        SELECT 
          u.id as freelancer_id,
          u.username,
          u.email,
          COUNT(i.id) as total_templates,
          SUM(CASE WHEN i.status = 'published' THEN 1 ELSE 0 END) as published,
          SUM(CASE WHEN i.status = 'reviewed' THEN 1 ELSE 0 END) as reviewed,
          SUM(CASE WHEN i.status = 'submitted' THEN 1 ELSE 0 END) as submitted,
          SUM(CASE WHEN i.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN i.status = 'needs_fixes' THEN 1 ELSE 0 END) as needs_fixes,
          SUM(CASE WHEN i.status = 'assigned' THEN 1 ELSE 0 END) as assigned,
          COALESCE(SUM(i.price), 0) as total_earnings,
          COALESCE(SUM(CASE WHEN i.status = 'published' OR i.status = 'reviewed' THEN i.price ELSE 0 END), 0) as completed_earnings
        FROM users u
        LEFT JOIN ideas i ON u.id = i.assigned_to AND ${dateFilter}
        WHERE u.id = $1 AND u.role = 'freelancer'
        GROUP BY u.id, u.username, u.email
      `;
      params = [freelancerId];
    } else {
      // Report for all freelancers
      query = `
        SELECT 
          u.id as freelancer_id,
          u.username,
          u.email,
          COUNT(i.id) as total_templates,
          SUM(CASE WHEN i.status = 'published' THEN 1 ELSE 0 END) as published,
          SUM(CASE WHEN i.status = 'reviewed' THEN 1 ELSE 0 END) as reviewed,
          SUM(CASE WHEN i.status = 'submitted' THEN 1 ELSE 0 END) as submitted,
          SUM(CASE WHEN i.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN i.status = 'needs_fixes' THEN 1 ELSE 0 END) as needs_fixes,
          SUM(CASE WHEN i.status = 'assigned' THEN 1 ELSE 0 END) as assigned,
          COALESCE(SUM(i.price), 0) as total_earnings,
          COALESCE(SUM(CASE WHEN i.status = 'published' OR i.status = 'reviewed' THEN i.price ELSE 0 END), 0) as completed_earnings
        FROM users u
        LEFT JOIN ideas i ON u.id = i.assigned_to AND ${dateFilter}
        WHERE u.role = 'freelancer'
        GROUP BY u.id, u.username, u.email
        ORDER BY total_templates DESC
      `;
    }

    const reports = await db.prepare(query).all(...params);
    
    res.json({
      period,
      reports,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Freelancer report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get template creation rate over time (for graphs)
router.get('/creation-rate', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;
    
    let dateFilter;
    let dateFormat;
    let groupFormat;
    
    // PostgreSQL date formatting
    if (period === 'weekly') {
      dateFilter = "created_at >= NOW() - INTERVAL '7 days'";
      dateFormat = 'YYYY-MM-DD'; // Group by day
      groupFormat = "TO_CHAR(created_at, 'YYYY-MM-DD')";
    } else if (period === 'monthly') {
      dateFilter = "created_at >= NOW() - INTERVAL '30 days'";
      dateFormat = 'YYYY-MM-DD'; // Group by day
      groupFormat = "TO_CHAR(created_at, 'YYYY-MM-DD')";
    } else if (period === 'quarterly') {
      dateFilter = "created_at >= NOW() - INTERVAL '90 days'";
      dateFormat = 'IYYY-IW'; // Group by ISO week
      groupFormat = "TO_CHAR(created_at, 'IYYY-IW')";
    } else if (period === 'yearly') {
      dateFilter = "created_at >= NOW() - INTERVAL '365 days'";
      dateFormat = 'YYYY-MM'; // Group by month
      groupFormat = "TO_CHAR(created_at, 'YYYY-MM')";
    } else {
      dateFilter = "created_at >= NOW() - INTERVAL '30 days'";
      dateFormat = 'YYYY-MM-DD';
      groupFormat = "TO_CHAR(created_at, 'YYYY-MM-DD')";
    }

    // Templates created over time
    const creationData = await db.prepare(`
      SELECT 
        ${groupFormat} as date,
        COUNT(*) as created,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published
      FROM ideas
      WHERE ${dateFilter}
      GROUP BY ${groupFormat}
      ORDER BY date ASC
    `).all();

    // Status distribution
    const statusDistribution = await db.prepare(`
      SELECT 
        status,
        COUNT(*) as count
      FROM ideas
      WHERE ${dateFilter}
      GROUP BY status
      ORDER BY count DESC
    `).all();

    // Top performing freelancers
    const topFreelancers = await db.prepare(`
      SELECT 
        u.username,
        COUNT(i.id) as templates_count,
        SUM(CASE WHEN i.status = 'published' THEN 1 ELSE 0 END) as published_count
      FROM users u
      INNER JOIN ideas i ON u.id = i.assigned_to
      WHERE u.role = 'freelancer' AND i.created_at >= NOW() - INTERVAL '${period === 'weekly' ? '7' : period === 'quarterly' ? '90' : period === 'yearly' ? '365' : '30'} days'
      GROUP BY u.id, u.username
      ORDER BY templates_count DESC
      LIMIT 10
    `).all();

    res.json({
      period,
      creation_over_time: creationData,
      status_distribution: statusDistribution,
      top_freelancers: topFreelancers,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Creation rate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get overall summary statistics
router.get('/summary', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    // Overall stats
    const overall = await db.prepare(`
      SELECT 
        COUNT(*) as total_templates,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN status = 'reviewed' THEN 1 ELSE 0 END) as reviewed,
        SUM(CASE WHEN status IN ('assigned', 'in_progress', 'submitted', 'needs_fixes') THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_templates,
        COALESCE(SUM(price), 0) as total_value
      FROM ideas
    `).get();

    // This month stats (PostgreSQL compatible)
    const thisMonth = await db.prepare(`
      SELECT 
        COUNT(*) as created,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published
      FROM ideas
      WHERE created_at >= DATE_TRUNC('month', NOW())
    `).get();

    // Last month stats (PostgreSQL compatible)
    const lastMonth = await db.prepare(`
      SELECT 
        COUNT(*) as created,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published
      FROM ideas
      WHERE created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '1 month'
        AND created_at < DATE_TRUNC('month', NOW())
    `).get();

    // Active freelancers count
    const activeFreelancers = await db.prepare(`
      SELECT COUNT(DISTINCT assigned_to) as count
      FROM ideas
      WHERE assigned_to IS NOT NULL
        AND created_at >= NOW() - INTERVAL '30 days'
    `).get();

    // Total freelancers
    const totalFreelancers = await db.prepare(`
      SELECT COUNT(*) as count
      FROM users
      WHERE role = 'freelancer'
    `).get();

    res.json({
      overall,
      this_month: thisMonth,
      last_month: lastMonth,
      active_freelancers: activeFreelancers?.count || 0,
      total_freelancers: totalFreelancers?.count || 0,
      month_over_month_growth: lastMonth?.created > 0 
        ? ((thisMonth?.created - lastMonth?.created) / lastMonth?.created * 100).toFixed(1)
        : 0,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get department analytics
router.get('/departments', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const departmentStats = await db.prepare(`
      SELECT 
        d.name as department,
        COUNT(DISTINCT i.id) as template_count,
        SUM(CASE WHEN i.status = 'published' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN i.status IN ('assigned', 'in_progress', 'submitted', 'needs_fixes', 'reviewed') THEN 1 ELSE 0 END) as in_progress
      FROM departments d
      LEFT JOIN idea_departments id ON d.id = id.department_id
      LEFT JOIN ideas i ON id.idea_id = i.id
      GROUP BY d.id, d.name
      ORDER BY template_count DESC
    `).all();

    res.json({
      departments: departmentStats,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Department analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
