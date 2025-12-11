import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get department summary with template counts
router.get('/departments', authenticateToken, (req, res) => {
  try {
    const departments = db.prepare(`
      SELECT * FROM department_summary
    `).all();
    
    res.json(departments);
  } catch (error) {
    console.error('Error fetching department summary:', error);
    res.status(500).json({ error: 'Failed to fetch department summary' });
  }
});

// Get templates for a specific department
router.get('/departments/:department/templates', authenticateToken, (req, res) => {
  try {
    const { department } = req.params;
    const templates = db.prepare(`
      SELECT * FROM department_templates
      WHERE department = ?
    `).all(department);
    
    res.json(templates);
  } catch (error) {
    console.error('Error fetching department templates:', error);
    res.status(500).json({ error: 'Failed to fetch department templates' });
  }
});

// Get department performance metrics
router.get('/departments/performance', authenticateToken, (req, res) => {
  try {
    const performance = db.prepare(`
      SELECT * FROM department_performance
    `).all();
    
    res.json(performance);
  } catch (error) {
    console.error('Error fetching department performance:', error);
    res.status(500).json({ error: 'Failed to fetch department performance' });
  }
});

// Get status summary
router.get('/status', authenticateToken, (req, res) => {
  try {
    const statuses = db.prepare(`
      SELECT * FROM status_summary
    `).all();
    
    res.json(statuses);
  } catch (error) {
    console.error('Error fetching status summary:', error);
    res.status(500).json({ error: 'Failed to fetch status summary' });
  }
});

// Get freelancer workload
router.get('/freelancers/workload', authenticateToken, (req, res) => {
  try {
    const workload = db.prepare(`
      SELECT * FROM freelancer_workload
    `).all();
    
    res.json(workload);
  } catch (error) {
    console.error('Error fetching freelancer workload:', error);
    res.status(500).json({ error: 'Failed to fetch freelancer workload' });
  }
});

// Get freelancer workload for a specific freelancer
router.get('/freelancers/:id/workload', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const workload = db.prepare(`
      SELECT * FROM freelancer_workload
      WHERE freelancer_id = ?
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
router.get('/templates/detailed', authenticateToken, (req, res) => {
  try {
    const { department, status, assigned_to } = req.query;
    let query = 'SELECT * FROM templates_detailed WHERE 1=1';
    const params = [];
    
    if (department) {
      query += ' AND department = ?';
      params.push(department);
    }
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (assigned_to) {
      query += ' AND assigned_to_name = ?';
      params.push(assigned_to);
    }
    
    query += ' ORDER BY updated_at DESC';
    
    const templates = db.prepare(query).all(...params);
    res.json(templates);
  } catch (error) {
    console.error('Error fetching detailed templates:', error);
    res.status(500).json({ error: 'Failed to fetch detailed templates' });
  }
});

// Get tags summary
router.get('/tags', authenticateToken, (req, res) => {
  try {
    const tags = db.prepare(`
      SELECT * FROM tags_summary
    `).all();
    
    res.json(tags);
  } catch (error) {
    console.error('Error fetching tags summary:', error);
    res.status(500).json({ error: 'Failed to fetch tags summary' });
  }
});

// Get recent activity dashboard
router.get('/recent-activity', authenticateToken, (req, res) => {
  try {
    const limit = req.query.limit || 50;
    const activities = db.prepare(`
      SELECT * FROM recent_activity_dashboard
      LIMIT ?
    `).all(limit);
    
    res.json(activities);
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

// Get unassigned templates
router.get('/unassigned', authenticateToken, (req, res) => {
  try {
    const templates = db.prepare(`
      SELECT * FROM unassigned_templates
    `).all();
    
    res.json(templates);
  } catch (error) {
    console.error('Error fetching unassigned templates:', error);
    res.status(500).json({ error: 'Failed to fetch unassigned templates' });
  }
});

// Get high-value templates
router.get('/high-value', authenticateToken, (req, res) => {
  try {
    const limit = req.query.limit || 20;
    const templates = db.prepare(`
      SELECT * FROM high_value_templates
      LIMIT ?
    `).all(limit);
    
    res.json(templates);
  } catch (error) {
    console.error('Error fetching high-value templates:', error);
    res.status(500).json({ error: 'Failed to fetch high-value templates' });
  }
});

// Get dashboard overview (combines multiple views)
router.get('/dashboard', authenticateToken, (req, res) => {
  try {
    const overview = {
      departments: db.prepare('SELECT * FROM department_summary').all(),
      statuses: db.prepare('SELECT * FROM status_summary').all(),
      recentActivity: db.prepare('SELECT * FROM recent_activity_dashboard LIMIT 10').all(),
      unassignedCount: db.prepare('SELECT COUNT(*) as count FROM unassigned_templates').get(),
      freelancerWorkload: db.prepare('SELECT * FROM freelancer_workload').all()
    };
    
    res.json(overview);
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard overview' });
  }
});

export default router;

