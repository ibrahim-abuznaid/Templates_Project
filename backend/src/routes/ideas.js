import express from 'express';
import db from '../database/db.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { createNotification, parseMentions } from './notifications.js';
import { addInvoiceItem } from './invoices.js';

const router = express.Router();

// Helper function to log activity
const logActivity = (ideaId, userId, action, details = null) => {
  db.prepare(`
    INSERT INTO activity_log (idea_id, user_id, action, details)
    VALUES (?, ?, ?, ?)
  `).run(ideaId, userId, action, details);
};

// Helper function to notify assignee about status changes
const notifyStatusChange = (idea, newStatus, changedByUserId) => {
  if (!idea.assigned_to || idea.assigned_to === changedByUserId) return;
  
  const statusMessages = {
    'reviewed': 'Your work has been reviewed',
    'needs_fixes': 'Your submission needs fixes',
    'published': 'Your template has been published!',
    'assigned': 'You have been assigned a new template'
  };

  const message = statusMessages[newStatus];
  if (message) {
    const ideaTitle = idea.flow_name || idea.use_case;
    createNotification(
      idea.assigned_to,
      'status_change',
      message,
      `"${ideaTitle}" status changed to ${newStatus.replace('_', ' ')}`,
      idea.id,
      changedByUserId
    );
  }
};

