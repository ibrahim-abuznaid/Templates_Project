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

// Helper function to get departments for an idea
const getIdeaDepartments = async (ideaId) => {
  const departments = await db.prepare(`
    SELECT d.id, d.name, d.description, d.display_order
    FROM departments d
    INNER JOIN idea_departments id ON d.id = id.department_id
    WHERE id.idea_id = ?
    ORDER BY d.display_order, d.name
  `).all(ideaId);
  return departments;
};

// Helper function to set departments for an idea
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

// Public Library API configuration
// API endpoint: https://cloud.activepieces.com/api/v1/admin/templates
const PUBLIC_LIBRARY_API_URL = process.env.PUBLIC_LIBRARY_API_URL || 'https://cloud.activepieces.com/api/v1/admin/templates';
const PUBLIC_LIBRARY_API_KEY = process.env.PUBLIC_LIBRARY_API_KEY || '';

// Valid template categories from Activepieces API
const VALID_TEMPLATE_CATEGORIES = [
  'ANALYTICS',
  'COMMUNICATION',
  'CONTENT',
  'CUSTOMER_SUPPORT',
  'DEVELOPMENT',
  'E_COMMERCE',
  'FINANCE',
  'HR',
  'IT_OPERATIONS',
  'MARKETING',
  'PRODUCTIVITY',
  'SALES'
];

// Map department names to valid API categories
const mapDepartmentToCategory = (departmentName) => {
  if (!departmentName) return null;
  
  const normalized = departmentName.toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_');
  
  // Direct match
  if (VALID_TEMPLATE_CATEGORIES.includes(normalized)) {
    return normalized;
  }
  
  // Common mappings
  const mappings = {
    'CUSTOMER_SERVICE': 'CUSTOMER_SUPPORT',
    'SUPPORT': 'CUSTOMER_SUPPORT',
    'HUMAN_RESOURCES': 'HR',
    'DEV': 'DEVELOPMENT',
    'ENGINEERING': 'DEVELOPMENT',
    'ECOMMERCE': 'E_COMMERCE',
    'E-COMMERCE': 'E_COMMERCE',
    'SHOP': 'E_COMMERCE',
    'STORE': 'E_COMMERCE',
    'IT': 'IT_OPERATIONS',
    'OPERATIONS': 'IT_OPERATIONS',
    'OPS': 'IT_OPERATIONS',
    'DEVOPS': 'IT_OPERATIONS',
    'ADVERTISING': 'MARKETING',
    'ADS': 'MARKETING',
    'CRM': 'SALES',
    'QA': 'DEVELOPMENT',
    'TESTING': 'DEVELOPMENT',
    'SECURITY': 'IT_OPERATIONS',
    'DATA': 'ANALYTICS',
    'REPORTING': 'ANALYTICS',
    'DOCS': 'CONTENT',
    'DOCUMENTATION': 'CONTENT',
    'WRITING': 'CONTENT',
    'EMAIL': 'COMMUNICATION',
    'MESSAGING': 'COMMUNICATION',
    'CHAT': 'COMMUNICATION',
    'AUTOMATION': 'PRODUCTIVITY',
    'WORKFLOW': 'PRODUCTIVITY',
    'GENERAL': 'PRODUCTIVITY'
  };
  
  return mappings[normalized] || 'PRODUCTIVITY'; // Default to PRODUCTIVITY
};

// Build the publish request body based on the template data
const buildPublishRequestBody = async (idea) => {
  // Parse flow JSON if available
  let flows = [];
  if (idea.flow_json) {
    try {
      const parsedFlows = JSON.parse(idea.flow_json);
      flows = Array.isArray(parsedFlows) ? parsedFlows : [parsedFlows];
    } catch (error) {
      console.error('Failed to parse flow JSON:', error);
    }
  }

  // Build tags array from time_save_per_week and cost_per_year
  const tags = [];
  if (idea.cost_per_year) {
    tags.push({
      title: idea.cost_per_year,
      color: "#e4fded"
    });
  }
  if (idea.time_save_per_week) {
    tags.push({
      title: idea.time_save_per_week,
      color: "#dbeaff"
    });
  }

  // Get departments for this idea and map them to valid API categories
  const departments = await getIdeaDepartments(idea.id);
  let categories = [];
  
  if (departments.length > 0) {
    // Map each department to a valid category
    categories = departments
      .map(d => mapDepartmentToCategory(d.name))
      .filter((cat, index, arr) => cat && arr.indexOf(cat) === index); // Remove nulls and duplicates
  }
  
  // Default to PRODUCTIVITY if no valid categories found
  if (categories.length === 0) {
    categories = ['PRODUCTIVITY'];
  }

  return {
    name: idea.flow_name || 'Untitled Template',
    summary: idea.summary || '',
    description: idea.description || '',
    tags: tags,
    blogUrl: idea.scribe_url || '', // scribe_url is sent as blogUrl
    author: idea.author || 'Activepieces Team',
    categories: categories,
    type: 'OFFICIAL',
    flows: flows
  };
};

