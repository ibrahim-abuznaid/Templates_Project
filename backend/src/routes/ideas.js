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

// ========================================
// Format Normalization Helpers
// ========================================

/**
 * Normalize cost/money saving to "$X/year" format
 * Handles various input formats:
 * - "150" -> "$150/year"
 * - "$150" -> "$150/year"
 * - "150/year" -> "$150/year"
 * - "$150/year" -> "$150/year"
 * - "150 per year" -> "$150/year"
 * - "150/yr" -> "$150/year"
 * - "$1,500" -> "$1,500/year"
 * - "1500" -> "$1,500/year"
 */
const normalizeCostPerYear = (value) => {
  if (!value || typeof value !== 'string') return value;
  
  // Already correctly formatted
  if (/^\$[\d,]+\/year$/i.test(value.trim())) {
    return value.trim();
  }
  
  // Extract numeric value (handles commas)
  const numericMatch = value.replace(/,/g, '').match(/[\d.]+/);
  if (!numericMatch) return value; // Can't parse, return as-is
  
  const numericValue = parseFloat(numericMatch[0]);
  if (isNaN(numericValue)) return value;
  
  // Format with commas for thousands
  const formattedNumber = numericValue.toLocaleString('en-US', { 
    maximumFractionDigits: 0 
  });
  
  return `$${formattedNumber}/year`;
};

/**
 * Normalize time saving to "X hours" or "X minutes" format
 * Handles various input formats:
 * - "2" -> "2 hours"
 * - "2h" -> "2 hours"
 * - "2 hrs" -> "2 hours"
 * - "2 hours" -> "2 hours"
 * - "2hours" -> "2 hours"
 * - "30 min" -> "30 minutes"
 * - "30m" -> "30 minutes"
 * - "1.5 hours" -> "1.5 hours"
 * - "90 minutes" -> "90 minutes"
 */
const normalizeTimeSavePerWeek = (value) => {
  if (!value || typeof value !== 'string') return value;
  
  const trimmed = value.trim().toLowerCase();
  
  // Already correctly formatted
  if (/^[\d.]+\s+(hours?|minutes?)$/i.test(trimmed)) {
    // Just fix capitalization and spacing
    const match = trimmed.match(/^([\d.]+)\s*(hours?|minutes?)$/i);
    if (match) {
      const num = match[1];
      const unit = match[2].toLowerCase();
      const normalizedUnit = unit.startsWith('hour') 
        ? (parseFloat(num) === 1 ? 'hour' : 'hours')
        : (parseFloat(num) === 1 ? 'minute' : 'minutes');
      return `${num} ${normalizedUnit}`;
    }
  }
  
  // Try to extract number and determine unit
  const numericMatch = trimmed.match(/^([\d.]+)/);
  if (!numericMatch) return value; // Can't parse, return as-is
  
  const numericValue = parseFloat(numericMatch[1]);
  if (isNaN(numericValue)) return value;
  
  // Check for minute indicators
  const isMinutes = /min|m$|mins/i.test(trimmed);
  
  // Check for hour indicators or default to hours
  const isHours = /hour|hr|hrs|h$|h\s/i.test(trimmed) || !isMinutes;
  
  if (isMinutes) {
    const unit = numericValue === 1 ? 'minute' : 'minutes';
    return `${numericValue} ${unit}`;
  } else {
    const unit = numericValue === 1 ? 'hour' : 'hours';
    return `${numericValue} ${unit}`;
  }
};

