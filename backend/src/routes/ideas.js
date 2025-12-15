import express from 'express';
import db from '../database/db.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { createNotification, parseMentions } from './notifications.js';
import { addInvoiceItem } from './invoices.js';
import { emitToAll, emitToUser, emitToIdea, emitToFreelancers } from '../socket.js';

const router = express.Router();

// Helper function to log activity (async for PostgreSQL)
const logActivity = async (ideaId, userId, action, details = null) => {
  await db.prepare(`
    INSERT INTO activity_log (idea_id, user_id, action, details)
    VALUES (?, ?, ?, ?)
  `).run(ideaId, userId, action, details);
};

// Helper function to notify assignee about status changes
const notifyStatusChange = (idea, newStatus, changedByUserId) => {
  if (!idea.assigned_to || idea.assigned_to === changedByUserId) return;
  
  const statusMessages = {
    'needs_fixes': 'Your submission needs fixes',
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

// Placeholder for Public Library API integration
const publishToPublicLibrary = async (idea) => {
  console.log('📚 [PUBLIC LIBRARY API] Publishing template:', {
    id: idea.id,
    flow_name: idea.flow_name,
    use_case: idea.use_case
  });
  const publicLibraryId = `pl_${idea.id}_${Date.now()}`;
  console.log('📚 [PUBLIC LIBRARY API] Template published with ID:', publicLibraryId);
  return publicLibraryId;
};

const removeFromPublicLibrary = async (publicLibraryId) => {
  console.log('📚 [PUBLIC LIBRARY API] Removing template with ID:', publicLibraryId);
  return true;
};

// Get all ideas (filtered by role)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    let ideas;

    if (role === 'freelancer') {
      ideas = await db.prepare(`
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
      ideas = await db.prepare(`
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
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const idea = await db.prepare(`
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

    if (req.user.role === 'freelancer' && 
        idea.assigned_to !== null && 
        idea.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const comments = await db.prepare(`
      SELECT c.*, u.username, u.handle
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.idea_id = ?
      ORDER BY c.created_at DESC
    `).all(req.params.id);

    const activities = await db.prepare(`
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
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
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

    const result = await db.prepare(`
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

    await logActivity(result.lastInsertRowid, req.user.id, 'created', 'Idea created');

    const newIdea = await db.prepare(`
      SELECT i.*, u.username as created_by_name
      FROM ideas i
      LEFT JOIN users u ON i.created_by = u.id
      WHERE i.id = ?
    `).get(result.lastInsertRowid);

    // Emit real-time event for new idea
    emitToAll('idea:created', newIdea);

    res.status(201).json(newIdea);
  } catch (error) {
    console.error('Create idea error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update idea
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const ideaId = req.params.id;
    const idea = await db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);

    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    const { role, id: userId } = req.user;
    const updates = req.body;
    const oldStatus = idea.status;

    if (role === 'freelancer') {
      if (idea.assigned_to !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      delete updates.price;
      delete updates.created_by;
      delete updates.assigned_to;
      
      if (updates.status && !['in_progress', 'submitted'].includes(updates.status)) {
        delete updates.status;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');

    await db.prepare(`
      UPDATE ideas 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${fields.length + 1}
    `).run(...values, ideaId);

    await logActivity(ideaId, userId, 'updated', JSON.stringify(updates));

    if (updates.status && updates.status !== oldStatus) {
      notifyStatusChange(idea, updates.status, userId);
      
      if (updates.status === 'reviewed' && idea.assigned_to && idea.price > 0) {
        const existingInvoiceItem = await db.prepare(`
          SELECT id FROM invoice_items 
          WHERE idea_id = ? AND freelancer_id = ?
        `).get(idea.id, idea.assigned_to);
        
        if (!existingInvoiceItem) {
          const ideaTitle = idea.flow_name || idea.use_case;
          await addInvoiceItem(idea.assigned_to, idea.id, ideaTitle, idea.price);
        }
      }
      
      if (updates.status === 'published') {
        try {
          const publicLibraryId = await publishToPublicLibrary(idea);
          await db.prepare(`
            UPDATE ideas SET public_library_id = ? WHERE id = ?
          `).run(publicLibraryId, ideaId);
        } catch (error) {
          console.error('Failed to publish to Public Library:', error);
        }
      }
      
      if (updates.status === 'archived' && idea.public_library_id) {
        try {
          await removeFromPublicLibrary(idea.public_library_id);
          await db.prepare(`
            UPDATE ideas SET public_library_id = NULL WHERE id = ?
          `).run(ideaId);
        } catch (error) {
          console.error('Failed to remove from Public Library:', error);
        }
      }
    }

    const updatedIdea = await db.prepare(`
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

    // Emit real-time update to all users and anyone watching this idea
    emitToAll('idea:updated', updatedIdea);
    emitToIdea(ideaId, 'idea:updated', updatedIdea);

    res.json(updatedIdea);
  } catch (error) {
    console.error('Update idea error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign idea to freelancer (admin only)
router.post('/:id/assign', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { freelancerId } = req.body;
    const ideaId = req.params.id;

    const freelancer = await db.prepare('SELECT * FROM users WHERE id = ? AND role = ?')
      .get(freelancerId, 'freelancer');

    if (!freelancer) {
      return res.status(400).json({ error: 'Invalid freelancer' });
    }

    const idea = await db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);

    await db.prepare(`
      UPDATE ideas 
      SET assigned_to = ?, status = 'assigned', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(freelancerId, ideaId);

    await logActivity(ideaId, req.user.id, 'assigned', `Assigned to ${freelancer.username}`);

    const ideaTitle = idea.flow_name || idea.use_case;
    createNotification(
      freelancerId,
      'assignment',
      'New template assigned to you',
      `You have been assigned to work on "${ideaTitle}"`,
      ideaId,
      req.user.id
    );

    const updatedIdea = await db.prepare(`
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

    // Emit real-time assignment event
    emitToAll('idea:assigned', updatedIdea);
    emitToUser(freelancerId, 'idea:assigned', updatedIdea);

    res.json(updatedIdea);
  } catch (error) {
    console.error('Assign idea error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Self-assign idea (freelancer only)
router.post('/:id/self-assign', authenticateToken, authorizeRoles('freelancer'), async (req, res) => {
  try {
    const ideaId = req.params.id;
    const freelancerId = req.user.id;

    const idea = await db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);

    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    if (idea.assigned_to !== null) {
      return res.status(400).json({ error: 'This idea is already assigned to someone' });
    }

    await db.prepare(`
      UPDATE ideas 
      SET assigned_to = ?, status = 'assigned', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(freelancerId, ideaId);

    await logActivity(ideaId, freelancerId, 'self-assigned', `${req.user.username} assigned themselves to this idea`);

    const updatedIdea = await db.prepare(`
      SELECT i.*, 
             u1.username as created_by_name,
             u2.username as assigned_to_name
      FROM ideas i
      LEFT JOIN users u1 ON i.created_by = u1.id
      LEFT JOIN users u2 ON i.assigned_to = u2.id
      WHERE i.id = ?
    `).get(ideaId);

    // Emit real-time self-assignment event (idea no longer available)
    emitToAll('idea:assigned', updatedIdea);
    emitToFreelancers('idea:assigned', updatedIdea);

    res.json(updatedIdea);
  } catch (error) {
    console.error('Self-assign idea error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get comments for an idea
router.get('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const ideaId = req.params.id;
    
    const comments = await db.prepare(`
      SELECT c.*, u.username, u.handle, u.role
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.idea_id = ?
      ORDER BY c.created_at DESC
    `).all(ideaId);

    res.json(comments);
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get activity log for an idea
router.get('/:id/activity', authenticateToken, async (req, res) => {
  try {
    const ideaId = req.params.id;
    
    const activities = await db.prepare(`
      SELECT a.*, u.username, u.handle
      FROM activity_log a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.idea_id = ?
      ORDER BY a.created_at DESC
    `).all(ideaId);

    res.json(activities);
  } catch (error) {
    console.error('Get activity log error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add comment
router.post('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { comment } = req.body;
    const ideaId = req.params.id;

    if (!comment) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    const result = await db.prepare(`
      INSERT INTO comments (idea_id, user_id, comment)
      VALUES (?, ?, ?)
    `).run(ideaId, req.user.id, comment);

    // Handle @mentions in comment
    const mentions = parseMentions(comment);
    console.log('📢 Parsing mentions from comment:', comment);
    console.log('📢 Found mentions:', mentions);
    
    if (mentions.length > 0) {
      const idea = await db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);
      const ideaTitle = idea.flow_name || idea.use_case;

      for (const handle of mentions) {
        console.log(`📢 Looking up user with handle: "${handle}"`);
        const mentionedUser = await db.prepare('SELECT id FROM users WHERE handle = ?').get(handle);
        console.log('📢 Found user:', mentionedUser);
        
        if (mentionedUser && mentionedUser.id !== req.user.id) {
          console.log(`📢 Creating notification for user ${mentionedUser.id}`);
          createNotification(
            mentionedUser.id,
            'mention',
            `@${req.user.username} mentioned you`,
            `You were mentioned in a comment on "${ideaTitle}"`,
            ideaId,
            req.user.id
          );
          console.log('✅ Notification created!');
        } else if (!mentionedUser) {
          console.log(`⚠️ User with handle "${handle}" not found in database`);
        }
      }
    }

    const newComment = await db.prepare(`
      SELECT c.*, u.username, u.handle
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(result.lastInsertRowid);

    // Emit real-time comment event to anyone watching this idea
    emitToIdea(ideaId, 'comment:new', { ideaId: parseInt(ideaId), comment: newComment });

    res.status(201).json(newComment);
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete idea (admin only) - CASCADE DELETE for PostgreSQL
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const ideaId = req.params.id;
    
    // Check if idea exists
    const idea = await db.prepare('SELECT id FROM ideas WHERE id = ?').get(ideaId);
    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    // CASCADE DELETE: Delete all related records
    // With PostgreSQL ON DELETE CASCADE, most of this is automatic
    // But let's be explicit for safety
    
    // 1. Delete blocker discussions (must be deleted before blockers)
    const blockerIds = await db.prepare('SELECT id FROM blockers WHERE idea_id = ?').all(ideaId);
    for (const blocker of blockerIds) {
      await db.prepare('DELETE FROM blocker_discussions WHERE blocker_id = ?').run(blocker.id);
    }
    
    // 2. Delete blockers
    await db.prepare('DELETE FROM blockers WHERE idea_id = ?').run(ideaId);
    
    // 3. Delete comments
    await db.prepare('DELETE FROM comments WHERE idea_id = ?').run(ideaId);
    
    // 4. Delete activity log
    await db.prepare('DELETE FROM activity_log WHERE idea_id = ?').run(ideaId);
    
    // 5. Delete notifications related to this idea
    await db.prepare('DELETE FROM notifications WHERE idea_id = ?').run(ideaId);
    
    // 6. Delete invoice items (PostgreSQL schema has ON DELETE CASCADE)
    await db.prepare('DELETE FROM invoice_items WHERE idea_id = ?').run(ideaId);
    
    // 7. Finally, delete the idea itself
    const result = await db.prepare('DELETE FROM ideas WHERE id = ?').run(ideaId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    // Emit real-time deletion event
    emitToAll('idea:deleted', { id: parseInt(ideaId) });

    res.json({ 
      message: 'Idea deleted successfully',
      deletedRecords: {
        blockers: blockerIds.length,
        idea: ideaId
      }
    });
  } catch (error) {
    console.error('Delete idea error:', error);
    res.status(500).json({ 
      error: 'Failed to delete idea',
      details: error.message 
    });
  }
});

// Get all freelancers (for assignment dropdown)
router.get('/users/freelancers', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const freelancers = await db.prepare(`
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