// Publish template to Public Library API (Create Official Template)
// POST https://cloud.activepieces.com/api/v1/admin/templates
const publishToPublicLibrary = async (idea) => {
  console.log('📚 [PUBLIC LIBRARY API] Publishing template:', {
    id: idea.id,
    flow_name: idea.flow_name
  });

  const requestBody = await buildPublishRequestBody(idea);
  console.log('📚 [PUBLIC LIBRARY API] Request body:', JSON.stringify(requestBody, null, 2));

  // If no API key is configured, use mock mode
  if (!PUBLIC_LIBRARY_API_KEY) {
    console.log('📚 [PUBLIC LIBRARY API] Running in mock mode (no API key configured)');
    const mockId = `pl_${idea.id}_${Date.now()}`;
    console.log('📚 [PUBLIC LIBRARY API] Mock template published with ID:', mockId);
    return mockId;
  }

  try {
    const response = await fetch(PUBLIC_LIBRARY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'templates-api-key': PUBLIC_LIBRARY_API_KEY
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API responded with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('📚 [PUBLIC LIBRARY API] Template published successfully with ID:', data.id);
    return data.id;
  } catch (error) {
    console.error('📚 [PUBLIC LIBRARY API] Failed to publish:', error);
    throw error;
  }
};

// Change template status in Public Library (PUBLISH/ARCHIVED)
// PATCH https://cloud.activepieces.com/api/v1/admin/templates/{template-id}
const changePublicLibraryStatus = async (publicLibraryId, status) => {
  // Status should be 'PUBLISH' or 'ARCHIVED' (not 'PUBLISHED')
  const apiStatus = status === 'PUBLISHED' ? 'PUBLISH' : status;
  console.log('📚 [PUBLIC LIBRARY API] Changing status for template:', publicLibraryId, 'to:', apiStatus);

  // If no API key is configured, use mock mode
  if (!PUBLIC_LIBRARY_API_KEY) {
    console.log('📚 [PUBLIC LIBRARY API] Running in mock mode (no API key configured)');
    console.log('📚 [PUBLIC LIBRARY API] Mock status changed to:', apiStatus);
    return true;
  }

  try {
    const response = await fetch(`${PUBLIC_LIBRARY_API_URL}/${publicLibraryId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'templates-api-key': PUBLIC_LIBRARY_API_KEY
      },
      body: JSON.stringify({ status: apiStatus })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API responded with status ${response.status}: ${errorText}`);
    }

    console.log('📚 [PUBLIC LIBRARY API] Status changed successfully');
    return true;
  } catch (error) {
    console.error('📚 [PUBLIC LIBRARY API] Failed to change status:', error);
    throw error;
  }
};

// Archive template in Public Library
const archiveInPublicLibrary = async (publicLibraryId) => {
  return changePublicLibraryStatus(publicLibraryId, 'ARCHIVED');
};

// Republish template in Public Library
const republishInPublicLibrary = async (publicLibraryId) => {
  return changePublicLibraryStatus(publicLibraryId, 'PUBLISH');
};

// Update published template in Public Library (Update Official Template)
// PATCH https://cloud.activepieces.com/api/v1/admin/templates/{template-id}
const updatePublicLibraryTemplate = async (publicLibraryId, idea) => {
  console.log('📚 [PUBLIC LIBRARY API] Updating published template:', publicLibraryId);

  const requestBody = await buildPublishRequestBody(idea);
  // Remove 'type' field for updates as it's only for creation
  delete requestBody.type;
  
  console.log('📚 [PUBLIC LIBRARY API] Update request body:', JSON.stringify(requestBody, null, 2));

  // If no API key is configured, use mock mode
  if (!PUBLIC_LIBRARY_API_KEY) {
    console.log('📚 [PUBLIC LIBRARY API] Running in mock mode (no API key configured)');
    console.log('📚 [PUBLIC LIBRARY API] Mock template updated successfully');
    return true;
  }

  try {
    // PATCH to /templates/{public_library_id} to update the template
    const response = await fetch(`${PUBLIC_LIBRARY_API_URL}/${publicLibraryId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'templates-api-key': PUBLIC_LIBRARY_API_KEY
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API responded with status ${response.status}: ${errorText}`);
    }

    console.log('📚 [PUBLIC LIBRARY API] Template updated successfully');
    return true;
  } catch (error) {
    console.error('📚 [PUBLIC LIBRARY API] Failed to update template:', error);
    throw error;
  }
};

