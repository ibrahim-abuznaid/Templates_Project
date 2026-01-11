import express from 'express';
import db from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public Library API configuration
const PUBLIC_LIBRARY_API_URL = 'https://cloud.activepieces.com/api/v1/admin/templates/categories';
const PUBLIC_LIBRARY_API_KEY = process.env.PUBLIC_LIBRARY_API_KEY || '';

// Send department name directly to Public Library (no conversion)
// The category name must match exactly what was synced via the categories endpoint
const mapDepartmentToCategory = (departmentName) => {
  if (!departmentName) return { category: null, label: null };
  
  // Return department name as-is (must match what was synced to categories)
  return { 
    category: departmentName, 
    label: departmentName,
    matchType: 'direct'
  };
};

// Get all departments (basic list)
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

// Get all departments with statistics (admin endpoint)
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const departments = await db.prepare(`
      SELECT 
        d.id,
        d.name,
        d.description,
        d.display_order,
        d.created_at,
        COUNT(DISTINCT id_dept.idea_id) as template_count,
        COUNT(DISTINCT CASE WHEN i.status = 'published' THEN id_dept.idea_id END) as published_count,
        COUNT(DISTINCT CASE WHEN i.status IN ('in_progress', 'submitted', 'needs_fixes') THEN id_dept.idea_id END) as in_progress_count
      FROM departments d
      LEFT JOIN idea_departments id_dept ON d.id = id_dept.department_id
      LEFT JOIN ideas i ON id_dept.idea_id = i.id
      GROUP BY d.id, d.name, d.description, d.display_order, d.created_at
      ORDER BY d.display_order, d.name
    `).all();

    res.json({
      departments,
      total: departments.length,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching department stats:', error);
    res.status(500).json({ error: 'Failed to fetch department statistics' });
  }
});

// Get category mapping for all departments (shows what each department maps to in Public Library)
router.get('/mapping', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const departments = await db.prepare(`
      SELECT id, name, description, display_order
      FROM departments
      ORDER BY display_order, name
    `).all();

    const mappings = departments.map(dept => {
      const mapping = mapDepartmentToCategory(dept.name);
      return {
        id: dept.id,
        department_name: dept.name,
        maps_to_category: mapping.category,
        maps_to_label: mapping.label,
        match_type: 'direct' // All mappings are now direct (department name = category)
      };
    });

    res.json({
      mappings,
      total_departments: departments.length,
      note: 'Categories are now sent directly as department names (no conversion). Make sure to sync categories to Public Library first.',
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching department mappings:', error);
    res.status(500).json({ error: 'Failed to fetch department mappings' });
  }
});

// Preview Public Library sync (shows what will be sent) - MUST be before /:id routes
router.get('/public-library/preview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get departments in order
    const departments = await db.prepare(`
      SELECT id, name, display_order
      FROM departments
      ORDER BY display_order, name
    `).all();

    // Format category names for Public Library (Title Case)
    const categoryNames = departments.map(d => d.name);

    res.json({
      success: true,
      preview: {
        endpoint: PUBLIC_LIBRARY_API_URL,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'templates-api-key': PUBLIC_LIBRARY_API_KEY ? '***configured***' : '⚠️ NOT CONFIGURED'
        },
        body: {
          value: categoryNames
        }
      },
      departments: departments.map(d => ({
        id: d.id,
        name: d.name,
        display_order: d.display_order
      })),
      warnings: !PUBLIC_LIBRARY_API_KEY ? ['PUBLIC_LIBRARY_API_KEY is not configured in environment variables'] : []
    });
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

