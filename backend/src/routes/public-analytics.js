import express from 'express';
import db from '../database/db.js';

const router = express.Router();

// ========================================
// API Key Authentication Middleware
// ========================================

/**
 * Middleware to validate API key for external access
 * The API key should be sent in the X-API-Key header
 */
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.TEMPLATE_ANALYTICS_API_KEY;

  if (!validApiKey) {
    console.error('TEMPLATE_ANALYTICS_API_KEY environment variable not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!apiKey) {
    return res.status(401).json({ error: 'API key is required. Please provide X-API-Key header.' });
  }

  if (apiKey !== validApiKey) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  next();
};

// Apply API key validation to all routes in this router
router.use(validateApiKey);

// ========================================
// Event Types
// ========================================

const EVENT_TYPES = {
  VIEW: 'VIEW',
  INSTALL: 'INSTALL',
  ACTIVATE: 'ACTIVATE',
  DEACTIVATE: 'DEACTIVATE',
  EXPLORE_VIEW: 'EXPLORE_VIEW',
};

// ========================================
// Helper Functions
// ========================================

/**
 * Get or create template analytics record
 */
const getOrCreateTemplateAnalytics = async (templateId) => {
  let analytics = await db.prepare(`
    SELECT * FROM template_analytics WHERE template_id = $1
  `).get(templateId);

  if (!analytics) {
    // Create new analytics record
    await db.prepare(`
      INSERT INTO template_analytics (template_id, total_views, total_installs, active_flow_ids, installed_by_user_ids)
      VALUES ($1, 0, 0, ARRAY[]::varchar[], ARRAY[]::varchar[])
    `).run(templateId);

    analytics = await db.prepare(`
      SELECT * FROM template_analytics WHERE template_id = $1
    `).get(templateId);
  }

  return analytics;
};

/**
 * Get or create explore analytics record (singleton)
 */
const getOrCreateExploreAnalytics = async () => {
  let analytics = await db.prepare(`
    SELECT * FROM explore_analytics LIMIT 1
  `).get();

  if (!analytics) {
    // Create new analytics record
    await db.prepare(`
      INSERT INTO explore_analytics (total_views, viewed_by_user_ids)
      VALUES (0, ARRAY[]::varchar[])
    `).run();

    analytics = await db.prepare(`
      SELECT * FROM explore_analytics LIMIT 1
    `).get();
  }

  return analytics;
};

// ========================================
// Template Analytics Endpoints
// ========================================

/**
 * POST /templates/:id/view
 * Track a view on a template
 * 
 * Mission: Increment totalViews
 */
