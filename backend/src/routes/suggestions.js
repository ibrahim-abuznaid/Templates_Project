import express from 'express';
import db from '../database/db.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { createNotification } from './notifications.js';
import { emitToAll, emitToUser } from '../socket.js';

const router = express.Router();

// Helper function to get departments for a suggested idea
const getSuggestedIdeaDepartments = async (suggestedIdeaId) => {
  const departments = await db.prepare(`
    SELECT d.id, d.name, d.description, d.display_order
    FROM departments d
    INNER JOIN suggested_idea_departments sid ON d.id = sid.department_id
    WHERE sid.suggested_idea_id = ?
    ORDER BY d.display_order, d.name
  `).all(suggestedIdeaId);
  return departments;
};

// Helper function to set departments for a suggested idea
const setSuggestedIdeaDepartments = async (suggestedIdeaId, departmentIds) => {
  if (!departmentIds || !Array.isArray(departmentIds)) return;
  
  // Remove existing departments
  await db.prepare('DELETE FROM suggested_idea_departments WHERE suggested_idea_id = ?').run(suggestedIdeaId);
  
  // Add new departments
  const insertStmt = db.prepare(`
    INSERT INTO suggested_idea_departments (suggested_idea_id, department_id)
    VALUES (?, ?)
  `);
  
  for (const deptId of departmentIds) {
    try {
      await insertStmt.run(suggestedIdeaId, deptId);
    } catch (error) {
      console.error(`Failed to add department ${deptId} to suggested idea ${suggestedIdeaId}:`, error);
    }
  }
};

// Helper function to set departments for an idea (same as in ideas.js)
const setIdeaDepartments = async (ideaId, departmentIds) => {
  if (!departmentIds || !Array.isArray(departmentIds)) return;
  
  // Remove existing departments
  await db.prepare('DELETE FROM idea_departments WHERE idea_id = ?').run(ideaId);
  
  // Add new departments
  const insertStmt = db.prepare(`
    INSERT INTO idea_departments (idea_id, department_id)
    VALUES (?, ?)
  `);
  
  for (const deptId of departmentIds) {
    try {
      await insertStmt.run(ideaId, deptId);
    } catch (error) {
      console.error(`Failed to add department ${deptId} to idea ${ideaId}:`, error);
    }
  }
};