// Sync categories to Public Library - MUST be before /:id routes
router.post('/public-library/sync', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Check API key configuration
    if (!PUBLIC_LIBRARY_API_KEY) {
      return res.status(400).json({ 
        error: 'Public Library API key is not configured',
        details: 'Please set PUBLIC_LIBRARY_API_KEY in your environment variables'
      });
    }

    // Get departments in order
    const departments = await db.prepare(`
      SELECT id, name, display_order
      FROM departments
      ORDER BY display_order, name
    `).all();

    // Format category names for Public Library
    const categoryNames = departments.map(d => d.name);

    console.log('📚 Syncing categories to Public Library:', categoryNames);

    // Make the API call to Public Library
    const response = await fetch(PUBLIC_LIBRARY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'templates-api-key': PUBLIC_LIBRARY_API_KEY
      },
      body: JSON.stringify({
        value: categoryNames
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Public Library API error:', response.status, errorText);
      return res.status(response.status).json({
        success: false,
        error: 'Failed to sync with Public Library',
        api_status: response.status,
        api_error: errorText
      });
    }

    const responseData = await response.json().catch(() => ({}));

    console.log('✅ Categories synced successfully to Public Library');

    res.json({
      success: true,
      message: `Successfully synced ${categoryNames.length} categories to Public Library`,
      synced_categories: categoryNames,
      api_response: responseData,
      synced_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error syncing to Public Library:', error);
    res.status(500).json({ 
      error: 'Failed to sync with Public Library',
      details: error.message
    });
  }
});

// Reorder departments (bulk update display_order) - MUST be before /:id routes
router.put('/reorder/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { order } = req.body;

    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ error: 'Order array is required' });
    }

    // Update each department's display_order
    for (const item of order) {
      if (item.id && typeof item.display_order === 'number') {
        await db.prepare(`
          UPDATE departments SET display_order = ? WHERE id = ?
        `).run(item.display_order, item.id);
      }
    }

    // Fetch updated departments
    const departments = await db.prepare(`
      SELECT id, name, description, display_order
      FROM departments
      ORDER BY display_order, name
    `).all();

    res.json({
      success: true,
      message: 'Departments reordered successfully',
      departments
    });
  } catch (error) {
    console.error('Error reordering departments:', error);
    res.status(500).json({ error: 'Failed to reorder departments' });
  }
});

// Bulk migrate templates from one department to another - MUST be before /:id routes
router.post('/migrate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { source_id, target_id, template_ids, remove_from_source } = req.body;

    if (!source_id || !target_id) {
      return res.status(400).json({ error: 'Source and target department IDs are required' });
    }

    if (source_id === target_id) {
      return res.status(400).json({ error: 'Source and target departments must be different' });
    }

    // Check if both departments exist
    const [sourceDept, targetDept] = await Promise.all([
      db.prepare('SELECT * FROM departments WHERE id = ?').get(source_id),
      db.prepare('SELECT * FROM departments WHERE id = ?').get(target_id)
    ]);

    if (!sourceDept) {
      return res.status(404).json({ error: 'Source department not found' });
    }
    if (!targetDept) {
      return res.status(404).json({ error: 'Target department not found' });
    }

    // Get all templates from source department first
    const allTemplatesInSource = await db.prepare(`
      SELECT id_dept.idea_id, i.flow_name
      FROM idea_departments id_dept
      JOIN ideas i ON id_dept.idea_id = i.id
      WHERE id_dept.department_id = ?
    `).all(source_id);

    // Filter to specific templates if requested
    let templatesToMigrate;
    if (template_ids && Array.isArray(template_ids) && template_ids.length > 0) {
      const templateIdSet = new Set(template_ids.map(id => parseInt(id)));
      templatesToMigrate = allTemplatesInSource.filter(t => templateIdSet.has(t.idea_id));
    } else {
      templatesToMigrate = allTemplatesInSource;
    }

    let addedCount = 0;
    let removedCount = 0;
    const migrated = [];

    for (const template of templatesToMigrate) {
      // Check if template already has the target department
      const existingLink = await db.prepare(`
        SELECT id FROM idea_departments WHERE idea_id = ? AND department_id = ?
      `).get(template.idea_id, target_id);

      if (!existingLink) {
        // Add the new department link
        await db.prepare(`
          INSERT INTO idea_departments (idea_id, department_id, created_at)
          VALUES (?, ?, NOW())
        `).run(template.idea_id, target_id);
        addedCount++;
      }

      // Optionally remove from source department
      if (remove_from_source) {
        await db.prepare(`
          DELETE FROM idea_departments WHERE idea_id = ? AND department_id = ?
        `).run(template.idea_id, source_id);
        removedCount++;
      }

      migrated.push({
        id: template.idea_id,
        flow_name: template.flow_name
      });
    }

    res.json({
      success: true,
      message: `Successfully migrated ${migrated.length} template(s)`,
      stats: {
        total: migrated.length,
        added_to_target: addedCount,
        removed_from_source: removedCount
      },
      migrated_templates: migrated,
      source_department: sourceDept.name,
      target_department: targetDept.name
    });
  } catch (error) {
    console.error('Error migrating templates:', error);
    res.status(500).json({ error: 'Failed to migrate templates' });
  }
});

