import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createNotification } from './notifications.js';

const router = express.Router();

// Get all blockers for an idea
router.get('/idea/:ideaId', authenticateToken, async (req, res) => {
  try {
    const { includeResolved } = req.query;
    
    let query = `
      SELECT 
        b.*,
        u1.username as created_by_name,
        u1.handle as created_by_handle,
        u2.username as resolved_by_name,
        u2.handle as resolved_by_handle,
        (SELECT COUNT(*) FROM blocker_discussions WHERE blocker_id = b.id) as discussion_count
      FROM blockers b
      LEFT JOIN users u1 ON b.created_by = u1.id
      LEFT JOIN users u2 ON b.resolved_by = u2.id
      WHERE b.idea_id = ?
    `;
    
    if (includeResolved !== 'true') {
      query += " AND b.status NOT IN ('resolved', 'wont_fix')";
    }
    
    query += ' ORDER BY b.created_at DESC';

    const blockers = await db.prepare(query).all(req.params.ideaId);
    res.json(blockers);
  } catch (error) {
    console.error('Get blockers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all blockers (with filter option)
router.get('/all', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT 
        b.*,
        i.use_case,
        i.flow_name,
        i.department,
        i.assigned_to,
        u1.username as created_by_name,
        u2.username as assigned_to_name,
        (SELECT COUNT(*) FROM blocker_discussions WHERE blocker_id = b.id) as discussion_count
      FROM blockers b
      JOIN ideas i ON b.idea_id = i.id
      LEFT JOIN users u1 ON b.created_by = u1.id
      LEFT JOIN users u2 ON i.assigned_to = u2.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (status) {
      query += ' AND b.status = ?';
      params.push(status);
    }
    
    query += `
      ORDER BY 
        CASE b.priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        b.created_at DESC
    `;

    const blockers = await db.prepare(query).all(...params);
    res.json(blockers);
  } catch (error) {
    console.error('Get blockers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all open blockers (for dashboard view)
router.get('/open', authenticateToken, async (req, res) => {
  try {
    const blockers = await db.prepare(`
      SELECT 
        b.*,
        i.use_case,
        i.flow_name,
        i.department,
        i.assigned_to,
        u1.username as created_by_name,
        u2.username as assigned_to_name,
        (SELECT COUNT(*) FROM blocker_discussions WHERE blocker_id = b.id) as discussion_count
      FROM blockers b
      JOIN ideas i ON b.idea_id = i.id
      LEFT JOIN users u1 ON b.created_by = u1.id
      LEFT JOIN users u2 ON i.assigned_to = u2.id
      WHERE b.status IN ('open', 'in_progress')
      ORDER BY 
        CASE b.priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        b.created_at DESC
    `).all();

    res.json(blockers);
  } catch (error) {
    console.error('Get open blockers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get blockers by type
router.get('/type/:type', authenticateToken, async (req, res) => {
  try {
    const { type } = req.params;
    
    const blockers = await db.prepare(`
      SELECT 
        b.*,
        i.use_case,
        i.flow_name,
        i.department,
        u.username as created_by_name
      FROM blockers b
      JOIN ideas i ON b.idea_id = i.id
      LEFT JOIN users u ON b.created_by = u.id
      WHERE b.blocker_type = ? AND b.status IN ('open', 'in_progress')
      ORDER BY b.created_at DESC
    `).all(type);

    res.json(blockers);
  } catch (error) {
    console.error('Get blockers by type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new blocker
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { idea_id, blocker_type, title, description, priority } = req.body;

    if (!idea_id || !blocker_type || !title || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const idea = await db.prepare('SELECT * FROM ideas WHERE id = ?').get(idea_id);
    if (!idea) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const result = await db.prepare(`
      INSERT INTO blockers (idea_id, blocker_type, title, description, priority, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(idea_id, blocker_type, title, description, priority || 'medium', req.user.id);

    if (idea.assigned_to && idea.assigned_to !== req.user.id) {
      const ideaTitle = idea.flow_name || idea.use_case;
      await createNotification(
        idea.assigned_to,
        'blocker',
        'Blocker added to your template',
        `A blocker was added to "${ideaTitle}": ${title}`,
        idea_id,
        req.user.id
      );
    }

    const newBlocker = await db.prepare(`
      SELECT 
        b.*,
        u.username as created_by_name,
        u.handle as created_by_handle
      FROM blockers b
      LEFT JOIN users u ON b.created_by = u.id
      WHERE b.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newBlocker);
  } catch (error) {
    console.error('Create blocker error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update blocker
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const blocker = await db.prepare('SELECT * FROM blockers WHERE id = ?').get(id);
    if (!blocker) {
      return res.status(404).json({ error: 'Blocker not found' });
    }

    const idea = await db.prepare('SELECT * FROM ideas WHERE id = ?').get(blocker.idea_id);
    if (req.user.role !== 'admin' && 
        req.user.id !== blocker.created_by && 
        req.user.id !== idea.assigned_to) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const allowedFields = ['blocker_type', 'title', 'description', 'status', 'priority', 'resolution_notes'];
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const values = fields.map(key => updates[key]);

    if (updates.status === 'resolved' && blocker.status !== 'resolved') {
      const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');
      await db.prepare(`
        UPDATE blockers 
        SET ${setClause}, resolved_by = $${fields.length + 1}, resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${fields.length + 2}
      `).run(...values, req.user.id, id);

      if (idea.assigned_to && idea.assigned_to !== req.user.id) {
        const ideaTitle = idea.flow_name || idea.use_case;
        await createNotification(
          idea.assigned_to,
          'blocker',
          'Blocker resolved',
          `A blocker on "${ideaTitle}" has been resolved: ${blocker.title}`,
          idea.id,
          req.user.id
        );
      }
    } else {
      const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');
      await db.prepare(`
        UPDATE blockers 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${fields.length + 1}
      `).run(...values, id);
    }

    const updatedBlocker = await db.prepare(`
      SELECT 
        b.*,
        u1.username as created_by_name,
        u1.handle as created_by_handle,
        u2.username as resolved_by_name,
        u2.handle as resolved_by_handle,
        (SELECT COUNT(*) FROM blocker_discussions WHERE blocker_id = b.id) as discussion_count
      FROM blockers b
      LEFT JOIN users u1 ON b.created_by = u1.id
      LEFT JOIN users u2 ON b.resolved_by = u2.id
      WHERE b.id = ?
    `).get(id);

    res.json(updatedBlocker);
  } catch (error) {
    console.error('Update blocker error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete blocker
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const blocker = await db.prepare('SELECT * FROM blockers WHERE id = ?').get(id);
    if (!blocker) {
      return res.status(404).json({ error: 'Blocker not found' });
    }

    if (req.user.role !== 'admin' && req.user.id !== blocker.created_by) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // CASCADE DELETE: Delete blocker discussions first
    await db.prepare('DELETE FROM blocker_discussions WHERE blocker_id = ?').run(id);
    
    // Then delete the blocker itself
    await db.prepare('DELETE FROM blockers WHERE id = ?').run(id);
    
    res.json({ message: 'Blocker deleted successfully' });
  } catch (error) {
    console.error('Delete blocker error:', error);
    res.status(500).json({ 
      error: 'Failed to delete blocker',
      details: error.message 
    });
  }
});

// Get blocker statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const totalOpen = await db.prepare("SELECT COUNT(*) as count FROM blockers WHERE status IN ('open', 'in_progress')").get();
    const totalResolved = await db.prepare("SELECT COUNT(*) as count FROM blockers WHERE status = 'resolved'").get();
    const byType = await db.prepare(`
      SELECT blocker_type, COUNT(*) as count
      FROM blockers
      WHERE status IN ('open', 'in_progress')
      GROUP BY blocker_type
    `).all();
    const byPriority = await db.prepare(`
      SELECT priority, COUNT(*) as count
      FROM blockers
      WHERE status IN ('open', 'in_progress')
      GROUP BY priority
    `).all();
    const recentlyResolved = await db.prepare(`
      SELECT COUNT(*) as count
      FROM blockers
      WHERE status = 'resolved' 
      AND resolved_at > NOW() - INTERVAL '7 days'
    `).get();

    const stats = {
      total_open: totalOpen?.count || 0,
      total_resolved: totalResolved?.count || 0,
      by_type: byType || [],
      by_priority: byPriority || [],
      recently_resolved: recentlyResolved?.count || 0
    };

    res.json(stats);
  } catch (error) {
    console.error('Get blocker stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== BLOCKER DISCUSSIONS =====

// Get discussions for a blocker
router.get('/:blockerId/discussions', authenticateToken, async (req, res) => {
  try {
    const { blockerId } = req.params;

    const discussions = await db.prepare(`
      SELECT 
        bd.*,
        u.username,
        u.handle,
        u.role
      FROM blocker_discussions bd
      JOIN users u ON bd.user_id = u.id
      WHERE bd.blocker_id = ?
      ORDER BY bd.created_at ASC
    `).all(blockerId);

    res.json(discussions);
  } catch (error) {
    console.error('Get blocker discussions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add discussion message to a blocker
router.post('/:blockerId/discussions', authenticateToken, async (req, res) => {
  try {
    const { blockerId } = req.params;
    const { message, is_solution } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const blocker = await db.prepare('SELECT * FROM blockers WHERE id = ?').get(blockerId);
    if (!blocker) {
      return res.status(404).json({ error: 'Blocker not found' });
    }

    const result = await db.prepare(`
      INSERT INTO blocker_discussions (blocker_id, user_id, message, is_solution)
      VALUES (?, ?, ?, ?)
    `).run(blockerId, req.user.id, message, is_solution || false);

    const idea = await db.prepare('SELECT * FROM ideas WHERE id = ?').get(blocker.idea_id);
    const ideaTitle = idea.flow_name || idea.use_case;

    if (blocker.created_by !== req.user.id) {
      await createNotification(
        blocker.created_by,
        'blocker',
        'New discussion on blocker',
        `${req.user.username} commented on blocker "${blocker.title}" in "${ideaTitle}"`,
        idea.id,
        req.user.id
      );
    }

    if (idea.assigned_to && idea.assigned_to !== req.user.id && idea.assigned_to !== blocker.created_by) {
      await createNotification(
        idea.assigned_to,
        'blocker',
        'New discussion on blocker',
        `${req.user.username} commented on blocker "${blocker.title}" in "${ideaTitle}"`,
        idea.id,
        req.user.id
      );
    }

    const newDiscussion = await db.prepare(`
      SELECT 
        bd.*,
        u.username,
        u.handle,
        u.role
      FROM blocker_discussions bd
      JOIN users u ON bd.user_id = u.id
      WHERE bd.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newDiscussion);
  } catch (error) {
    console.error('Add blocker discussion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete discussion message
router.delete('/discussions/:discussionId', authenticateToken, async (req, res) => {
  try {
    const { discussionId } = req.params;

    const discussion = await db.prepare('SELECT * FROM blocker_discussions WHERE id = ?').get(discussionId);
    if (!discussion) {
      return res.status(404).json({ error: 'Discussion not found' });
    }

    if (req.user.role !== 'admin' && req.user.id !== discussion.user_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.prepare('DELETE FROM blocker_discussions WHERE id = ?').run(discussionId);
    res.json({ message: 'Discussion deleted' });
  } catch (error) {
    console.error('Delete discussion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