// Get all suggestions (filtered by role)
// Freelancers see their own suggestions, admins see all
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const { status } = req.query;
    let suggestions;

    let statusFilter = '';
    const params = [];

    if (status && ['pending', 'approved', 'denied'].includes(status)) {
      statusFilter = ' AND si.status = ?';
      params.push(status);
    }

    if (role === 'freelancer') {
      suggestions = await db.prepare(`
        SELECT si.*, 
               u1.username as suggested_by_name,
               u1.handle as suggested_by_handle,
               u2.username as reviewed_by_name,
               u2.handle as reviewed_by_handle
        FROM suggested_ideas si
        LEFT JOIN users u1 ON si.suggested_by = u1.id
        LEFT JOIN users u2 ON si.reviewed_by = u2.id
        WHERE si.suggested_by = ?${statusFilter}
        ORDER BY si.created_at DESC
      `).all(userId, ...params);
    } else {
      suggestions = await db.prepare(`
        SELECT si.*, 
               u1.username as suggested_by_name,
               u1.handle as suggested_by_handle,
               u2.username as reviewed_by_name,
               u2.handle as reviewed_by_handle
        FROM suggested_ideas si
        LEFT JOIN users u1 ON si.suggested_by = u1.id
        LEFT JOIN users u2 ON si.reviewed_by = u2.id
        WHERE 1=1${statusFilter}
        ORDER BY 
          CASE si.status WHEN 'pending' THEN 0 ELSE 1 END,
          si.created_at DESC
      `).all(...params);
    }

    // Fetch departments for each suggestion
    for (const suggestion of suggestions) {
      suggestion.departments = await getSuggestedIdeaDepartments(suggestion.id);
    }

    res.json(suggestions);
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get suggestion by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const suggestion = await db.prepare(`
      SELECT si.*, 
             u1.username as suggested_by_name,
             u1.handle as suggested_by_handle,
             u2.username as reviewed_by_name,
             u2.handle as reviewed_by_handle
      FROM suggested_ideas si
      LEFT JOIN users u1 ON si.suggested_by = u1.id
      LEFT JOIN users u2 ON si.reviewed_by = u2.id
      WHERE si.id = ?
    `).get(req.params.id);

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    // Freelancers can only see their own suggestions
    if (req.user.role === 'freelancer' && suggestion.suggested_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    suggestion.departments = await getSuggestedIdeaDepartments(suggestion.id);

    res.json(suggestion);
  } catch (error) {
    console.error('Get suggestion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new suggestion (any authenticated user, typically freelancers)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { 
      flow_name,
      idea_notes,
      department_ids
    } = req.body;

    if (!flow_name || flow_name.trim() === '') {
      return res.status(400).json({ error: 'Flow name is required' });
    }

    if (!department_ids || department_ids.length === 0) {
      return res.status(400).json({ error: 'At least one department is required' });
    }

    const result = await db.prepare(`
      INSERT INTO suggested_ideas (
        flow_name,
        idea_notes,
        suggested_by,
        status
      )
      VALUES (?, ?, ?, 'pending')
    `).run(
      flow_name.trim(),
      idea_notes || '',
      req.user.id
    );

    const suggestionId = result.lastInsertRowid;

    // Set departments
    await setSuggestedIdeaDepartments(suggestionId, department_ids);

    // Fetch the created suggestion
    const newSuggestion = await db.prepare(`
      SELECT si.*, 
             u1.username as suggested_by_name,
             u1.handle as suggested_by_handle
      FROM suggested_ideas si
      LEFT JOIN users u1 ON si.suggested_by = u1.id
      WHERE si.id = ?
    `).get(suggestionId);

    newSuggestion.departments = await getSuggestedIdeaDepartments(suggestionId);

    // Notify admins about new suggestion
    const admins = await db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
    for (const admin of admins) {
      createNotification(
        admin.id,
        'suggestion',
        '💡 New Template Suggestion',
        `${req.user.username} suggested: "${flow_name}"`,
        null,
        req.user.id
      );
    }

    // Emit real-time event
    emitToAll('suggestion:created', newSuggestion);

    res.status(201).json(newSuggestion);
  } catch (error) {
    console.error('Create suggestion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update suggestion (only by the creator, and only if pending)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const suggestionId = req.params.id;
    const suggestion = await db.prepare('SELECT * FROM suggested_ideas WHERE id = ?').get(suggestionId);

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    // Only the creator can update, and only admins can update others' suggestions
    if (req.user.role !== 'admin' && suggestion.suggested_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Can only update pending suggestions (unless admin)
    if (req.user.role !== 'admin' && suggestion.status !== 'pending') {
      return res.status(400).json({ error: 'Cannot update a suggestion that has already been reviewed' });
    }

    const { flow_name, idea_notes, department_ids } = req.body;

    await db.prepare(`
      UPDATE suggested_ideas 
      SET flow_name = COALESCE(?, flow_name),
          idea_notes = COALESCE(?, idea_notes)
      WHERE id = ?
    `).run(
      flow_name || null,
      idea_notes !== undefined ? idea_notes : null,
      suggestionId
    );

    // Update departments if provided
    if (department_ids !== undefined) {
      await setSuggestedIdeaDepartments(suggestionId, department_ids);
    }

    const updatedSuggestion = await db.prepare(`
      SELECT si.*, 
             u1.username as suggested_by_name,
             u1.handle as suggested_by_handle,
             u2.username as reviewed_by_name,
             u2.handle as reviewed_by_handle
      FROM suggested_ideas si
      LEFT JOIN users u1 ON si.suggested_by = u1.id
      LEFT JOIN users u2 ON si.reviewed_by = u2.id
      WHERE si.id = ?
    `).get(suggestionId);

    updatedSuggestion.departments = await getSuggestedIdeaDepartments(suggestionId);

    emitToAll('suggestion:updated', updatedSuggestion);

    res.json(updatedSuggestion);
  } catch (error) {
    console.error('Update suggestion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete suggestion (only by creator if pending, or admin)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const suggestionId = req.params.id;
    const suggestion = await db.prepare('SELECT * FROM suggested_ideas WHERE id = ?').get(suggestionId);

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    // Only the creator can delete their pending suggestions, admins can delete any
    if (req.user.role !== 'admin') {
      if (suggestion.suggested_by !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (suggestion.status !== 'pending') {
        return res.status(400).json({ error: 'Cannot delete a suggestion that has already been reviewed' });
      }
    }

    // Delete departments first
    await db.prepare('DELETE FROM suggested_idea_departments WHERE suggested_idea_id = ?').run(suggestionId);
    
    // Delete the suggestion
    await db.prepare('DELETE FROM suggested_ideas WHERE id = ?').run(suggestionId);

    emitToAll('suggestion:deleted', { id: parseInt(suggestionId) });

    res.json({ message: 'Suggestion deleted successfully' });
  } catch (error) {
    console.error('Delete suggestion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve suggestion (admin only) - creates an idea from the suggestion and assigns it to the suggester
router.post('/:id/approve', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const suggestionId = req.params.id;
    const { review_note } = req.body;

    const suggestion = await db.prepare(`
      SELECT si.*, u.username as suggested_by_name
      FROM suggested_ideas si
      LEFT JOIN users u ON si.suggested_by = u.id
      WHERE si.id = ?
    `).get(suggestionId);

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    if (suggestion.status !== 'pending') {
      return res.status(400).json({ error: 'This suggestion has already been reviewed' });
    }

    // Get departments for the suggestion
    const departments = await getSuggestedIdeaDepartments(suggestionId);
    const departmentIds = departments.map(d => d.id);

    // Create a new idea from the suggestion - automatically assigned to the suggester
    const ideaResult = await db.prepare(`
      INSERT INTO ideas (
        flow_name,
        idea_notes,
        status,
        created_by,
        assigned_to
      )
      VALUES (?, ?, 'assigned', ?, ?)
    `).run(
      suggestion.flow_name,
      suggestion.idea_notes || '',
      req.user.id,
      suggestion.suggested_by  // Assign to the person who suggested it
    );

    const newIdeaId = ideaResult.lastInsertRowid;

    // Copy departments to the new idea
    if (departmentIds.length > 0) {
      await setIdeaDepartments(newIdeaId, departmentIds);
    }

    // Update the suggestion as approved
    await db.prepare(`
      UPDATE suggested_ideas 
      SET status = 'approved',
          reviewed_by = ?,
          review_note = ?,
          converted_idea_id = ?,
          reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.user.id, review_note || '', newIdeaId, suggestionId);

    // Notify the suggester that their suggestion was approved and assigned to them
    createNotification(
      suggestion.suggested_by,
      'suggestion',
      '✅ Suggestion Approved & Assigned!',
      `Your suggestion "${suggestion.flow_name}" has been approved and assigned to you!`,
      newIdeaId,
      req.user.id
    );

    // Fetch the updated suggestion
    const updatedSuggestion = await db.prepare(`
      SELECT si.*, 
             u1.username as suggested_by_name,
             u1.handle as suggested_by_handle,
             u2.username as reviewed_by_name,
             u2.handle as reviewed_by_handle
      FROM suggested_ideas si
      LEFT JOIN users u1 ON si.suggested_by = u1.id
      LEFT JOIN users u2 ON si.reviewed_by = u2.id
      WHERE si.id = ?
    `).get(suggestionId);

    updatedSuggestion.departments = departments;

    // Fetch the created idea with departments
    const newIdea = await db.prepare(`
      SELECT i.*, 
             u1.username as created_by_name,
             u2.username as assigned_to_name
      FROM ideas i
      LEFT JOIN users u1 ON i.created_by = u1.id
      LEFT JOIN users u2 ON i.assigned_to = u2.id
      WHERE i.id = ?
    `).get(newIdeaId);

    // Get departments for the new idea
    const ideaDepts = await db.prepare(`
      SELECT d.id, d.name, d.description, d.display_order
      FROM departments d
      INNER JOIN idea_departments id ON d.id = id.department_id
      WHERE id.idea_id = ?
      ORDER BY d.display_order, d.name
    `).all(newIdeaId);
    newIdea.departments = ideaDepts;

    // Emit events
    emitToAll('suggestion:approved', updatedSuggestion);
    emitToAll('idea:created', newIdea);
    emitToUser(suggestion.suggested_by, 'suggestion:approved', updatedSuggestion);

    res.json({
      suggestion: updatedSuggestion,
      idea: newIdea
    });
  } catch (error) {
    console.error('Approve suggestion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Deny suggestion (admin only)
router.post('/:id/deny', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const suggestionId = req.params.id;
    const { review_note } = req.body;

    const suggestion = await db.prepare('SELECT * FROM suggested_ideas WHERE id = ?').get(suggestionId);

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    if (suggestion.status !== 'pending') {
      return res.status(400).json({ error: 'This suggestion has already been reviewed' });
    }

    // Update the suggestion as denied
    await db.prepare(`
      UPDATE suggested_ideas 
      SET status = 'denied',
          reviewed_by = ?,
          review_note = ?,
          reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.user.id, review_note || '', suggestionId);

    // Notify the suggester
    createNotification(
      suggestion.suggested_by,
      'suggestion',
      '❌ Suggestion Not Approved',
      `Your suggestion "${suggestion.flow_name}" was not approved.${review_note ? ' Note: ' + review_note : ''}`,
      null,
      req.user.id
    );

    // Fetch the updated suggestion
    const updatedSuggestion = await db.prepare(`
      SELECT si.*, 
             u1.username as suggested_by_name,
             u1.handle as suggested_by_handle,
             u2.username as reviewed_by_name,
             u2.handle as reviewed_by_handle
      FROM suggested_ideas si
      LEFT JOIN users u1 ON si.suggested_by = u1.id
      LEFT JOIN users u2 ON si.reviewed_by = u2.id
      WHERE si.id = ?
    `).get(suggestionId);

    updatedSuggestion.departments = await getSuggestedIdeaDepartments(suggestionId);

    emitToAll('suggestion:denied', updatedSuggestion);
    emitToUser(suggestion.suggested_by, 'suggestion:denied', updatedSuggestion);

    res.json(updatedSuggestion);
  } catch (error) {
    console.error('Deny suggestion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get suggestion stats (admin only)
router.get('/stats/summary', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const stats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END) as denied
      FROM suggested_ideas
    `).get();

    // Get top suggesters
    const topSuggesters = await db.prepare(`
      SELECT 
        u.id,
        u.username,
        COUNT(si.id) as suggestion_count,
        SUM(CASE WHEN si.status = 'approved' THEN 1 ELSE 0 END) as approved_count
      FROM users u
      INNER JOIN suggested_ideas si ON u.id = si.suggested_by
      GROUP BY u.id, u.username
      ORDER BY approved_count DESC, suggestion_count DESC
      LIMIT 5
    `).all();

    res.json({
      stats,
      topSuggesters
    });
  } catch (error) {
    console.error('Get suggestion stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

