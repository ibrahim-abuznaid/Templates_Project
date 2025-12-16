import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all departments
router.get('/', authenticateToken, async (req, res) => {
  try {
    const departments = await db.prepare(`
      SELECT id, name, description, display_order
      FROM departments
      ORDER BY display_order, name
    `).all();

    res.json(departments);
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

export default router;
