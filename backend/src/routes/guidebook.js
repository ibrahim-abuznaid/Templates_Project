import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { getPool } from '../database/db.js';

const router = express.Router();

// Get pool instance
const pool = getPool();

// Admin authorization middleware
const requireAdmin = authorizeRoles('admin');

// Default guidebook sections (used for initial seed)
const DEFAULT_SECTIONS = [
  {
    slug: 'flow-builder-rules',
    title: 'Flow — Builder Rules & Best Practices',
    icon: 'Workflow',
    display_order: 1,
    content: `### Minimize HTTP & Code
Use native ActivePieces actions wherever possible. Only add HTTP or Code steps if a native action is unavailable or cannot perform the required transformation.

### AI Steps
Use ActivePieces native AI steps. Common pieces:
- **Ask AI** for general generation tasks.
- **Extract Structured Data** for parsing and pulling values you need later.

Give each AI step a clear, meaningful name that describes intent (e.g., \`Extract Invoice Details\`, \`Summarize Notes\`).

Test multiple prompts and models to verify consistent, high-quality outputs.

### Naming Conventions
- **Steps:** \`Verb — Object\` e.g., \`Create — Invoice\`, \`Extract — Contact Email\`
- **Variables:** \`SNAKE_CASE\` or \`camelCase\` but be consistent across the flow

### Placeholders & Credentials
- NEVER include real API keys or example credentials
- Use clearly signposted placeholders: \`{{YOUR_STRIPE_API_KEY}}\`
- For IDs or account-specific values, add a note in the ScribeHow describing where to find them

### Outputs and Artifacts
Make sure that the final output/action is as expected`,
    checklist_items: null,
  },
  {
    slug: 'summary-writing',
    title: 'Summary — How to Write It',
    icon: 'FileText',
    display_order: 2,
    content: `The summary is the first thing users see about your template. Make it count!

### Guidelines
- Keep to **1–2 sentences** maximum
- Focus on **business benefit**, not technical detail
- Start with an **action verb**: "Automatically creates…", "Saves X hours…", etc.

### Good Examples
✅ "Automatically creates invoices in QuickBooks when new orders arrive in Shopify, saving 3+ hours weekly."

✅ "Syncs customer data between HubSpot and Mailchimp in real-time, eliminating manual data entry."

### Bad Examples
❌ "This template uses webhooks to connect two apps and transform data using JavaScript." (Too technical)

❌ "A useful automation for businesses." (Too vague)`,
    checklist_items: null,
  },
  {
    slug: 'description-writing',
    title: 'Description — How to Write It',
    icon: 'AlignLeft',
    display_order: 3,
    content: `The description expands on the summary and helps users understand the full value.

### Guidelines
- Aim for **5–6 sentences**
- Explain **what it does**, **who benefits**, and highlight **one or two real benefits**
- Keep setup specifics out — put them in Setup/Requirements

### Structure Your Description
1. **What:** Explain the automation's purpose
2. **Who:** Identify the target audience
3. **Why:** Highlight the key benefits
4. **How:** Brief mention of the flow (without technical jargon)

### Example
"This template automatically creates new contacts in your CRM whenever someone fills out a form on your website. Perfect for sales teams and marketers who want to capture leads instantly without manual data entry. Say goodbye to copy-pasting contact information and reduce response time to new leads. The automation triggers immediately when a form is submitted, creating a complete contact record with all captured fields."`,
    checklist_items: null,
  },
  {
    slug: 'time-cost-estimation',
    title: 'Time & Cost Saving — How to Estimate',
    icon: 'Clock',
    display_order: 4,
    content: `Accurate time and cost estimates help users understand the real value of your template.

### Time Saved Per Week
Think about:
- How long does this task take manually?
- How often is it performed?
- What's the typical time saved?

**Format:** Use clear units like "2 hours", "30 minutes", "5 hours"

### Cost Per Year
Calculate based on:
- Time saved × hourly rate (use $25-50/hr for general tasks)
- Or specific tool costs avoided
- Annual subscription savings

**Format:** Use currency like "$2,400/year", "$500/year"

### Quick Reference
| Manual Time | Frequency | Weekly Save | Annual Cost Save |
|-------------|-----------|-------------|------------------|
| 15 min | 4x/day | 5 hours | $6,500 |
| 30 min | 1x/day | 2.5 hours | $3,250 |
| 1 hour | 1x/week | 1 hour | $1,300 |`,
    checklist_items: null,
  },
  {
    slug: 'testing-qa',
    title: 'Testing & QA Checklist',
    icon: 'CheckSquare',
    display_order: 5,
    content: `Before submitting your template, run through this comprehensive QA checklist to ensure quality.

### Pre-Submission Requirements
Complete ALL items below before marking your template as submitted.`,
    checklist_items: JSON.stringify([
      'Run the flow with the ActivePieces test flow feature',
      'Run full end-to-end tests with real data (or realistic dummy data)',
      'Verify AI outputs for hallucinations or unstable formats',
      'Confirm no real credentials are included in the template or screenshots',
      'Confirm idempotency behavior (re-run the same data)',
      'Confirm final outputs are logged and returned to the user',
    ]),
  },
  {
    slug: 'scribehow-guide',
    title: 'ScribeHow / Guide Me Instructions',
    icon: 'BookOpen',
    display_order: 6,
    content: `ScribeHow guides help users set up templates step-by-step. Follow these instructions to create effective guides.

### 1. Record the Setup
- Open ScribeHow and click **Start Capture**
- Walk through: importing the template, connecting accounts, and the first test run

### 2. Edit the Capture
- Remove any irrelevant steps or duplicate screenshots
- Add clarifying text where a non-technical user might be confused

### 3. Add ROI / Time-saving Tip
- Click the plus button at the top of the guide
- Add a tip that states the Time & Cost Saving
- Follow this guide: [ScribeHow Documentation](https://docs.google.com/document/d/1EINRto7gSlUnjx7clFYi2ylMiVGwWNrPs8thzuiMRn4/edit?tab=t.0)

### 4. Add Requirements Steps
- Insert steps showing exactly where to find API keys, sheet IDs, or account IDs
- Use redaction if you must copy a real value during recording
- Replace with a placeholder before publishing

### 5. Finalize the Guide
- Make sure the instructions are simple and actionable for non-technical users
- Set the "Guide Me" link in the template listing so users can click and be taken to the ScribeHow`,
    checklist_items: JSON.stringify([
      'Guide includes Time & Cost Saving tip',
      'All requirement steps are present and clear',
      'No real credentials are published',
      'Guide Me link works and opens the correct template',
    ]),
  },
];

