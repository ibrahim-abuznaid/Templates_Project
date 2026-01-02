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

// Get published templates with missing required fields
router.get('/incomplete-published', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    // Required fields for published templates (template_url is optional)
    const incompleteTemplates = await db.prepare(`
      SELECT 
        id,
        flow_name,
        summary,
        description,
        time_save_per_week,
        cost_per_year,
        author,
        scribe_url,
        template_url,
        flow_json,
        status,
        created_at,
        updated_at
      FROM ideas
      WHERE status = 'published'
        AND (
          flow_name IS NULL OR flow_name = '' OR
          summary IS NULL OR summary = '' OR
          description IS NULL OR description = '' OR
          time_save_per_week IS NULL OR time_save_per_week = '' OR
          cost_per_year IS NULL OR cost_per_year = '' OR
          author IS NULL OR author = '' OR
          scribe_url IS NULL OR scribe_url = '' OR
          flow_json IS NULL OR flow_json = ''
        )
      ORDER BY updated_at DESC
    `).all();

    // Add missing fields info to each template
    const templatesWithMissingFields = incompleteTemplates.map(template => {
      const missingFields = [];
      if (!template.flow_name) missingFields.push('Flow Name');
      if (!template.summary) missingFields.push('Summary');
      if (!template.description) missingFields.push('Description');
      if (!template.time_save_per_week) missingFields.push('Time Save/Week');
      if (!template.cost_per_year) missingFields.push('Cost/Year');
      if (!template.author) missingFields.push('Author');
      if (!template.scribe_url) missingFields.push('Article/Blog URL');
      if (!template.flow_json) missingFields.push('Flow JSON');
      
      return {
        ...template,
        missing_fields: missingFields,
        missing_count: missingFields.length
      };
    });

    res.json({
      count: templatesWithMissingFields.length,
      templates: templatesWithMissingFields,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Incomplete published templates error:', error);
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

// Get maintenance data (stale templates, orphans, duplicates, etc.)
router.get('/maintenance', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    // 1. Stale assigned templates (assigned but not updated for 14+ days)
    const staleAssigned = await db.prepare(`
      SELECT 
        i.id,
        i.flow_name,
        i.status,
        i.assigned_to,
        u.username as assigned_username,
        i.updated_at,
        EXTRACT(DAY FROM NOW() - i.updated_at)::integer as days_since_update
      FROM ideas i
      LEFT JOIN users u ON i.assigned_to = u.id
      WHERE i.assigned_to IS NOT NULL
        AND i.status NOT IN ('published', 'archived', 'new')
        AND i.updated_at < NOW() - INTERVAL '14 days'
      ORDER BY i.updated_at ASC
    `).all();

    // 2. Templates without departments
    const noDepartments = await db.prepare(`
      SELECT 
        i.id,
        i.flow_name,
        i.status,
        i.created_at
      FROM ideas i
      LEFT JOIN idea_departments id ON i.id = id.idea_id
      WHERE id.idea_id IS NULL
      ORDER BY i.created_at DESC
    `).all();

    // 3. Templates without flow_json (excluding new status)
    const noFlowJson = await db.prepare(`
      SELECT 
        id,
        flow_name,
        status,
        created_at
      FROM ideas
      WHERE (flow_json IS NULL OR flow_json = '')
        AND status NOT IN ('new', 'archived')
      ORDER BY created_at DESC
    `).all();

    // 4. Duplicate templates (same flow_name)
    const duplicates = await db.prepare(`
      SELECT 
        flow_name,
        COUNT(*) as count,
        json_agg(json_build_object('id', id, 'status', status, 'created_at', created_at) ORDER BY created_at DESC) as templates
      FROM ideas
      WHERE flow_name IS NOT NULL AND flow_name != ''
      GROUP BY flow_name
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `).all();

    res.json({
      stale_assigned: staleAssigned,
      no_departments: noDepartments,
      no_flow_json: noFlowJson,
      duplicates: duplicates.map(d => ({
        flow_name: d.flow_name,
        count: parseInt(d.count),
        templates: d.templates
      })),
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Maintenance data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