router.post('/templates/:id/view', async (req, res) => {
  try {
    const { id: templateId } = req.params;

    if (!templateId) {
      return res.status(400).json({ error: 'Template ID is required' });
    }

    await getOrCreateTemplateAnalytics(templateId);

    // Increment total views
    await db.prepare(`
      UPDATE template_analytics 
      SET total_views = total_views + 1, updated_at = NOW()
      WHERE template_id = $1
    `).run(templateId);

    const updated = await db.prepare(`
      SELECT * FROM template_analytics WHERE template_id = $1
    `).get(templateId);

    res.json({
      success: true,
      message: 'View recorded',
      analytics: {
        templateId: updated.template_id,
        totalViews: updated.total_views,
        totalInstalls: updated.total_installs
      }
    });
  } catch (error) {
    console.error('Template view tracking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /templates/:id/install
 * Track an install of a template
 * 
 * Body: { userId: string }
 * 
 * Mission:
 * - Increment totalInstalls
 * - Add userId to installedByUserIds (unique)
 */
router.post('/templates/:id/install', async (req, res) => {
  try {
    const { id: templateId } = req.params;
    const { userId } = req.body;

    if (!templateId) {
      return res.status(400).json({ error: 'Template ID is required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'userId is required in request body' });
    }

    await getOrCreateTemplateAnalytics(templateId);

    // Increment total installs and add userId to array (if unique)
    await db.prepare(`
      UPDATE template_analytics 
      SET 
        total_installs = total_installs + 1,
        installed_by_user_ids = CASE 
          WHEN $2 = ANY(installed_by_user_ids) THEN installed_by_user_ids
          ELSE array_append(installed_by_user_ids, $2)
        END,
        updated_at = NOW()
      WHERE template_id = $1
    `).run(templateId, userId);

    const updated = await db.prepare(`
      SELECT * FROM template_analytics WHERE template_id = $1
    `).get(templateId);

    res.json({
      success: true,
      message: 'Install recorded',
      analytics: {
        templateId: updated.template_id,
        totalViews: updated.total_views,
        totalInstalls: updated.total_installs,
        uniqueUsers: updated.installed_by_user_ids.length
      }
    });
  } catch (error) {
    console.error('Template install tracking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /templates/:id/activate
 * Track an active flow created from a template
 * 
 * Body: { flowId: string }
 * 
 * Mission: Add flowId to activeFlowIds (unique)
 */
router.post('/templates/:id/activate', async (req, res) => {
  try {
    const { id: templateId } = req.params;
    const { flowId } = req.body;

    if (!templateId) {
      return res.status(400).json({ error: 'Template ID is required' });
    }

    if (!flowId) {
      return res.status(400).json({ error: 'flowId is required in request body' });
    }

    await getOrCreateTemplateAnalytics(templateId);

    // Add flowId to array (if unique)
    await db.prepare(`
      UPDATE template_analytics 
      SET 
        active_flow_ids = CASE 
          WHEN $2 = ANY(active_flow_ids) THEN active_flow_ids
          ELSE array_append(active_flow_ids, $2)
        END,
        updated_at = NOW()
      WHERE template_id = $1
    `).run(templateId, flowId);

    const updated = await db.prepare(`
      SELECT * FROM template_analytics WHERE template_id = $1
    `).get(templateId);

    res.json({
      success: true,
      message: 'Flow activation recorded',
      analytics: {
        templateId: updated.template_id,
        activeFlows: updated.active_flow_ids.length
      }
    });
  } catch (error) {
    console.error('Template activate tracking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /templates/:id/deactivate
 * Remove an active flow from a template (when flow is deleted/disabled)
 * 
 * Body: { flowId: string }
 * 
 * Mission: Remove flowId from activeFlowIds
 */
router.post('/templates/:id/deactivate', async (req, res) => {
  try {
    const { id: templateId } = req.params;
    const { flowId } = req.body;

    if (!templateId) {
      return res.status(400).json({ error: 'Template ID is required' });
    }

    if (!flowId) {
      return res.status(400).json({ error: 'flowId is required in request body' });
    }

    // Remove flowId from array
    await db.prepare(`
      UPDATE template_analytics 
      SET 
        active_flow_ids = array_remove(active_flow_ids, $2),
        updated_at = NOW()
      WHERE template_id = $1
    `).run(templateId, flowId);

    const updated = await db.prepare(`
      SELECT * FROM template_analytics WHERE template_id = $1
    `).get(templateId);

    if (!updated) {
      return res.status(404).json({ error: 'Template analytics not found' });
    }

    res.json({
      success: true,
      message: 'Flow deactivation recorded',
      analytics: {
        templateId: updated.template_id,
        activeFlows: updated.active_flow_ids.length
      }
    });
  } catch (error) {
    console.error('Template deactivate tracking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// Explore/Discover Page Analytics Endpoints
// ========================================

/**
 * POST /explore/view
 * Track a view on the explore/discover page
 * 
 * Body: { userId?: string }
 * 
 * Mission:
 * - Increment totalViews
 * - Add userId to viewedByUserIds (unique) if provided
 */
router.post('/explore/view', async (req, res) => {
  try {
    const { userId } = req.body;

    await getOrCreateExploreAnalytics();

    if (userId) {
      // Increment views and add userId (if unique)
      await db.prepare(`
        UPDATE explore_analytics 
        SET 
          total_views = total_views + 1,
          viewed_by_user_ids = CASE 
            WHEN $1 = ANY(viewed_by_user_ids) THEN viewed_by_user_ids
            ELSE array_append(viewed_by_user_ids, $1)
          END,
          updated_at = NOW()
        WHERE id = (SELECT id FROM explore_analytics LIMIT 1)
      `).run(userId);
    } else {
      // Just increment views
      await db.prepare(`
        UPDATE explore_analytics 
        SET 
          total_views = total_views + 1,
          updated_at = NOW()
        WHERE id = (SELECT id FROM explore_analytics LIMIT 1)
      `).run();
    }

    const updated = await db.prepare(`
      SELECT * FROM explore_analytics LIMIT 1
    `).get();

    res.json({
      success: true,
      message: 'Explore view recorded',
      analytics: {
        totalViews: updated.total_views,
        uniqueUsers: updated.viewed_by_user_ids.length
      }
    });
  } catch (error) {
    console.error('Explore view tracking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// Unified Event Endpoint (RECOMMENDED)
// ========================================

/**
 * POST /event
 * Single endpoint to track all analytics events
 * 
 * Body: {
 *   eventType: "VIEW" | "INSTALL" | "ACTIVATE" | "DEACTIVATE" | "EXPLORE_VIEW",
 *   templateId?: string,  // Required for template events
 *   userId?: string,      // Required for INSTALL, optional for EXPLORE_VIEW
 *   flowId?: string       // Required for ACTIVATE and DEACTIVATE
 * }
 */
router.post('/event', async (req, res) => {
  try {
    const { eventType, templateId, userId, flowId } = req.body;

    // Validate event type
    if (!eventType) {
      return res.status(400).json({ 
        error: 'eventType is required',
        validEventTypes: Object.values(EVENT_TYPES)
      });
    }

    if (!Object.values(EVENT_TYPES).includes(eventType)) {
      return res.status(400).json({ 
        error: `Invalid eventType: ${eventType}`,
        validEventTypes: Object.values(EVENT_TYPES)
      });
    }

    // Handle each event type
    switch (eventType) {
      case EVENT_TYPES.VIEW: {
        if (!templateId) {
          return res.status(400).json({ error: 'templateId is required for VIEW event' });
        }

        await getOrCreateTemplateAnalytics(templateId);

        await db.prepare(`
          UPDATE template_analytics 
          SET total_views = total_views + 1, updated_at = NOW()
          WHERE template_id = $1
        `).run(templateId);

        const updated = await db.prepare(`
          SELECT * FROM template_analytics WHERE template_id = $1
        `).get(templateId);

        return res.json({
          success: true,
          eventType,
          message: 'View recorded',
          analytics: {
            templateId: updated.template_id,
            totalViews: updated.total_views,
            totalInstalls: updated.total_installs
          }
        });
      }

      case EVENT_TYPES.INSTALL: {
        if (!templateId) {
          return res.status(400).json({ error: 'templateId is required for INSTALL event' });
        }
        if (!userId) {
          return res.status(400).json({ error: 'userId is required for INSTALL event' });
        }

        await getOrCreateTemplateAnalytics(templateId);

        await db.prepare(`
          UPDATE template_analytics 
          SET 
            total_installs = total_installs + 1,
            installed_by_user_ids = CASE 
              WHEN $2 = ANY(installed_by_user_ids) THEN installed_by_user_ids
              ELSE array_append(installed_by_user_ids, $2)
            END,
            updated_at = NOW()
          WHERE template_id = $1
        `).run(templateId, userId);

        const updated = await db.prepare(`
          SELECT * FROM template_analytics WHERE template_id = $1
        `).get(templateId);

        return res.json({
          success: true,
          eventType,
          message: 'Install recorded',
          analytics: {
            templateId: updated.template_id,
            totalViews: updated.total_views,
            totalInstalls: updated.total_installs,
            uniqueUsers: updated.installed_by_user_ids.length
          }
        });
      }

      case EVENT_TYPES.ACTIVATE: {
        if (!templateId) {
          return res.status(400).json({ error: 'templateId is required for ACTIVATE event' });
        }
        if (!flowId) {
          return res.status(400).json({ error: 'flowId is required for ACTIVATE event' });
        }

        await getOrCreateTemplateAnalytics(templateId);

        await db.prepare(`
          UPDATE template_analytics 
          SET 
            active_flow_ids = CASE 
              WHEN $2 = ANY(active_flow_ids) THEN active_flow_ids
              ELSE array_append(active_flow_ids, $2)
            END,
            updated_at = NOW()
          WHERE template_id = $1
        `).run(templateId, flowId);

        const updated = await db.prepare(`
          SELECT * FROM template_analytics WHERE template_id = $1
        `).get(templateId);

        return res.json({
          success: true,
          eventType,
          message: 'Flow activation recorded',
          analytics: {
            templateId: updated.template_id,
            activeFlows: updated.active_flow_ids.length
          }
        });
      }

      case EVENT_TYPES.DEACTIVATE: {
        if (!templateId) {
          return res.status(400).json({ error: 'templateId is required for DEACTIVATE event' });
        }
        if (!flowId) {
          return res.status(400).json({ error: 'flowId is required for DEACTIVATE event' });
        }

        await db.prepare(`
          UPDATE template_analytics 
          SET 
            active_flow_ids = array_remove(active_flow_ids, $2),
            updated_at = NOW()
          WHERE template_id = $1
        `).run(templateId, flowId);

        const updated = await db.prepare(`
          SELECT * FROM template_analytics WHERE template_id = $1
        `).get(templateId);

        if (!updated) {
          return res.status(404).json({ error: 'Template analytics not found' });
        }

        return res.json({
          success: true,
          eventType,
          message: 'Flow deactivation recorded',
          analytics: {
            templateId: updated.template_id,
            activeFlows: updated.active_flow_ids.length
          }
        });
      }

      case EVENT_TYPES.EXPLORE_VIEW: {
        await getOrCreateExploreAnalytics();

        if (userId) {
          await db.prepare(`
            UPDATE explore_analytics 
            SET 
              total_views = total_views + 1,
              viewed_by_user_ids = CASE 
                WHEN $1 = ANY(viewed_by_user_ids) THEN viewed_by_user_ids
                ELSE array_append(viewed_by_user_ids, $1)
              END,
              updated_at = NOW()
            WHERE id = (SELECT id FROM explore_analytics LIMIT 1)
          `).run(userId);
        } else {
          await db.prepare(`
            UPDATE explore_analytics 
            SET 
              total_views = total_views + 1,
              updated_at = NOW()
            WHERE id = (SELECT id FROM explore_analytics LIMIT 1)
          `).run();
        }

        const updated = await db.prepare(`
          SELECT * FROM explore_analytics LIMIT 1
        `).get();

        return res.json({
          success: true,
          eventType,
          message: 'Explore view recorded',
          analytics: {
            totalViews: updated.total_views,
            uniqueUsers: updated.viewed_by_user_ids.length
          }
        });
      }

      default:
        return res.status(400).json({ 
          error: `Unhandled eventType: ${eventType}`,
          validEventTypes: Object.values(EVENT_TYPES)
        });
    }
  } catch (error) {
    console.error('Event tracking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// Analytics Retrieval Endpoints (for the team)
// ========================================

/**
 * GET /templates/:id
 * Get analytics for a specific template
 */
router.get('/templates/:id', async (req, res) => {
  try {
    const { id: templateId } = req.params;

    const analytics = await db.prepare(`
      SELECT * FROM template_analytics WHERE template_id = $1
    `).get(templateId);

    if (!analytics) {
      return res.status(404).json({ error: 'Template analytics not found' });
    }

    // Calculate conversion rate
    const conversionRate = analytics.total_views > 0 
      ? ((analytics.total_installs / analytics.total_views) * 100).toFixed(2)
      : 0;

    res.json({
      templateId: analytics.template_id,
      totalViews: analytics.total_views,
      totalInstalls: analytics.total_installs,
      uniqueUsersInstalled: analytics.installed_by_user_ids.length,
      activeFlows: analytics.active_flow_ids.length,
      conversionRate: parseFloat(conversionRate),
      createdAt: analytics.created_at,
      updatedAt: analytics.updated_at
    });
  } catch (error) {
    console.error('Get template analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /templates
 * Get analytics for all templates
 */
router.get('/templates', async (req, res) => {
  try {
    const analytics = await db.prepare(`
      SELECT * FROM template_analytics ORDER BY total_installs DESC
    `).all();

    const results = analytics.map(a => ({
      templateId: a.template_id,
      totalViews: a.total_views,
      totalInstalls: a.total_installs,
      uniqueUsersInstalled: a.installed_by_user_ids.length,
      activeFlows: a.active_flow_ids.length,
      conversionRate: a.total_views > 0 
        ? parseFloat(((a.total_installs / a.total_views) * 100).toFixed(2))
        : 0,
      updatedAt: a.updated_at
    }));

    res.json({
      count: results.length,
      templates: results
    });
  } catch (error) {
    console.error('Get all template analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /explore
 * Get explore page analytics
 */
router.get('/explore', async (req, res) => {
  try {
    const analytics = await db.prepare(`
      SELECT * FROM explore_analytics LIMIT 1
    `).get();

    if (!analytics) {
      return res.json({
        totalViews: 0,
        uniqueUsers: 0,
        conversionRate: 0
      });
    }

    // Calculate conversion rate - need total installs across all templates
    const totalInstalls = await db.prepare(`
      SELECT COALESCE(SUM(total_installs), 0) as total FROM template_analytics
    `).get();

    const conversionRate = analytics.total_views > 0 
      ? ((totalInstalls.total / analytics.total_views) * 100).toFixed(2)
      : 0;

    res.json({
      totalViews: analytics.total_views,
      uniqueUsers: analytics.viewed_by_user_ids.length,
      conversionRate: parseFloat(conversionRate),
      totalInstallsFromExplore: totalInstalls.total
    });
  } catch (error) {
    console.error('Get explore analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /summary
 * Get aggregated analytics summary for all metrics
 */
router.get('/summary', async (req, res) => {
  try {
    // Per Template Summary
    const templateStats = await db.prepare(`
      SELECT 
        COUNT(*) as total_templates,
        COALESCE(SUM(total_views), 0) as total_views,
        COALESCE(SUM(total_installs), 0) as total_installs,
        COALESCE(SUM(array_length(active_flow_ids, 1)), 0) as total_active_flows
      FROM template_analytics
    `).get();

    // Unique users who installed any template
    const uniqueInstallers = await db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM (
        SELECT unnest(installed_by_user_ids) as user_id FROM template_analytics
      ) as users
    `).get();

    // Templates installed at least once
    const installedAtLeastOnce = await db.prepare(`
      SELECT COUNT(*) as count FROM template_analytics WHERE total_installs > 0
    `).get();

    // Average installs per template
    const avgInstalls = templateStats.total_templates > 0 
      ? (templateStats.total_installs / templateStats.total_templates).toFixed(2)
      : 0;

    // Explore page stats
    const exploreStats = await db.prepare(`
      SELECT 
        COALESCE(total_views, 0) as total_views,
        COALESCE(array_length(viewed_by_user_ids, 1), 0) as unique_users
      FROM explore_analytics
      LIMIT 1
    `).get();

    // Per category stats (using departments)
    const categoryStats = await db.prepare(`
      SELECT 
        d.name as category,
        COUNT(DISTINCT i.id) as available_templates,
        COALESCE(SUM(ta.total_installs), 0) as total_installs,
        COUNT(DISTINCT CASE WHEN ta.total_installs > 0 THEN i.id END) as installed_at_least_once,
        COALESCE(SUM(array_length(ta.active_flow_ids, 1)), 0) as active_flows
      FROM departments d
      LEFT JOIN idea_departments id ON d.id = id.department_id
      LEFT JOIN ideas i ON id.idea_id = i.id AND i.status = 'published'
      LEFT JOIN template_analytics ta ON i.public_library_id = ta.template_id
      GROUP BY d.id, d.name
      ORDER BY total_installs DESC
    `).all();

    // Calculate average installs per template per category
    const categoriesWithAvg = categoryStats.map(cat => ({
      ...cat,
      avg_installs_per_template: cat.available_templates > 0 
        ? parseFloat((cat.total_installs / cat.available_templates).toFixed(2))
        : 0
    }));

    // Overall conversion rate
    const overallConversionRate = templateStats.total_views > 0 
      ? ((templateStats.total_installs / templateStats.total_views) * 100).toFixed(2)
      : 0;

    res.json({
      perTemplate: {
        totalViews: parseInt(templateStats.total_views || 0),
        totalInstalls: parseInt(templateStats.total_installs || 0),
        uniqueUsersInstalled: parseInt(uniqueInstallers?.count || 0),
        activeFlows: parseInt(templateStats.total_active_flows || 0),
        conversionRate: parseFloat(overallConversionRate)
      },
      perCategory: categoriesWithAvg,
      perUser: {
        totalUsersInstalled: parseInt(uniqueInstallers?.count || 0),
        averageTemplatesPerUser: uniqueInstallers?.count > 0 
          ? parseFloat((templateStats.total_installs / uniqueInstallers.count).toFixed(2))
          : 0
      },
      discoverPage: {
        totalClicks: parseInt(exploreStats?.total_views || 0),
        uniqueUsers: parseInt(exploreStats?.unique_users || 0),
        conversionRate: exploreStats && exploreStats.total_views > 0 
          ? parseFloat(((templateStats.total_installs / exploreStats.total_views) * 100).toFixed(2))
          : 0
      },
      metadata: {
        totalTrackedTemplates: parseInt(templateStats.total_templates || 0),
        templatesInstalledAtLeastOnce: parseInt(installedAtLeastOnce?.count || 0),
        averageInstallsPerTemplate: parseFloat(avgInstalls)
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get analytics summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