// Seed default sections if none exist
async function seedDefaultSections() {
  const result = await pool.query('SELECT COUNT(*) as count FROM guidebook_sections');
  const count = parseInt(result.rows[0].count);
  
  if (count === 0) {
    console.log('📚 Seeding default guidebook sections...');
    for (const section of DEFAULT_SECTIONS) {
      await pool.query(
        `INSERT INTO guidebook_sections (slug, title, icon, content, checklist_items, display_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [section.slug, section.title, section.icon, section.content, section.checklist_items, section.display_order, true]
      );
    }
    console.log('✅ Default guidebook sections seeded');
  }
}

// GET /api/guidebook - Get all active sections (public to authenticated users)
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Ensure table exists and seed if needed
    await pool.query(`
      CREATE TABLE IF NOT EXISTS guidebook_sections (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(100) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        icon VARCHAR(50),
        content TEXT NOT NULL,
        checklist_items TEXT,
        display_order INTEGER DEFAULT 999,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await seedDefaultSections();
    
    const includeInactive = req.query.includeInactive === 'true' && req.user.role === 'admin';
    
    let query = 'SELECT * FROM guidebook_sections';
    if (!includeInactive) {
      query += ' WHERE is_active = true';
    }
    query += ' ORDER BY display_order ASC, id ASC';
    
    const result = await pool.query(query);
    
    // Parse checklist_items JSON for each section
    const sections = result.rows.map(section => ({
      ...section,
      checklist_items: section.checklist_items ? JSON.parse(section.checklist_items) : null,
    }));
    
    res.json(sections);
  } catch (error) {
    console.error('Error fetching guidebook sections:', error);
    res.status(500).json({ error: 'Failed to fetch guidebook sections' });
  }
});

// GET /api/guidebook/:slug - Get a specific section
router.get('/:slug', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM guidebook_sections WHERE slug = $1',
      [slug]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Section not found' });
    }
    
    const section = result.rows[0];
    section.checklist_items = section.checklist_items ? JSON.parse(section.checklist_items) : null;
    
    res.json(section);
  } catch (error) {
    console.error('Error fetching guidebook section:', error);
    res.status(500).json({ error: 'Failed to fetch guidebook section' });
  }
});

