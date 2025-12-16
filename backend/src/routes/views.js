import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get department summary with template counts
router.get('/departments', authenticateToken, async (req, res) => {
  try {
    // Query using the new many-to-many relationship
    const departments = await db.prepare(`
      SELECT 
        d.id,
        d.name as department,
        d.description,
        d.display_order,
        COUNT(DISTINCT id.idea_id) as template_count,
        SUM(CASE WHEN i.status = 'published' THEN 1 ELSE 0 END) as published_count,
        SUM(CASE WHEN i.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
        SUM(CASE WHEN i.status = 'new' THEN 1 ELSE 0 END) as new_count,
        COALESCE(SUM(i.price), 0) as total_value,
        COALESCE(AVG(i.price), 0) as avg_price
      FROM departments d
      LEFT JOIN idea_departments id ON d.id = id.department_id
      LEFT JOIN ideas i ON id.idea_id = i.id
      GROUP BY d.id, d.name, d.description, d.display_order
      ORDER BY d.display_order, d.name
    `).all();
    
    res.json(departments);
  } catch (error) {
    console.error('Error fetching department summary:', error);
    res.status(500).json({ error: 'Failed to fetch department summary' });
  }
});

// Get templates for a specific department (by name)
router.get('/departments/:department/templates', authenticateToken, async (req, res) => {
  try {
    const { department } = req.params;
    
    // First, get the department ID from the name
    const dept = await db.prepare(`
      SELECT id FROM departments WHERE name = ?
    `).get(department);
    
    if (!dept) {
      return res.status(404).json({ error: 'Department not found' });
    }
    
    // Then get all templates in this department
    const templates = await db.prepare(`
      SELECT DISTINCT
        i.*,
        u1.username as created_by_name,
        u2.username as assigned_to_name
      FROM ideas i
      INNER JOIN idea_departments id ON i.id = id.idea_id
      LEFT JOIN users u1 ON i.created_by = u1.id
      LEFT JOIN users u2 ON i.assigned_to = u2.id
      WHERE id.department_id = ?
      ORDER BY i.created_at DESC
    `).all(dept.id);
    
    // Fetch departments for each template
    for (const template of templates) {
      const depts = await db.prepare(`
        SELECT d.id, d.name, d.description, d.display_order
        FROM departments d
        INNER JOIN idea_departments id ON d.id = id.department_id
        WHERE id.idea_id = ?
        ORDER BY d.display_order, d.name
      `).all(template.id);
      template.departments = depts;
    }
    
    res.json(templates);
  } catch (error) {
    console.error('Error fetching department templates:', error);
    res.status(500).json({ error: 'Failed to fetch department templates' });
  }
});

// Get department performance metrics
router.get('/departments/performance', authenticateToken, async (req, res) => {
  try {
    const performance = await db.prepare(`
      SELECT 
        department,
        COUNT(*) as total_templates,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived,
        SUM(CASE WHEN status IN ('new', 'assigned', 'in_progress', 'submitted', 'needs_fixes', 'reviewed') THEN 1 ELSE 0 END) as active,
        SUM(price) as total_value
      FROM ideas
      WHERE department IS NOT NULL AND department != ''
      GROUP BY department
      ORDER BY total_templates DESC
    `).all();
    
    res.json(performance);
  } catch (error) {
    console.error('Error fetching department performance:', error);
    res.status(500).json({ error: 'Failed to fetch department performance' });
  }
});

// Get status summary
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const statuses = await db.prepare(`
      SELECT status, COUNT(*) as count
      FROM ideas
      GROUP BY status
      ORDER BY count DESC
    `).all();
    
    res.json(statuses);
  } catch (error) {
    console.error('Error fetching status summary:', error);
    res.status(500).json({ error: 'Failed to fetch status summary' });
  }
});

// Get freelancer workload
router.get('/freelancers/workload', authenticateToken, async (req, res) => {
  try {
    const workload = await db.prepare(`
      SELECT 
        u.id as freelancer_id,
        u.username as freelancer_name,
        u.handle as freelancer_handle,
        COUNT(i.id) as total_assigned,
        SUM(CASE WHEN i.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN i.status = 'submitted' THEN 1 ELSE 0 END) as submitted,
        SUM(CASE WHEN i.status = 'needs_fixes' THEN 1 ELSE 0 END) as needs_fixes,
        SUM(CASE WHEN i.status = 'reviewed' THEN 1 ELSE 0 END) as reviewed,
        SUM(CASE WHEN i.status IN ('published', 'archived') THEN 1 ELSE 0 END) as completed
      FROM users u
      LEFT JOIN ideas i ON u.id = i.assigned_to
      WHERE u.role = 'freelancer'
      GROUP BY u.id, u.username, u.handle
      ORDER BY total_assigned DESC
    `).all();
    
    res.json(workload);
  } catch (error) {
    console.error('Error fetching freelancer workload:', error);
    res.status(500).json({ error: 'Failed to fetch freelancer workload' });
  }
});

// Get freelancer workload for a specific freelancer
router.get('/freelancers/:id/workload', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const workload = await db.prepare(`
      SELECT 
        u.id as freelancer_id,
        u.username as freelancer_name,
        u.handle as freelancer_handle,
        COUNT(i.id) as total_assigned,
        SUM(CASE WHEN i.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN i.status = 'submitted' THEN 1 ELSE 0 END) as submitted,
        SUM(CASE WHEN i.status = 'needs_fixes' THEN 1 ELSE 0 END) as needs_fixes,
        SUM(CASE WHEN i.status = 'reviewed' THEN 1 ELSE 0 END) as reviewed,
        SUM(CASE WHEN i.status IN ('published', 'archived') THEN 1 ELSE 0 END) as completed
      FROM users u
      LEFT JOIN ideas i ON u.id = i.assigned_to
      WHERE u.id = ?
      GROUP BY u.id, u.username, u.handle
    `).get(id);
    
    if (!workload) {
      return res.status(404).json({ error: 'Freelancer not found' });
    }
    
    res.json(workload);
  } catch (error) {
    console.error('Error fetching freelancer workload:', error);
    res.status(500).json({ error: 'Failed to fetch freelancer workload' });
  }
});

