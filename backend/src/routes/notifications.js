import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Helper function to create notification
export const createNotification = (userId, type, title, message, ideaId = null, fromUserId = null) => {
  try {
    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, idea_id, from_user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, type, title, message, ideaId, fromUserId);
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

// Helper function to parse mentions from comment text
export const parseMentions = (text) => {
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  return mentions;
};

// Get all notifications for current user
router.get('/', authenticateToken, (req, res) => {
  try {
    const notifications = db.prepare(`
      SELECT n.*, 
             u.username as from_username,
             u.handle as from_handle,
             i.use_case as idea_title,
             i.flow_name as idea_flow_name
      FROM notifications n
      LEFT JOIN users u ON n.from_user_id = u.id
      LEFT JOIN ideas i ON n.idea_id = i.id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 50
    `).all(req.user.id);

    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get unread notification count
router.get('/unread-count', authenticateToken, (req, res) => {
  try {
    const result = db.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND read_at IS NULL
    `).get(req.user.id);

    res.json({ count: result.count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark notification as read
router.put('/:id/read', authenticateToken, (req, res) => {
  try {
    const notification = db.prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    db.prepare(`
      UPDATE notifications 
      SET read_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(req.params.id);

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark all notifications as read
router.put('/mark-all-read', authenticateToken, (req, res) => {
  try {
    db.prepare(`
      UPDATE notifications 
      SET read_at = CURRENT_TIMESTAMP 
      WHERE user_id = ? AND read_at IS NULL
    `).run(req.user.id);

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete notification
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clear all notifications
router.delete('/', authenticateToken, (req, res) => {
  try {
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(req.user.id);
    res.json({ message: 'All notifications cleared' });
  } catch (error) {
    console.error('Clear notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