// POST /api/guidebook - Create a new section (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { slug, title, icon, content, checklist_items, display_order, is_active } = req.body;
    
    if (!slug || !title || !content) {
      return res.status(400).json({ error: 'slug, title, and content are required' });
    }
    
    // Check if slug already exists
    const existing = await pool.query('SELECT id FROM guidebook_sections WHERE slug = $1', [slug]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'A section with this slug already exists' });
    }
    
    const result = await pool.query(
      `INSERT INTO guidebook_sections (slug, title, icon, content, checklist_items, display_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        slug,
        title,
        icon || null,
        content,
        checklist_items ? JSON.stringify(checklist_items) : null,
        display_order || 999,
        is_active !== false,
      ]
    );
    
    const section = result.rows[0];
    section.checklist_items = section.checklist_items ? JSON.parse(section.checklist_items) : null;
    
    res.status(201).json(section);
  } catch (error) {
    console.error('Error creating guidebook section:', error);
    res.status(500).json({ error: 'Failed to create guidebook section' });
  }
});

// PUT /api/guidebook/:id - Update a section (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { slug, title, icon, content, checklist_items, display_order, is_active } = req.body;
    
    // Check if section exists
    const existing = await pool.query('SELECT * FROM guidebook_sections WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Section not found' });
    }
    
    // Check slug uniqueness if changing
    if (slug && slug !== existing.rows[0].slug) {
      const slugCheck = await pool.query('SELECT id FROM guidebook_sections WHERE slug = $1 AND id != $2', [slug, id]);
      if (slugCheck.rows.length > 0) {
        return res.status(400).json({ error: 'A section with this slug already exists' });
      }
    }
    
    const result = await pool.query(
      `UPDATE guidebook_sections 
       SET slug = COALESCE($1, slug),
           title = COALESCE($2, title),
           icon = COALESCE($3, icon),
           content = COALESCE($4, content),
           checklist_items = $5,
           display_order = COALESCE($6, display_order),
           is_active = COALESCE($7, is_active),
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        slug,
        title,
        icon,
        content,
        checklist_items !== undefined ? (checklist_items ? JSON.stringify(checklist_items) : null) : existing.rows[0].checklist_items,
        display_order,
        is_active,
        id,
      ]
    );
    
    const section = result.rows[0];
    section.checklist_items = section.checklist_items ? JSON.parse(section.checklist_items) : null;
    
    res.json(section);
  } catch (error) {
    console.error('Error updating guidebook section:', error);
    res.status(500).json({ error: 'Failed to update guidebook section' });
  }
});

// DELETE /api/guidebook/:id - Delete a section (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM guidebook_sections WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Section not found' });
    }
    
    res.json({ message: 'Section deleted successfully', section: result.rows[0] });
  } catch (error) {
    console.error('Error deleting guidebook section:', error);
    res.status(500).json({ error: 'Failed to delete guidebook section' });
  }
});

// PUT /api/guidebook/reorder - Reorder sections (admin only)
router.put('/reorder/sections', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { order } = req.body; // Array of { id, display_order }
    
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'order must be an array' });
    }
    
    for (const item of order) {
      await pool.query(
        'UPDATE guidebook_sections SET display_order = $1, updated_at = NOW() WHERE id = $2',
        [item.display_order, item.id]
      );
    }
    
    const result = await pool.query('SELECT * FROM guidebook_sections ORDER BY display_order ASC, id ASC');
    const sections = result.rows.map(section => ({
      ...section,
      checklist_items: section.checklist_items ? JSON.parse(section.checklist_items) : null,
    }));
    
    res.json(sections);
  } catch (error) {
    console.error('Error reordering guidebook sections:', error);
    res.status(500).json({ error: 'Failed to reorder guidebook sections' });
  }
});

// POST /api/guidebook/reset - Reset to default sections (admin only)
router.post('/reset/defaults', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Delete all existing sections
    await pool.query('DELETE FROM guidebook_sections');
    
    // Re-seed defaults
    for (const section of DEFAULT_SECTIONS) {
      await pool.query(
        `INSERT INTO guidebook_sections (slug, title, icon, content, checklist_items, display_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [section.slug, section.title, section.icon, section.content, section.checklist_items, section.display_order, true]
      );
    }
    
    const result = await pool.query('SELECT * FROM guidebook_sections ORDER BY display_order ASC');
    const sections = result.rows.map(section => ({
      ...section,
      checklist_items: section.checklist_items ? JSON.parse(section.checklist_items) : null,
    }));
    
    res.json({ message: 'Guidebook reset to defaults', sections });
  } catch (error) {
    console.error('Error resetting guidebook:', error);
    res.status(500).json({ error: 'Failed to reset guidebook' });
  }
});

export default router;