// Get all ideas (filtered by role)
router.get('/', authenticateToken, (req, res) => {
  try {
    const { role, id: userId } = req.user;
    let ideas;

    if (role === 'freelancer') {
      // Freelancers only see ideas assigned to them or unassigned
      ideas = db.prepare(`
        SELECT i.*, 
               u1.username as created_by_name,
               u1.handle as created_by_handle,
               u2.username as assigned_to_name,
               u2.handle as assigned_to_handle
        FROM ideas i
        LEFT JOIN users u1 ON i.created_by = u1.id
        LEFT JOIN users u2 ON i.assigned_to = u2.id
        WHERE i.assigned_to = ? OR i.assigned_to IS NULL
        ORDER BY i.created_at DESC
      `).all(userId);
    } else {
      // Admin and reviewer see all ideas
      ideas = db.prepare(`
        SELECT i.*, 
               u1.username as created_by_name,
               u1.handle as created_by_handle,
               u2.username as assigned_to_name,
               u2.handle as assigned_to_handle
        FROM ideas i
        LEFT JOIN users u1 ON i.created_by = u1.id
        LEFT JOIN users u2 ON i.assigned_to = u2.id
        ORDER BY i.created_at DESC
      `).all();
    }

    res.json(ideas);
  } catch (error) {
    console.error('Get ideas error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single idea
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const idea = db.prepare(`
      SELECT i.*, 
             u1.username as created_by_name,
             u1.handle as created_by_handle,
             u2.username as assigned_to_name,
             u2.handle as assigned_to_handle
      FROM ideas i
      LEFT JOIN users u1 ON i.created_by = u1.id
      LEFT JOIN users u2 ON i.assigned_to = u2.id
      WHERE i.id = ?
    `).get(req.params.id);

    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    // Check permissions - freelancers can view ideas assigned to them OR unassigned ideas
    if (req.user.role === 'freelancer' && 
        idea.assigned_to !== null && 
        idea.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get comments with handles
    const comments = db.prepare(`
      SELECT c.*, u.username, u.handle
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.idea_id = ?
      ORDER BY c.created_at DESC
    `).all(req.params.id);

    // Get activity log with handles
    const activities = db.prepare(`
      SELECT a.*, u.username, u.handle
      FROM activity_log a
      JOIN users u ON a.user_id = u.id
      WHERE a.idea_id = ?
      ORDER BY a.created_at DESC
    `).all(req.params.id);

    res.json({ ...idea, comments, activities });
  } catch (error) {
    console.error('Get idea error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new idea (admin only)
router.post('/', authenticateToken, authorizeRoles('admin'), (req, res) => {
  try {
    const { 
      use_case, 
      flow_name,
      short_description, 
      description, 
      department, 
      tags, 
      reviewer_name,
      price 
    } = req.body;

    if (!use_case) {
      return res.status(400).json({ error: 'Use case is required' });
    }

    const result = db.prepare(`
      INSERT INTO ideas (
        use_case, 
        flow_name,
        short_description, 
        description, 
        department, 
        tags, 
        reviewer_name, 
        price, 
        created_by, 
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
    `).run(
      use_case, 
      flow_name || '',
      short_description || '', 
      description || '', 
      department || '', 
      tags || '', 
      reviewer_name || '', 
      price || 0, 
      req.user.id
    );

    logActivity(result.lastInsertRowid, req.user.id, 'created', 'Idea created');

    const newIdea = db.prepare(`
      SELECT i.*, u.username as created_by_name
      FROM ideas i
      LEFT JOIN users u ON i.created_by = u.id
      WHERE i.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newIdea);
  } catch (error) {
    console.error('Create idea error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update idea
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const ideaId = req.params.id;
    const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);

    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    const { role, id: userId } = req.user;
    const updates = req.body;
    const oldStatus = idea.status;

    // Role-based update restrictions
    if (role === 'freelancer') {
      // Freelancers can only update their assigned ideas
      if (idea.assigned_to !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      // Freelancers cannot change price or certain statuses
      delete updates.price;
      delete updates.created_by;
      delete updates.assigned_to;
      
      // Only allow specific status transitions
      if (updates.status && !['in_progress', 'submitted'].includes(updates.status)) {
        delete updates.status;
      }
    }
    // Admins can update everything

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map(field => `${field} = ?`).join(', ');

    db.prepare(`
      UPDATE ideas 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(...values, ideaId);

    logActivity(ideaId, userId, 'updated', JSON.stringify(updates));

    // Send notification if status changed
    if (updates.status && updates.status !== oldStatus) {
      notifyStatusChange(idea, updates.status, userId);
      
      // Add to invoice when template is reviewed or published
      if ((updates.status === 'reviewed' || updates.status === 'published') && 
          idea.assigned_to && 
          idea.price > 0) {
        const ideaTitle = idea.flow_name || idea.use_case;
        addInvoiceItem(idea.assigned_to, idea.id, ideaTitle, idea.price);
      }
    }

    const updatedIdea = db.prepare(`
      SELECT i.*, 
             u1.username as created_by_name,
             u1.handle as created_by_handle,
             u2.username as assigned_to_name,
             u2.handle as assigned_to_handle
      FROM ideas i
      LEFT JOIN users u1 ON i.created_by = u1.id
      LEFT JOIN users u2 ON i.assigned_to = u2.id
      WHERE i.id = ?
    `).get(ideaId);

    res.json(updatedIdea);
  } catch (error) {
    console.error('Update idea error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign idea to freelancer (admin only)
router.post('/:id/assign', authenticateToken, authorizeRoles('admin'), (req, res) => {
  try {
    const { freelancerId } = req.body;
    const ideaId = req.params.id;

    const freelancer = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?')
      .get(freelancerId, 'freelancer');

    if (!freelancer) {
      return res.status(400).json({ error: 'Invalid freelancer' });
    }

    const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);

    db.prepare(`
      UPDATE ideas 
      SET assigned_to = ?, status = 'assigned', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(freelancerId, ideaId);

    logActivity(ideaId, req.user.id, 'assigned', `Assigned to ${freelancer.username}`);

    // Notify freelancer about assignment
    const ideaTitle = idea.flow_name || idea.use_case;
    createNotification(
      freelancerId,
      'assignment',
      'New template assigned to you',
      `You have been assigned to work on "${ideaTitle}"`,
      ideaId,
      req.user.id
    );

    const updatedIdea = db.prepare(`
      SELECT i.*, 
             u1.username as created_by_name,
             u1.handle as created_by_handle,
             u2.username as assigned_to_name,
             u2.handle as assigned_to_handle
      FROM ideas i
      LEFT JOIN users u1 ON i.created_by = u1.id
      LEFT JOIN users u2 ON i.assigned_to = u2.id
      WHERE i.id = ?
    `).get(ideaId);

    res.json(updatedIdea);
  } catch (error) {
    console.error('Assign idea error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Self-assign idea (freelancer only)
router.post('/:id/self-assign', authenticateToken, authorizeRoles('freelancer'), (req, res) => {
  try {
    const ideaId = req.params.id;
    const freelancerId = req.user.id;

    // Check if idea exists and is unassigned
    const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);

    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    if (idea.assigned_to !== null) {
      return res.status(400).json({ error: 'This idea is already assigned to someone' });
    }

    db.prepare(`
      UPDATE ideas 
      SET assigned_to = ?, status = 'assigned', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(freelancerId, ideaId);

    logActivity(ideaId, freelancerId, 'self-assigned', `${req.user.username} assigned themselves to this idea`);

    const updatedIdea = db.prepare(`
      SELECT i.*, 
             u1.username as created_by_name,
             u2.username as assigned_to_name
      FROM ideas i
      LEFT JOIN users u1 ON i.created_by = u1.id
      LEFT JOIN users u2 ON i.assigned_to = u2.id
      WHERE i.id = ?
    `).get(ideaId);

    res.json(updatedIdea);
  } catch (error) {
    console.error('Self-assign idea error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add comment
router.post('/:id/comments', authenticateToken, (req, res) => {
  try {
    const { comment } = req.body;
    const ideaId = req.params.id;

    if (!comment) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    const result = db.prepare(`
      INSERT INTO comments (idea_id, user_id, comment)
      VALUES (?, ?, ?)
    `).run(ideaId, req.user.id, comment);

    // Handle @mentions in comment
    const mentions = parseMentions(comment);
    if (mentions.length > 0) {
      const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);
      const ideaTitle = idea.flow_name || idea.use_case;

      mentions.forEach(handle => {
        const mentionedUser = db.prepare('SELECT id FROM users WHERE handle = ?').get(handle);
        if (mentionedUser && mentionedUser.id !== req.user.id) {
          createNotification(
            mentionedUser.id,
            'mention',
            `@${req.user.username} mentioned you`,
            `You were mentioned in a comment on "${ideaTitle}"`,
            ideaId,
            req.user.id
          );
        }
      });
    }

    const newComment = db.prepare(`
      SELECT c.*, u.username, u.handle
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newComment);
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete idea (admin only)
router.delete('/:id', authenticateToken, authorizeRoles('admin'), (req, res) => {
  try {
    const result = db.prepare('DELETE FROM ideas WHERE id = ?').run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    res.json({ message: 'Idea deleted successfully' });
  } catch (error) {
    console.error('Delete idea error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all freelancers (for assignment dropdown)
router.get('/users/freelancers', authenticateToken, authorizeRoles('admin'), (req, res) => {
  try {
    const freelancers = db.prepare(`
      SELECT id, username, email
      FROM users
      WHERE role = 'freelancer'
      ORDER BY username
    `).all();

    res.json(freelancers);
  } catch (error) {
    console.error('Get freelancers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