// Helper function to notify assignee about status changes
const notifyStatusChange = (idea, newStatus, changedByUserId) => {
  if (!idea.assigned_to || idea.assigned_to === changedByUserId) return;
  
  const statusMessages = {
    'needs_fixes': 'Your submission needs fixes',
    'assigned': 'You have been assigned a new template',
    'reviewed': 'Your template has been reviewed',
    'published': 'Your template has been published'
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

// Send department name directly to Public Library (no conversion)
// The category name must match exactly what was synced via the categories endpoint
const mapDepartmentToCategory = (departmentName) => {
  if (!departmentName) return null;
  
  // Return department name as-is (must match what was synced to categories)
  // "Legal" -> "Legal"
  // "Customer Service" -> "Customer Service"
  return departmentName;
};

// Extract flows array from uploaded flow JSON
// Valid formats:
// 1. Our storage format with { _flowCount, flows: [...] }
// 2. A full template export with { name, type, flows: [...], ... }
// Returns: { success: true, flows: [...] } or { success: false, error: string }
const extractFlowsFromJson = (flowJson) => {
  if (!flowJson) {
    console.log('📚 [FLOW PARSER] Empty flowJson received');
    return { success: false, error: 'Empty file' };
  }
  
  try {
    const parsed = JSON.parse(flowJson);
    
    console.log('📚 [FLOW PARSER] Parsed JSON type:', typeof parsed, 'isArray:', Array.isArray(parsed));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      console.log('📚 [FLOW PARSER] Object keys:', Object.keys(parsed).slice(0, 10).join(', '));
    }
    
    // Case 1: Our storage format (has _flowCount property)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed._flowCount !== undefined && parsed.flows) {
      const flows = Array.isArray(parsed.flows) ? parsed.flows : [parsed.flows];
      console.log(`📚 [FLOW PARSER] Extracted ${flows.length} flows from storage format`);
      return { success: true, flows };
    }
    
    // Case 2: Full template export object with flows property
    // This is the required format: { name, type, flows: [...], ... }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.flows) {
      const flows = Array.isArray(parsed.flows) ? parsed.flows : [parsed.flows];
      console.log(`📚 [FLOW PARSER] Extracted ${flows.length} flows from template export`);
      return { success: true, flows };
    }
    
    // Invalid format - file must have a "flows" array
    console.log('📚 [FLOW PARSER] Invalid format - file must contain a "flows" array');
    return { 
      success: false, 
      error: 'Invalid file format. File must be a template export with a "flows" array. Export your flow from Activepieces using the template export option.'
    };
  } catch (error) {
    console.error('📚 [FLOW PARSER] Failed to parse flow JSON:', error.message);
    return { success: false, error: 'Invalid JSON format' };
  }
};

// Get the flow count from stored flow_json
const getFlowCount = (flowJson) => {
  if (!flowJson) return 0;
  try {
    const parsed = JSON.parse(flowJson);
    if (parsed._flowCount !== undefined) {
      return parsed._flowCount;
    }
    // For legacy data, extract flows and count them
    const result = extractFlowsFromJson(flowJson);
    return result.success ? result.flows.length : 0;
  } catch {
    return 0;
  }
};