// Get detailed templates view
router.get('/templates/detailed', authenticateToken, async (req, res) => {
  try {
    const { department, status, assigned_to } = req.query;
    let query = `
      SELECT 
        i.*,
        u1.username as created_by_name,
        u2.username as assigned_to_name
      FROM ideas i
      LEFT JOIN users u1 ON i.created_by = u1.id
      LEFT JOIN users u2 ON i.assigned_to = u2.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;
    
    if (department) {
      paramCount++;
      query += ` AND i.department = $${paramCount}`;
      params.push(department);
    }
    
    if (status) {
      paramCount++;
      query += ` AND i.status = $${paramCount}`;
      params.push(status);
    }
    
    if (assigned_to) {
      paramCount++;
      query += ` AND u2.username = $${paramCount}`;
      params.push(assigned_to);
    }
    
    query += ' ORDER BY i.updated_at DESC';
    
    const templates = await db.prepare(query).all(...params);
    res.json(templates);
  } catch (error) {
    console.error('Error fetching detailed templates:', error);
    res.status(500).json({ error: 'Failed to fetch detailed templates' });
  }
});

// Get tags summary
router.get('/tags', authenticateToken, async (req, res) => {
  try {
    // Extract and count tags from comma-separated tags field
    const ideas = await db.prepare(`
      SELECT tags FROM ideas WHERE tags IS NOT NULL AND tags != ''
    `).all();
    
    const tagCounts = {};
    for (const idea of ideas) {
      const tags = idea.tags.split(',').map(t => t.trim()).filter(t => t);
      for (const tag of tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
    
    const tags = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
    
    res.json(tags);
  } catch (error) {
    console.error('Error fetching tags summary:', error);
    res.status(500).json({ error: 'Failed to fetch tags summary' });
  }
});

// Get recent activity dashboard
router.get('/recent-activity', authenticateToken, async (req, res) => {
  try {
    const limit = req.query.limit || 50;
    const activities = await db.prepare(`
      SELECT 
        a.*,
        u.username,
        u.handle,
        i.use_case,
        i.flow_name
      FROM activity_log a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN ideas i ON a.idea_id = i.id
      ORDER BY a.created_at DESC
      LIMIT ?
    `).all(parseInt(limit));
    
    res.json(activities);
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

// Get unassigned templates
router.get('/unassigned', authenticateToken, async (req, res) => {
  try {
    const templates = await db.prepare(`
      SELECT 
        i.*,
        u.username as created_by_name
      FROM ideas i
      LEFT JOIN users u ON i.created_by = u.id
      WHERE i.assigned_to IS NULL
      ORDER BY i.created_at DESC
    `).all();
    
    res.json(templates);
  } catch (error) {
    console.error('Error fetching unassigned templates:', error);
    res.status(500).json({ error: 'Failed to fetch unassigned templates' });
  }
});

// Get high-value templates
router.get('/high-value', authenticateToken, async (req, res) => {
  try {
    const limit = req.query.limit || 20;
    const templates = await db.prepare(`
      SELECT 
        i.*,
        u1.username as created_by_name,
        u2.username as assigned_to_name
      FROM ideas i
      LEFT JOIN users u1 ON i.created_by = u1.id
      LEFT JOIN users u2 ON i.assigned_to = u2.id
      WHERE i.price > 0
      ORDER BY i.price DESC
      LIMIT ?
    `).all(parseInt(limit));
    
    res.json(templates);
  } catch (error) {
    console.error('Error fetching high-value templates:', error);
    res.status(500).json({ error: 'Failed to fetch high-value templates' });
  }
});

// Get dashboard overview (combines multiple views)
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const departments = await db.prepare(`
      SELECT 
        department,
        COUNT(*) as template_count
      FROM ideas
      WHERE department IS NOT NULL AND department != ''
      GROUP BY department
      ORDER BY template_count DESC
    `).all();

    const statuses = await db.prepare(`
      SELECT status, COUNT(*) as count
      FROM ideas
      GROUP BY status
    `).all();

    const recentActivity = await db.prepare(`
      SELECT 
        a.*,
        u.username,
        i.use_case,
        i.flow_name
      FROM activity_log a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN ideas i ON a.idea_id = i.id
      ORDER BY a.created_at DESC
      LIMIT 10
    `).all();

    const unassignedCount = await db.prepare(`
      SELECT COUNT(*) as count FROM ideas WHERE assigned_to IS NULL
    `).get();

    const freelancerWorkload = await db.prepare(`
      SELECT 
        u.id as freelancer_id,
        u.username as freelancer_name,
        COUNT(i.id) as total_assigned
      FROM users u
      LEFT JOIN ideas i ON u.id = i.assigned_to
      WHERE u.role = 'freelancer'
      GROUP BY u.id, u.username
      ORDER BY total_assigned DESC
    `).all();

    const overview = {
      departments: departments || [],
      statuses: statuses || [],
      recentActivity: recentActivity || [],
      unassignedCount: unassignedCount || { count: 0 },
      freelancerWorkload: freelancerWorkload || []
    };
    
    res.json(overview);
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard overview' });
  }
});

export default router;