// Delete template from Public Library
// DELETE https://cloud.activepieces.com/api/v1/admin/templates/{template-id}
const deleteFromPublicLibrary = async (publicLibraryId) => {
  console.log('📚 [PUBLIC LIBRARY API] Deleting template:', publicLibraryId);

  // If no API key is configured, use mock mode
  if (!PUBLIC_LIBRARY_API_KEY) {
    console.log('📚 [PUBLIC LIBRARY API] Running in mock mode (no API key configured)');
    console.log('📚 [PUBLIC LIBRARY API] Mock template deleted successfully');
    return true;
  }

  try {
    const response = await fetch(`${PUBLIC_LIBRARY_API_URL}/${publicLibraryId}`, {
      method: 'DELETE',
      headers: {
        'templates-api-key': PUBLIC_LIBRARY_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API responded with status ${response.status}: ${errorText}`);
    }

    console.log('📚 [PUBLIC LIBRARY API] Template deleted successfully');
    return true;
  } catch (error) {
    console.error('📚 [PUBLIC LIBRARY API] Failed to delete template:', error);
    throw error;
  }
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

    // Fetch departments for each idea
    for (const idea of ideas) {
      idea.departments = await getIdeaDepartments(idea.id);
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

    // Fetch departments for this idea
    idea.departments = await getIdeaDepartments(idea.id);

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
      flow_name,
      summary,
      description, 
      department_ids,
      time_save_per_week,
      cost_per_year,
      author,
      idea_notes,
      scribe_url,
      reviewer_name,
      price,
      // Deprecated fields for backward compatibility
      use_case,
      short_description,
      department,
      tags
    } = req.body;

    if (!flow_name) {
      return res.status(400).json({ error: 'Flow name is required' });
    }

    const result = await db.prepare(`
      INSERT INTO ideas (
        flow_name,
        summary,
        description, 
        time_save_per_week,
        cost_per_year,
        author,
        idea_notes,
        scribe_url,
        reviewer_name, 
        price, 
        created_by, 
        status,
        use_case,
        short_description,
        department,
        tags
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?)
    `).run(
      flow_name,
      summary || '',
      description || '', 
      time_save_per_week || '',
      cost_per_year || '',
      author || 'Activepieces Team',
      idea_notes || '',
      scribe_url || '',
      reviewer_name || '', 
      price || 0, 
      req.user.id,
      use_case || flow_name, // Default use_case to flow_name for backward compatibility
      short_description || summary || '',
      department || '',
      tags || ''
    );

    const ideaId = result.lastInsertRowid;

    // Set departments if provided
    if (department_ids && department_ids.length > 0) {
      await setIdeaDepartments(ideaId, department_ids);
    }

    await logActivity(ideaId, req.user.id, 'created', 'Template created');

    const newIdea = await db.prepare(`
      SELECT i.*, u.username as created_by_name
      FROM ideas i
      LEFT JOIN users u ON i.created_by = u.id
      WHERE i.id = ?
    `).get(ideaId);

    // Fetch departments for the new idea
    newIdea.departments = await getIdeaDepartments(ideaId);

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
    const updates = { ...req.body };
    const department_ids = updates.department_ids;
    delete updates.department_ids; // Remove from updates object
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

    // Update departments if provided
    if (department_ids !== undefined) {
      await setIdeaDepartments(ideaId, department_ids);
    }

    if (Object.keys(updates).length > 0) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');

    await db.prepare(`
      UPDATE ideas 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${fields.length + 1}
    `).run(...values, ideaId);
    }

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
      
      // Handle publishing to Public Library
      if (updates.status === 'published') {
        try {
          // Get the latest idea data with all fields
          const currentIdea = await db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);
          
          if (currentIdea.public_library_id) {
            // Template was previously published, republish it (change status back to published)
            await republishInPublicLibrary(currentIdea.public_library_id);
            console.log('📚 Template republished successfully');
          } else {
            // First time publishing, create new entry in Public Library
            const publicLibraryId = await publishToPublicLibrary(currentIdea);
            await db.prepare(`
              UPDATE ideas SET public_library_id = ? WHERE id = ?
            `).run(publicLibraryId, ideaId);
            console.log('📚 Template published successfully with ID:', publicLibraryId);
          }
        } catch (error) {
          console.error('Failed to publish to Public Library:', error);
          // Don't fail the whole operation, just log the error
        }
      }
      
      // Handle archiving in Public Library
      if (updates.status === 'archived' && idea.public_library_id) {
        try {
          // Archive the template (don't delete, just change status)
          await archiveInPublicLibrary(idea.public_library_id);
          console.log('📚 Template archived in Public Library');
          // Note: We keep the public_library_id so we can republish later
        } catch (error) {
          console.error('Failed to archive in Public Library:', error);
          // Don't fail the whole operation, just log the error
        }
      }
    }
    
    // Note: Updates to published templates are NOT automatically synced to Public Library.
    // Use the POST /ideas/:id/sync-public-library endpoint to manually sync.

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

    // Fetch departments for the updated idea
    updatedIdea.departments = await getIdeaDepartments(ideaId);

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
    
    // Check if idea exists and get public_library_id
    const idea = await db.prepare('SELECT id, public_library_id, flow_name FROM ideas WHERE id = ?').get(ideaId);
    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    // If the template was published to Public Library, delete it from there first
    let publicLibraryDeleted = false;
    if (idea.public_library_id) {
      try {
        await deleteFromPublicLibrary(idea.public_library_id);
        publicLibraryDeleted = true;
        console.log('📚 Template deleted from Public Library:', idea.public_library_id);
      } catch (error) {
        console.error('📚 Failed to delete from Public Library:', error);
        // Continue with local deletion even if public library deletion fails
      }
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
    
    // 7. Delete idea departments
    await db.prepare('DELETE FROM idea_departments WHERE idea_id = ?').run(ideaId);
    
    // 8. Finally, delete the idea itself
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
        idea: ideaId,
        publicLibraryDeleted: publicLibraryDeleted
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

// Get all admins (for reviewer dropdown)
router.get('/users/admins', authenticateToken, async (req, res) => {
  try {
    const admins = await db.prepare(`
      SELECT id, username, email
      FROM users
      WHERE role = 'admin'
      ORDER BY username
    `).all();

    res.json(admins);
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload flow JSON for a template
router.post('/:id/flow-json', authenticateToken, async (req, res) => {
  try {
    const ideaId = req.params.id;
    const { flow_json } = req.body;

    const idea = await db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);

    if (!idea) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check permissions - admin or assigned freelancer can upload
    const { role, id: userId } = req.user;
    if (role === 'freelancer' && idea.assigned_to !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate JSON
    if (flow_json) {
      try {
        JSON.parse(flow_json);
      } catch (parseError) {
        return res.status(400).json({ error: 'Invalid JSON format' });
      }
    }

    await db.prepare(`
      UPDATE ideas SET flow_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(flow_json || null, ideaId);

    await logActivity(ideaId, userId, 'updated', 'Flow JSON uploaded');

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

    updatedIdea.departments = await getIdeaDepartments(ideaId);

    emitToAll('idea:updated', updatedIdea);
    emitToIdea(ideaId, 'idea:updated', updatedIdea);

    res.json(updatedIdea);
  } catch (error) {
    console.error('Upload flow JSON error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get publish request preview (shows what would be sent to Public Library API)
router.get('/:id/publish-preview', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const ideaId = req.params.id;
    const idea = await db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);

    if (!idea) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const publishRequestBody = await buildPublishRequestBody(idea);
    
    res.json({
      template_id: idea.id,
      public_library_id: idea.public_library_id,
      is_published: idea.status === 'published',
      publish_request: publishRequestBody
    });
  } catch (error) {
    console.error('Publish preview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sync/update a published template in Public Library (admin only)
router.post('/:id/sync-public-library', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const ideaId = req.params.id;
    const idea = await db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);

    if (!idea) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (!idea.public_library_id) {
      return res.status(400).json({ error: 'Template is not published yet. Use status change to publish first.' });
    }

    if (idea.status !== 'published') {
      return res.status(400).json({ error: 'Template is not in published status. Current status: ' + idea.status });
    }

    // Update the template in Public Library
    await updatePublicLibraryTemplate(idea.public_library_id, idea);

    await logActivity(ideaId, req.user.id, 'synced', 'Template synced with Public Library');

    res.json({
      success: true,
      message: 'Template successfully synced with Public Library',
      public_library_id: idea.public_library_id
    });
  } catch (error) {
    console.error('Sync to Public Library error:', error);
    res.status(500).json({ error: 'Failed to sync template with Public Library: ' + error.message });
  }
});

export default router;