// Create a new department
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    // Check for duplicate name
    const existing = await db.prepare(
      'SELECT id FROM departments WHERE LOWER(name) = LOWER(?)'
    ).get(name.trim());

    if (existing) {
      return res.status(400).json({ error: 'A department with this name already exists' });
    }

    // Get the maximum display order
    const maxOrder = await db.prepare(
      'SELECT COALESCE(MAX(display_order), 0) as max_order FROM departments'
    ).get();

    const result = await db.prepare(`
      INSERT INTO departments (name, description, display_order, created_at)
      VALUES (?, ?, ?, NOW())
      RETURNING id, name, description, display_order, created_at
    `).get(name.trim(), description?.trim() || null, maxOrder.max_order + 1);

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      department: result
    });
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

// Get templates for a specific department (useful for migration UI)
router.get('/:id/templates', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid department ID' });
    }

    // Check if department exists
    const department = await db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const templates = await db.prepare(`
      SELECT 
        i.id,
        i.flow_name,
        i.status,
        i.public_library_id,
        i.created_at,
        i.updated_at,
        u.username as assigned_to_name
      FROM ideas i
      JOIN idea_departments id_dept ON i.id = id_dept.idea_id
      LEFT JOIN users u ON i.assigned_to = u.id
      WHERE id_dept.department_id = ?
      ORDER BY i.flow_name
    `).all(id);

    res.json({
      department,
      templates,
      total: templates.length
    });
  } catch (error) {
    console.error('Error fetching department templates:', error);
    res.status(500).json({ error: 'Failed to fetch department templates' });
  }
});

// Update a department (rename)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, description } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid department ID' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    // Check if department exists
    const existing = await db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Department not found' });
    }

    // Check for duplicate name (excluding current department)
    const duplicate = await db.prepare(
      'SELECT id FROM departments WHERE LOWER(name) = LOWER(?) AND id != ?'
    ).get(name.trim(), id);

    if (duplicate) {
      return res.status(400).json({ error: 'A department with this name already exists' });
    }

    const result = await db.prepare(`
      UPDATE departments 
      SET name = ?, description = ?
      WHERE id = ?
      RETURNING id, name, description, display_order, created_at
    `).get(name.trim(), description?.trim() || null, id);

    res.json({
      success: true,
      message: 'Department updated successfully',
      department: result,
      old_name: existing.name
    });
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

// Delete a department
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { migrate_to_id } = req.query;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid department ID' });
    }

    // Check if department exists
    const department = await db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    // Count templates in this department
    const templateCount = await db.prepare(`
      SELECT COUNT(*) as count FROM idea_departments WHERE department_id = ?
    `).get(id);

    // If there are templates and no migration target, return error
    if (parseInt(templateCount.count) > 0 && !migrate_to_id) {
      return res.status(400).json({ 
        error: 'This department has templates. Please specify a target department to migrate them to, or delete templates first.',
        template_count: parseInt(templateCount.count)
      });
    }

    // If migration is requested, move templates first
    let migratedCount = 0;
    const migrateId = migrate_to_id ? parseInt(migrate_to_id, 10) : null;
    
    if (migrateId && migrateId !== id) {
      // Check if target department exists
      const targetDept = await db.prepare('SELECT * FROM departments WHERE id = ?').get(migrateId);
      if (!targetDept) {
        return res.status(400).json({ error: 'Target department not found' });
      }

      // Get all templates in the source department
      const templatesInDept = await db.prepare(`
        SELECT idea_id FROM idea_departments WHERE department_id = ?
      `).all(id);

      for (const template of templatesInDept) {
        // Check if template already has the target department
        const existingLink = await db.prepare(`
          SELECT id FROM idea_departments WHERE idea_id = ? AND department_id = ?
        `).get(template.idea_id, migrateId);

        if (!existingLink) {
          // Add the new department link
          await db.prepare(`
            INSERT INTO idea_departments (idea_id, department_id, created_at)
            VALUES (?, ?, NOW())
          `).run(template.idea_id, migrateId);
        }
        migratedCount++;
      }

      // Remove all links to the old department
      await db.prepare('DELETE FROM idea_departments WHERE department_id = ?').run(id);
    }

    // Also handle suggested ideas
    await db.prepare('DELETE FROM suggested_idea_departments WHERE department_id = ?').run(id);

    // Delete the department
    await db.prepare('DELETE FROM departments WHERE id = ?').run(id);

    res.json({
      success: true,
      message: 'Department deleted successfully',
      deleted_department: department,
      templates_migrated: migratedCount
    });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

export default router;