// Build the publish request body based on the template data
const buildPublishRequestBody = async (idea) => {
  // Parse flow JSON if available - extract only the flows array
  const result = extractFlowsFromJson(idea.flow_json);
  const flows = result.success ? result.flows : [];

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

// Change template status in Public Library (PUBLISHED/ARCHIVED)
// POST https://cloud.activepieces.com/api/v1/admin/templates/{template-id}
const changePublicLibraryStatus = async (publicLibraryId, status) => {
  // API expects 'PUBLISHED' or 'ARCHIVED' (uppercase with full word)
  // Map our internal status to API status
  let apiStatus = status;
  if (status === 'PUBLISH' || status === 'PUBLISHED' || status === 'published') {
    apiStatus = 'PUBLISHED';  // API expects PUBLISHED not PUBLISH
  } else if (status === 'ARCHIVED' || status === 'archived') {
    apiStatus = 'ARCHIVED';
  }
  
  console.log('📚 [PUBLIC LIBRARY API] Changing status for template:', publicLibraryId);
  console.log('📚 [PUBLIC LIBRARY API] Input status:', status, '-> API status:', apiStatus);

  // If no API key is configured, use mock mode
  if (!PUBLIC_LIBRARY_API_KEY) {
    console.log('📚 [PUBLIC LIBRARY API] Running in mock mode (no API key configured)');
    console.log('📚 [PUBLIC LIBRARY API] Mock status changed to:', apiStatus);
    return true;
  }

  try {
    const requestBody = { status: apiStatus };
    console.log('📚 [PUBLIC LIBRARY API] Request URL:', `${PUBLIC_LIBRARY_API_URL}/${publicLibraryId}`);
    console.log('📚 [PUBLIC LIBRARY API] Request body:', JSON.stringify(requestBody));
    
    const response = await fetch(`${PUBLIC_LIBRARY_API_URL}/${publicLibraryId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'templates-api-key': PUBLIC_LIBRARY_API_KEY
      },
      body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();
    console.log('📚 [PUBLIC LIBRARY API] Response status:', response.status);
    console.log('📚 [PUBLIC LIBRARY API] Response body:', responseText);

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}: ${responseText}`);
    }

    console.log('📚 [PUBLIC LIBRARY API] Status changed successfully to:', apiStatus);
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

// Republish template in Public Library (change status back to PUBLISHED)
const republishInPublicLibrary = async (publicLibraryId) => {
  return changePublicLibraryStatus(publicLibraryId, 'PUBLISHED');
};

// Update published template in Public Library (Update Official Template)
// POST https://cloud.activepieces.com/api/v1/admin/templates/{template-id}
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
    // POST to /templates/{public_library_id} to update the template
    const response = await fetch(`${PUBLIC_LIBRARY_API_URL}/${publicLibraryId}`, {
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

    // Normalize cost and time formats
    const normalizedTimeSave = normalizeTimeSavePerWeek(time_save_per_week);
    const normalizedCost = normalizeCostPerYear(cost_per_year);

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
      normalizedTimeSave || '',
      normalizedCost || '',
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

    // Normalize cost and time formats if provided
    if (updates.time_save_per_week !== undefined) {
      updates.time_save_per_week = normalizeTimeSavePerWeek(updates.time_save_per_week);
    }
    if (updates.cost_per_year !== undefined) {
      updates.cost_per_year = normalizeCostPerYear(updates.cost_per_year);
    }

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
      
      // Increment fix_count when marked as needs_fixes
      if (updates.status === 'needs_fixes') {
        await db.prepare(`
          UPDATE ideas SET fix_count = COALESCE(fix_count, 0) + 1 WHERE id = ?
        `).run(ideaId);
      }
      
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
        // Get the latest idea data with all fields
        const currentIdea = await db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);
        
        if (currentIdea.public_library_id) {
          // Template was previously published, just change status back to PUBLISHED
          console.log('📚 Attempting to republish template with Public Library ID:', currentIdea.public_library_id);
          await republishInPublicLibrary(currentIdea.public_library_id);
          console.log('📚 Template republished successfully');
        } else {
          // First time publishing, create new entry in Public Library
          console.log('📚 First time publishing template:', ideaId);
          const publicLibraryId = await publishToPublicLibrary(currentIdea);
          await db.prepare(`
            UPDATE ideas SET public_library_id = ? WHERE id = ?
          `).run(publicLibraryId, ideaId);
          console.log('📚 Template published successfully with ID:', publicLibraryId);
        }
      }
      
      // Handle archiving in Public Library
      if (updates.status === 'archived' && idea.public_library_id) {
        console.log('📚 Attempting to archive template with Public Library ID:', idea.public_library_id);
        // Archive the template (don't delete, just change status)
        await archiveInPublicLibrary(idea.public_library_id);
        console.log('📚 Template archived in Public Library');
        // Note: We keep the public_library_id so we can republish later
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

// Unassign from an idea (freelancers can unassign themselves, admins can unassign anyone)
router.post('/:id/unassign', authenticateToken, async (req, res) => {
  try {
    const ideaId = req.params.id;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    const idea = await db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);

    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    if (idea.assigned_to === null) {
      return res.status(400).json({ error: 'This template is not assigned to anyone' });
    }

    // Freelancers can only unassign themselves
    if (!isAdmin && idea.assigned_to !== userId) {
      return res.status(403).json({ error: 'You can only unassign yourself from templates' });
    }

    // Check if template is in a state that allows unassignment
    const nonUnassignableStatuses = ['published', 'reviewed'];
    if (nonUnassignableStatuses.includes(idea.status)) {
      return res.status(400).json({ error: `Cannot unassign from a template with status "${idea.status}"` });
    }

    // Get the previous assignee info for the activity log
    const previousAssignee = await db.prepare('SELECT username FROM users WHERE id = ?').get(idea.assigned_to);

    await db.prepare(`
      UPDATE ideas 
      SET assigned_to = NULL, status = 'new', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(ideaId);

    const actionMessage = isAdmin && idea.assigned_to !== userId
      ? `Admin ${req.user.username} unassigned ${previousAssignee?.username || 'user'}`
      : `${req.user.username} unassigned themselves`;

    await logActivity(ideaId, userId, 'unassigned', actionMessage);

    // Notify the previous assignee if admin unassigned them
    if (isAdmin && idea.assigned_to !== userId) {
      await createNotification(
        idea.assigned_to,
        'status',
        '🔓 Template Unassigned',
        `You have been unassigned from "${idea.flow_name || `Template #${idea.id}`}"`,
        idea.id,
        userId
      );
    }

    const updatedIdea = await db.prepare(`
      SELECT i.*, 
             u1.username as created_by_name,
             u2.username as assigned_to_name
      FROM ideas i
      LEFT JOIN users u1 ON i.created_by = u1.id
      LEFT JOIN users u2 ON i.assigned_to = u2.id
      WHERE i.id = ?
    `).get(ideaId);

    // Emit real-time event (idea now available again)
    emitToAll('idea:unassigned', updatedIdea);
    emitToFreelancers('idea:unassigned', updatedIdea);

    res.json(updatedIdea);
  } catch (error) {
    console.error('Unassign idea error:', error);
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
    const { comment, images } = req.body;
    const ideaId = req.params.id;

    if (!comment && (!images || images.length === 0)) {
      return res.status(400).json({ error: 'Comment or images are required' });
    }

    // Store images as JSON string if provided
    const imagesJson = images && images.length > 0 ? JSON.stringify(images) : null;

    const result = await db.prepare(`
      INSERT INTO comments (idea_id, user_id, comment, images)
      VALUES (?, ?, ?, ?)
    `).run(ideaId, req.user.id, comment || '', imagesJson);

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

// Edit comment (owner or admin)
router.put('/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    // Get the existing comment
    const existingComment = await db.prepare(`
      SELECT c.*, i.id as idea_id
      FROM comments c
      JOIN ideas i ON c.idea_id = i.id
      WHERE c.id = ?
    `).get(commentId);

    if (!existingComment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Check if user is owner or admin
    if (existingComment.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You can only edit your own comments' });
    }

    // Update comment
    await db.prepare(`
      UPDATE comments 
      SET comment = ?, edited_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(comment, commentId);

    // Get updated comment
    const updatedComment = await db.prepare(`
      SELECT c.*, u.username, u.handle
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(commentId);

    // Emit real-time update
    emitToIdea(existingComment.idea_id, 'comment:updated', { 
      ideaId: existingComment.idea_id, 
      comment: updatedComment 
    });

    res.json(updatedComment);
  } catch (error) {
    console.error('Edit comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete comment (owner or admin)
router.delete('/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;

    // Get the existing comment
    const existingComment = await db.prepare(`
      SELECT c.*, i.id as idea_id
      FROM comments c
      JOIN ideas i ON c.idea_id = i.id
      WHERE c.id = ?
    `).get(commentId);

    if (!existingComment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Check if user is owner or admin
    if (existingComment.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }

    // Delete comment
    await db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);

    // Emit real-time delete event
    emitToIdea(existingComment.idea_id, 'comment:deleted', { 
      ideaId: existingComment.idea_id, 
      commentId: parseInt(commentId) 
    });

    res.json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    console.error('Delete comment error:', error);
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
    
    // 8. Clear reference from suggested_ideas (if this idea was created from a suggestion)
    await db.prepare('UPDATE suggested_ideas SET converted_idea_id = NULL WHERE converted_idea_id = ?').run(ideaId);
    
    // 9. Finally, delete the idea itself
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

// Upload flow JSON for a template (supports multiple files)
// Accepts: { flow_json: string } for single file (backward compatible)
// Or: { flow_jsons: string[] } for multiple files
// Or: { flow_json: string, append: true } to add to existing flows
router.post('/:id/flow-json', authenticateToken, async (req, res) => {
  try {
    const ideaId = req.params.id;
    const { flow_json, flow_jsons, append } = req.body;

    const idea = await db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);

    if (!idea) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check permissions - admin or assigned freelancer can upload
    const { role, id: userId } = req.user;
    if (role === 'freelancer' && idea.assigned_to !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Collect all flows from the uploaded files
    let allFlows = [];
    const invalidFiles = [];
    
    console.log('📚 [FLOW UPLOAD] Received request:', {
      hasFlowJson: !!flow_json,
      hasFlowJsons: !!flow_jsons,
      flowJsonsLength: flow_jsons?.length,
      append: !!append
    });
    
    // If appending, start with existing flows
    if (append && idea.flow_json) {
      const result = extractFlowsFromJson(idea.flow_json);
      if (result.success) {
        console.log('📚 [FLOW UPLOAD] Starting with existing flows:', result.flows.length);
        allFlows = [...result.flows];
      }
    }

    // Handle multiple files (flow_jsons array)
    if (flow_jsons && Array.isArray(flow_jsons)) {
      console.log(`📚 [FLOW UPLOAD] Processing ${flow_jsons.length} files...`);
      for (let i = 0; i < flow_jsons.length; i++) {
        const jsonStr = flow_jsons[i];
        try {
          JSON.parse(jsonStr); // Validate JSON syntax
          const result = extractFlowsFromJson(jsonStr);
          
          if (result.success) {
            console.log(`📚 [FLOW UPLOAD] File ${i + 1}: extracted ${result.flows.length} flows`);
            allFlows.push(...result.flows);
          } else {
            console.log(`📚 [FLOW UPLOAD] File ${i + 1}: invalid format - ${result.error}`);
            invalidFiles.push({ index: i + 1, error: result.error });
          }
        } catch (parseError) {
          invalidFiles.push({ index: i + 1, error: 'Invalid JSON syntax' });
        }
      }
      
      // If any files were invalid, return error
      if (invalidFiles.length > 0) {
        const fileErrors = invalidFiles.map(f => `File ${f.index}: ${f.error}`).join('\n');
        return res.status(400).json({ 
          error: `Invalid file format`,
          details: fileErrors,
          invalidCount: invalidFiles.length,
          validCount: flow_jsons.length - invalidFiles.length
        });
      }
    }
    // Handle single file (flow_json string) - backward compatible
    else if (flow_json) {
      try {
        JSON.parse(flow_json); // Validate JSON syntax
        const result = extractFlowsFromJson(flow_json);
        
        if (result.success) {
          console.log(`📚 [FLOW UPLOAD] Single file: extracted ${result.flows.length} flows`);
          allFlows.push(...result.flows);
        } else {
          return res.status(400).json({ error: result.error });
        }
      } catch (parseError) {
        return res.status(400).json({ error: 'Invalid JSON format' });
      }
    }
    
    console.log(`📚 [FLOW UPLOAD] Total flows to store: ${allFlows.length}`);

    // Store as a wrapper object with flows array for consistency
    // This makes it easy to extract later and maintains the structure
    const storageData = allFlows.length > 0 ? JSON.stringify({
      _flowCount: allFlows.length,
      flows: allFlows
    }) : null;

    await db.prepare(`
      UPDATE ideas SET flow_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(storageData, ideaId);

    const flowCount = allFlows.length;
    await logActivity(ideaId, userId, 'updated', `Flow JSON uploaded (${flowCount} flow${flowCount !== 1 ? 's' : ''})`);

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

    res.json({
      ...updatedIdea,
      _flowCount: flowCount
    });
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

// Get full reconstructed template for download
// This reconstructs the full Activepieces template format from stored data
router.get('/:id/download-template', authenticateToken, async (req, res) => {
  try {
    const ideaId = req.params.id;
    const idea = await db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);

    if (!idea) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check permissions - admin or assigned freelancer can download
    const { role, id: userId } = req.user;
    if (role === 'freelancer' && idea.assigned_to !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Extract flows from stored data
    const result = extractFlowsFromJson(idea.flow_json);
    const flows = result.success ? result.flows : [];

    // Get departments for categories
    const departments = await getIdeaDepartments(idea.id);
    let categories = [];
    if (departments.length > 0) {
      categories = departments
        .map(d => mapDepartmentToCategory(d.name))
        .filter((cat, index, arr) => cat && arr.indexOf(cat) === index);
    }
    if (categories.length === 0) {
      categories = ['PRODUCTIVITY'];
    }

    // Build tags array
    const tags = [];
    if (idea.cost_per_year) {
      tags.push({ title: idea.cost_per_year, color: "#e4fded" });
    }
    if (idea.time_save_per_week) {
      tags.push({ title: idea.time_save_per_week, color: "#dbeaff" });
    }

    // Get pieces used in flows (extract from flow data)
    const pieces = new Set();
    for (const flow of flows) {
      // Extract pieces from trigger
      if (flow.trigger?.settings?.pieceName) {
        pieces.add(flow.trigger.settings.pieceName);
      }
      // Traverse actions to extract pieces
      let currentAction = flow.trigger?.nextAction;
      while (currentAction) {
        if (currentAction.settings?.pieceName) {
          pieces.add(currentAction.settings.pieceName);
        }
        currentAction = currentAction.nextAction;
      }
    }

    // Reconstruct full template format (matches Activepieces export format)
    const fullTemplate = {
      name: idea.flow_name || 'Untitled Template',
      type: idea.public_library_id ? 'OFFICIAL' : 'SHARED',
      summary: idea.summary || '',
      description: idea.description || '',
      tags: tags,
      author: idea.author || 'Activepieces Team',
      categories: categories,
      pieces: Array.from(pieces),
      status: idea.status === 'published' ? 'PUBLISHED' : 'DRAFT',
      blogUrl: idea.scribe_url || '',
      metadata: null,
      flows: flows
    };

    // Return the filename suggestion and the template data
    res.json({
      filename: `${(idea.flow_name || 'template').replace(/[^a-zA-Z0-9-_]/g, '-')}.json`,
      template: fullTemplate
    });
  } catch (error) {
    console.error('Download template error:', error);
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

// Helper function to validate template has all required fields for Public Library
const validateTemplateForPublicLibrary = (template) => {
  const missingFields = [];
  
  // Required fields for Public Library
  if (!template.flow_name || template.flow_name.trim() === '') {
    missingFields.push('flow_name');
  }
  if (!template.summary || template.summary.trim() === '') {
    missingFields.push('summary');
  }
  if (!template.description || template.description.trim() === '') {
    missingFields.push('description');
  }
  if (!template.flow_json || template.flow_json.trim() === '') {
    missingFields.push('flow_json');
  } else {
    // Validate flow_json is valid and has flows
    const result = extractFlowsFromJson(template.flow_json);
    if (!result.success || result.flows.length === 0) {
      missingFields.push('flow_json (invalid or empty)');
    }
  }
  
  return {
    valid: missingFields.length === 0,
    missingFields
  };
};

// Helper function for rate limiting - delay between API calls
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Bulk sync published templates to Public Library (admin only)
// SAFETY: Only updates existing templates (with public_library_id), does NOT create new ones
// Includes rate limiting and validation
router.post('/admin/sync-all-public-library', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    console.log('📚 [BULK SYNC] Starting bulk sync of published templates to Public Library...');
    console.log('📚 [BULK SYNC] Safety mode: Only updating existing templates (not creating new ones)');
    
    // Get only published templates that ALREADY have a public_library_id
    // This ensures we only UPDATE existing templates, never create new ones
    const publishedTemplates = await db.prepare(`
      SELECT * FROM ideas 
      WHERE status = 'published' 
        AND public_library_id IS NOT NULL 
        AND public_library_id != ''
      ORDER BY id
    `).all();

    // Also get count of published templates WITHOUT public_library_id (for info)
    const notInLibrary = await db.prepare(`
      SELECT COUNT(*) as count FROM ideas 
      WHERE status = 'published' 
        AND (public_library_id IS NULL OR public_library_id = '')
    `).get();

    console.log(`📚 [BULK SYNC] Found ${publishedTemplates.length} templates already in Public Library`);
    console.log(`📚 [BULK SYNC] ${notInLibrary.count} published templates are NOT in Public Library (will be skipped)`);

    const results = {
      total: publishedTemplates.length,
      synced: 0,
      skipped: 0,
      skippedValidation: 0,
      errors: 0,
      notInLibrary: notInLibrary.count,
      details: []
    };

    // Rate limiting: 500ms delay between API calls to avoid overwhelming the API
    const RATE_LIMIT_DELAY = 500;

    for (let i = 0; i < publishedTemplates.length; i++) {
      const template = publishedTemplates[i];
      
      // Validate template has all required fields
      const validation = validateTemplateForPublicLibrary(template);
      
      if (!validation.valid) {
        console.log(`📚 [BULK SYNC] Skipping template ${template.id}: Missing required fields: ${validation.missingFields.join(', ')}`);
        results.skippedValidation++;
        results.details.push({
          id: template.id,
          flow_name: template.flow_name,
          action: 'skipped',
          reason: `Missing fields: ${validation.missingFields.join(', ')}`
        });
        continue;
      }

      try {
        // Update the template in Public Library
        await updatePublicLibraryTemplate(template.public_library_id, template);
        results.synced++;
        results.details.push({
          id: template.id,
          flow_name: template.flow_name,
          action: 'updated',
          public_library_id: template.public_library_id
        });
        console.log(`📚 [BULK SYNC] [${i + 1}/${publishedTemplates.length}] Updated template ${template.id}: ${template.flow_name}`);
        
        // Rate limiting: wait before next request (skip for last item)
        if (i < publishedTemplates.length - 1) {
          await delay(RATE_LIMIT_DELAY);
        }
      } catch (error) {
        console.error(`📚 [BULK SYNC] Error syncing template ${template.id}:`, error.message);
        results.errors++;
        results.details.push({
          id: template.id,
          flow_name: template.flow_name,
          action: 'error',
          error: error.message
        });
      }
    }

    // Log the bulk sync activity
    await logActivity(null, req.user.id, 'bulk_sync_public_library', 
      `Bulk synced ${results.synced} templates to Public Library (${results.skippedValidation} skipped due to missing fields, ${results.errors} errors)`);

    console.log(`📚 [BULK SYNC] Completed: ${results.synced} synced, ${results.skippedValidation} skipped (validation), ${results.errors} errors`);

    res.json({
      success: true,
      message: `Successfully synced ${results.synced} templates to Public Library`,
      stats: {
        total: results.total,
        synced: results.synced,
        skippedValidation: results.skippedValidation,
        errors: results.errors,
        notInLibrary: results.notInLibrary
      },
      details: results.details
    });
  } catch (error) {
    console.error('Bulk sync to Public Library error:', error);
    res.status(500).json({ error: 'Failed to bulk sync templates: ' + error.message });
  }
});

// Quick Publish - Create and publish template in one step (admin only)
// This is a temporary/convenience endpoint to quickly import templates from external sources
router.post('/quick-publish', authenticateToken, authorizeRoles('admin'), async (req, res) => {
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
      assigned_to, // The user who created the template (freelancer)
      flow_json    // The flow JSON to publish
    } = req.body;

    if (!flow_name) {
      return res.status(400).json({ error: 'Flow name is required' });
    }

    if (!flow_json) {
      return res.status(400).json({ error: 'Flow JSON is required' });
    }

    // Validate and extract flows from the JSON
    const result = extractFlowsFromJson(flow_json);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Store flows in our format
    const storageData = JSON.stringify({
      _flowCount: result.flows.length,
      flows: result.flows
    });

    // Normalize cost and time formats
    const normalizedTimeSave = normalizeTimeSavePerWeek(time_save_per_week);
    const normalizedCost = normalizeCostPerYear(cost_per_year);

    // Create the template with 'published' status directly
    const insertResult = await db.prepare(`
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
        assigned_to,
        flow_json,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')
    `).run(
      flow_name,
      summary || '',
      description || '', 
      normalizedTimeSave || '',
      normalizedCost || '',
      author || 'Activepieces Team',
      idea_notes || '',
      scribe_url || '',
      reviewer_name || '', 
      price || 0, 
      req.user.id,
      assigned_to || null,
      storageData
    );

    const ideaId = insertResult.lastInsertRowid;

    // Set departments if provided
    if (department_ids && department_ids.length > 0) {
      await setIdeaDepartments(ideaId, department_ids);
    }

    // Get the full idea for publishing
    const idea = await db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);

    // Publish to Public Library
    let publicLibraryId = null;
    let publishError = null;
    
    try {
      publicLibraryId = await publishToPublicLibrary(idea);
      
      // Update the template with the public library ID
      await db.prepare(`
        UPDATE ideas SET public_library_id = ? WHERE id = ?
      `).run(publicLibraryId, ideaId);
      
      console.log('📚 Quick publish: Template published with ID:', publicLibraryId);
    } catch (error) {
      console.error('📚 Quick publish: Failed to publish to Public Library:', error);
      publishError = error.message;
      // Template is still created locally, just not published
    }

    await logActivity(ideaId, req.user.id, 'quick_published', 
      `Template quick published${publicLibraryId ? ' (ID: ' + publicLibraryId + ')' : ' (local only)'}`);

    const newIdea = await db.prepare(`
      SELECT i.*, 
             u1.username as created_by_name,
             u2.username as assigned_to_name
      FROM ideas i
      LEFT JOIN users u1 ON i.created_by = u1.id
      LEFT JOIN users u2 ON i.assigned_to = u2.id
      WHERE i.id = ?
    `).get(ideaId);

    // Fetch departments for the new idea
    newIdea.departments = await getIdeaDepartments(ideaId);

    // Emit real-time event for new idea
    emitToAll('idea:created', newIdea);

    res.status(201).json({
      ...newIdea,
      _flowCount: result.flows.length,
      _publishedToLibrary: !!publicLibraryId,
      _publishError: publishError
    });
  } catch (error) {
    console.error('Quick publish error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Delete template from Public Library only (admin only)
// This removes from Public Library but keeps the template in local system
router.delete('/:id/public-library', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const ideaId = req.params.id;
    const idea = await db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);

    if (!idea) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (!idea.public_library_id) {
      return res.status(400).json({ error: 'Template is not published to the Public Library' });
    }

    // Delete from Public Library
    await deleteFromPublicLibrary(idea.public_library_id);

    // Clear the public_library_id from local database
    await db.prepare(`
      UPDATE ideas 
      SET public_library_id = NULL, status = 'reviewed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(ideaId);

    await logActivity(ideaId, req.user.id, 'deleted_from_public_library', 
      `Template removed from Public Library (was: ${idea.public_library_id})`);

    // Get updated idea
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

    // Emit real-time update
    emitToAll('idea:updated', updatedIdea);

    res.json({
      success: true,
      message: 'Template successfully removed from Public Library',
      previous_public_library_id: idea.public_library_id
    });
  } catch (error) {
    console.error('Delete from Public Library error:', error);
    res.status(500).json({ error: 'Failed to delete template from Public Library: ' + error.message });
  }
});

// ========================================
// Format Sync/Normalization Endpoint
// ========================================

// Sync all templates to normalize cost_per_year and time_save_per_week formats (admin only)
// Also updates published templates in Public Library
router.post('/admin/sync-formats', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    // Get all templates with non-empty cost_per_year or time_save_per_week
    // Include public_library_id and status to sync with Public Library
    const templates = await db.prepare(`
      SELECT id, time_save_per_week, cost_per_year, public_library_id, status, flow_name
      FROM ideas 
      WHERE (time_save_per_week IS NOT NULL AND time_save_per_week != '')
         OR (cost_per_year IS NOT NULL AND cost_per_year != '')
    `).all();

    let updated = 0;
    let skipped = 0;
    let publicLibrarySynced = 0;
    let publicLibraryErrors = 0;
    const changes = [];

    for (const template of templates) {
      const normalizedTime = normalizeTimeSavePerWeek(template.time_save_per_week);
      const normalizedCost = normalizeCostPerYear(template.cost_per_year);
      
      const timeChanged = normalizedTime !== template.time_save_per_week;
      const costChanged = normalizedCost !== template.cost_per_year;
      
      if (timeChanged || costChanged) {
        // Update local database
        await db.prepare(`
          UPDATE ideas 
          SET time_save_per_week = ?, cost_per_year = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(normalizedTime || '', normalizedCost || '', template.id);
        
        updated++;
        
        const change = {
          id: template.id,
          flow_name: template.flow_name,
          time_save_per_week: timeChanged ? { from: template.time_save_per_week, to: normalizedTime } : null,
          cost_per_year: costChanged ? { from: template.cost_per_year, to: normalizedCost } : null,
          public_library_synced: false
        };

        // If template is published in Public Library, sync there too
        if (template.public_library_id && template.status === 'published') {
          try {
            // Get the full updated template data
            const updatedIdea = await db.prepare('SELECT * FROM ideas WHERE id = ?').get(template.id);
            await updatePublicLibraryTemplate(template.public_library_id, updatedIdea);
            publicLibrarySynced++;
            change.public_library_synced = true;
            console.log(`📚 Synced format changes to Public Library for template ${template.id}`);
          } catch (syncError) {
            console.error(`📚 Failed to sync template ${template.id} to Public Library:`, syncError.message);
            publicLibraryErrors++;
            change.public_library_error = syncError.message;
          }
        }
        
        changes.push(change);
      } else {
        skipped++;
      }
    }

    console.log(`📊 Format sync completed: ${updated} updated locally, ${publicLibrarySynced} synced to Public Library, ${skipped} already correct`);

    res.json({
      success: true,
      message: `Format sync completed: ${updated} templates updated, ${publicLibrarySynced} synced to Public Library, ${skipped} already correct`,
      stats: {
        total: templates.length,
        updated,
        skipped,
        publicLibrarySynced,
        publicLibraryErrors
      },
      changes: changes.slice(0, 50) // Only return first 50 changes for preview
    });
  } catch (error) {
    console.error('Format sync error:', error);
    res.status(500).json({ error: 'Failed to sync formats: ' + error.message });
  }
});

// Preview format changes without applying (admin only) - useful for dry run
router.get('/admin/sync-formats/preview', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    // Get all templates with non-empty cost_per_year or time_save_per_week
    // Include public_library_id and status to show which templates will be synced to Public Library
    const templates = await db.prepare(`
      SELECT id, flow_name, time_save_per_week, cost_per_year, public_library_id, status 
      FROM ideas 
      WHERE (time_save_per_week IS NOT NULL AND time_save_per_week != '')
         OR (cost_per_year IS NOT NULL AND cost_per_year != '')
    `).all();

    const needsUpdate = [];
    const alreadyCorrect = [];
    let publishedNeedsUpdate = 0;

    for (const template of templates) {
      const normalizedTime = normalizeTimeSavePerWeek(template.time_save_per_week);
      const normalizedCost = normalizeCostPerYear(template.cost_per_year);
      
      const timeChanged = normalizedTime !== template.time_save_per_week;
      const costChanged = normalizedCost !== template.cost_per_year;
      const isPublished = template.public_library_id && template.status === 'published';
      
      if (timeChanged || costChanged) {
        if (isPublished) publishedNeedsUpdate++;
        needsUpdate.push({
          id: template.id,
          flow_name: template.flow_name,
          time_save_per_week: timeChanged 
            ? { current: template.time_save_per_week, normalized: normalizedTime } 
            : { current: template.time_save_per_week, normalized: null },
          cost_per_year: costChanged 
            ? { current: template.cost_per_year, normalized: normalizedCost }
            : { current: template.cost_per_year, normalized: null },
          isPublished // Flag to indicate this will also update Public Library
        });
      } else {
        alreadyCorrect.push({
          id: template.id,
          flow_name: template.flow_name,
          time_save_per_week: template.time_save_per_week,
          cost_per_year: template.cost_per_year,
          isPublished
        });
      }
    }

    res.json({
      success: true,
      stats: {
        total: templates.length,
        needsUpdate: needsUpdate.length,
        alreadyCorrect: alreadyCorrect.length,
        publishedNeedsUpdate // Number of published templates that need update
      },
      needsUpdate,
      alreadyCorrect
    });
  } catch (error) {
    console.error('Format preview error:', error);
    res.status(500).json({ error: 'Failed to preview formats: ' + error.message });
  }
});

export default router;
