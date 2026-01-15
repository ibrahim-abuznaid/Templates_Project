import express from 'express';
import db from '../database/db.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { createNotification } from './notifications.js';

const router = express.Router();

// Send maintenance reminder notification to a user about a template
router.post('/send-reminder', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { user_id, idea_id, reminder_type, message } = req.body;

    if (!user_id || !idea_id || !reminder_type) {
      return res.status(400).json({ error: 'user_id, idea_id, and reminder_type are required' });
    }

    // Get the idea info
    const idea = await db.prepare('SELECT id, flow_name FROM ideas WHERE id = ?').get(idea_id);
    if (!idea) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Build notification message based on type
    let title, notificationMessage;
    const templateName = idea.flow_name || `Template #${idea.id}`;

    switch (reminder_type) {
      case 'incomplete_fields':
        title = '⚠️ Template Missing Required Fields';
        notificationMessage = message || `The published template "${templateName}" is missing required fields. Please complete all required information.`;
        break;
      case 'stale':
        title = '⏰ Template Needs Attention';
        notificationMessage = message || `The template "${templateName}" hasn't been updated in a while. Please check on its progress.`;
        break;
      case 'no_flow':
        title = '📄 Flow File Missing';
        notificationMessage = message || `The template "${templateName}" is missing a flow JSON file. Please upload the flow file.`;
        break;
      default:
        title = '📋 Template Reminder';
        notificationMessage = message || `Please review the template "${templateName}".`;
    }

    const notification = await createNotification(
      user_id,
      'reminder',
      title,
      notificationMessage,
      idea_id,
      req.user.id
    );

    if (notification) {
      res.json({ success: true, message: 'Reminder sent successfully', notification });
    } else {
      res.status(500).json({ error: 'Failed to create notification' });
    }
  } catch (error) {
    console.error('Send reminder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send bulk reminders to multiple users
router.post('/send-bulk-reminders', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { reminders } = req.body;

    if (!Array.isArray(reminders) || reminders.length === 0) {
      return res.status(400).json({ error: 'reminders array is required' });
    }

    const results = { sent: 0, failed: 0, errors: [] };

    for (const reminder of reminders) {
      const { user_id, idea_id, reminder_type, message } = reminder;
      
      if (!user_id || !idea_id) {
        results.failed++;
        results.errors.push({ idea_id, error: 'Missing user_id or idea_id' });
        continue;
      }

      const idea = await db.prepare('SELECT id, flow_name FROM ideas WHERE id = ?').get(idea_id);
      if (!idea) {
        results.failed++;
        results.errors.push({ idea_id, error: 'Template not found' });
        continue;
      }

      const templateName = idea.flow_name || `Template #${idea.id}`;
      let title, notificationMessage;

      switch (reminder_type) {
        case 'incomplete_fields':
          title = '⚠️ Template Missing Required Fields';
          notificationMessage = message || `The published template "${templateName}" is missing required fields. Please complete all required information.`;
          break;
        case 'stale':
          title = '⏰ Template Needs Attention';
          notificationMessage = message || `The template "${templateName}" hasn't been updated in a while. Please check on its progress.`;
          break;
        case 'no_flow':
          title = '📄 Flow File Missing';
          notificationMessage = message || `The template "${templateName}" is missing a flow JSON file. Please upload the flow file.`;
          break;
        default:
          title = '📋 Template Reminder';
          notificationMessage = message || `Please review the template "${templateName}".`;
      }

      const notification = await createNotification(
        user_id,
        'reminder',
        title,
        notificationMessage,
        idea_id,
        req.user.id
      );

      if (notification) {
        results.sent++;
      } else {
        results.failed++;
        results.errors.push({ idea_id, error: 'Failed to create notification' });
      }
    }

    res.json({ 
      success: true, 
      message: `Sent ${results.sent} reminder${results.sent !== 1 ? 's' : ''}${results.failed > 0 ? `, ${results.failed} failed` : ''}`,
      results 
    });
  } catch (error) {
    console.error('Send bulk reminders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to get week boundaries for Thursday 2 PM Jordan time
// weeksAgo: 0 = current week, 1 = past week, 2 = two weeks ago, etc.
const getWeekBoundaries = (weeksAgo = 0) => {
  // Jordan time is UTC+2 (or UTC+3 during DST, but Asia/Amman handles this)
  const now = new Date();
  
  // Convert to Jordan time to check day/hour
  const jordanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Amman' }));
  const dayOfWeek = jordanTime.getDay(); // 0=Sunday, 4=Thursday
  const hour = jordanTime.getHours();
  
  // Find the most recent Thursday 2 PM Jordan time
  let weekStart = new Date(jordanTime);
  weekStart.setHours(14, 0, 0, 0); // Set to 2 PM
  
  // Calculate days to subtract to get to Thursday
  let daysToThursday = dayOfWeek - 4; // Days since Thursday
  if (daysToThursday < 0) daysToThursday += 7; // If before Thursday, go back to last Thursday
  if (daysToThursday === 0 && hour < 14) daysToThursday = 7; // If Thursday but before 2 PM, use last Thursday
  
  weekStart.setDate(weekStart.getDate() - daysToThursday);
  
  // Subtract additional weeks if looking at past weeks
  if (weeksAgo > 0) {
    weekStart.setDate(weekStart.getDate() - (weeksAgo * 7));
  }
  
  // Week end is 7 days after week start
  let weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  
  return { weekStart, weekEnd };
};

// Get freelancer performance report (weekly/monthly)
router.get('/freelancer-report', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { period = 'monthly', freelancerId } = req.query;
    
    // Calculate date range based on period
    let dateFilter;
    let dateParams = [];
    
    if (period === 'weekly') {
      // Weekly: Thursday 2:00 PM Jordan time to next Thursday 2:00 PM Jordan time
      // Count templates that were SUBMITTED within this period
      const { weekStart, weekEnd } = getWeekBoundaries(0);
      dateFilter = "st.submitted_at >= $PARAM1 AND st.submitted_at < $PARAM2";
      dateParams = [weekStart.toISOString(), weekEnd.toISOString()];
    } else if (period === 'past_week') {
      // Past Week: Previous Thursday 2:00 PM to the Thursday before that
      const { weekStart, weekEnd } = getWeekBoundaries(1);
      dateFilter = "st.submitted_at >= $PARAM1 AND st.submitted_at < $PARAM2";
      dateParams = [weekStart.toISOString(), weekEnd.toISOString()];
    } else if (period === 'monthly') {
      dateFilter = "st.submitted_at >= NOW() - INTERVAL '30 days'";
    } else if (period === 'all') {
      dateFilter = "1=1";
    } else {
      dateFilter = "st.submitted_at >= NOW() - INTERVAL '30 days'";
    }

    let query;
    let params = [];

    // Build query with submission tracking
    // We look for the first time a template reached 'submitted' status in activity_log
    // Fall back to updated_at if no activity log entry exists
    const baseQuery = `
      WITH submission_tracking AS (
        SELECT 
          i.id as idea_id,
          i.status,
          i.price,
          i.assigned_to,
          -- Get first submission time from activity log, or fall back to updated_at for submitted+ statuses
          COALESCE(
            (SELECT MIN(a.created_at) 
             FROM activity_log a 
             WHERE a.idea_id = i.id 
               AND a.action = 'updated' 
               AND (a.details LIKE '%"status":"submitted"%' OR a.details LIKE '%"status": "submitted"%')
            ),
            CASE 
              WHEN i.status IN ('submitted', 'reviewed', 'published', 'needs_fixes') 
              THEN i.updated_at 
              ELSE NULL 
            END
          ) as submitted_at
        FROM ideas i
        WHERE i.assigned_to IS NOT NULL
      )
    `;

    if (freelancerId) {
      // Report for specific freelancer
      const paramOffset = dateParams.length;
      query = `
        ${baseQuery}
        SELECT 
          u.id as freelancer_id,
          u.username,
          u.email,
          COUNT(DISTINCT CASE WHEN ${dateFilter.replace('$PARAM1', `$1`).replace('$PARAM2', `$2`)} THEN st.idea_id END) as total_templates,
          SUM(CASE WHEN st.status = 'published' AND ${dateFilter.replace('$PARAM1', `$1`).replace('$PARAM2', `$2`)} THEN 1 ELSE 0 END) as published,
          SUM(CASE WHEN st.status = 'reviewed' AND ${dateFilter.replace('$PARAM1', `$1`).replace('$PARAM2', `$2`)} THEN 1 ELSE 0 END) as reviewed,
          SUM(CASE WHEN st.status IN ('submitted', 'reviewed', 'published', 'needs_fixes') AND ${dateFilter.replace('$PARAM1', `$1`).replace('$PARAM2', `$2`)} THEN 1 ELSE 0 END) as submitted,
          SUM(CASE WHEN st.status = 'in_progress' AND ${dateFilter.replace('$PARAM1', `$1`).replace('$PARAM2', `$2`)} THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN st.status = 'needs_fixes' AND ${dateFilter.replace('$PARAM1', `$1`).replace('$PARAM2', `$2`)} THEN 1 ELSE 0 END) as needs_fixes,
          SUM(CASE WHEN st.status = 'assigned' AND ${dateFilter.replace('$PARAM1', `$1`).replace('$PARAM2', `$2`)} THEN 1 ELSE 0 END) as assigned,
          COALESCE(SUM(CASE WHEN ${dateFilter.replace('$PARAM1', `$1`).replace('$PARAM2', `$2`)} THEN st.price ELSE 0 END), 0) as total_earnings,
          COALESCE(SUM(CASE WHEN (st.status = 'published' OR st.status = 'reviewed') AND ${dateFilter.replace('$PARAM1', `$1`).replace('$PARAM2', `$2`)} THEN st.price ELSE 0 END), 0) as completed_earnings
        FROM users u
        LEFT JOIN submission_tracking st ON u.id = st.assigned_to
        WHERE u.id = $${dateParams.length + 1} AND u.role = 'freelancer'
        GROUP BY u.id, u.username, u.email
      `;
      params = [...dateParams, freelancerId];
    } else {
      // Report for all freelancers
      query = `
        ${baseQuery}
        SELECT 
          u.id as freelancer_id,
          u.username,
          u.email,
          COUNT(DISTINCT CASE WHEN ${dateFilter.replace('$PARAM1', `$1`).replace('$PARAM2', `$2`)} THEN st.idea_id END) as total_templates,
          SUM(CASE WHEN st.status = 'published' AND ${dateFilter.replace('$PARAM1', `$1`).replace('$PARAM2', `$2`)} THEN 1 ELSE 0 END) as published,
          SUM(CASE WHEN st.status = 'reviewed' AND ${dateFilter.replace('$PARAM1', `$1`).replace('$PARAM2', `$2`)} THEN 1 ELSE 0 END) as reviewed,
          SUM(CASE WHEN st.status IN ('submitted', 'reviewed', 'published', 'needs_fixes') AND ${dateFilter.replace('$PARAM1', `$1`).replace('$PARAM2', `$2`)} THEN 1 ELSE 0 END) as submitted,
          SUM(CASE WHEN st.status = 'in_progress' AND ${dateFilter.replace('$PARAM1', `$1`).replace('$PARAM2', `$2`)} THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN st.status = 'needs_fixes' AND ${dateFilter.replace('$PARAM1', `$1`).replace('$PARAM2', `$2`)} THEN 1 ELSE 0 END) as needs_fixes,
          SUM(CASE WHEN st.status = 'assigned' AND ${dateFilter.replace('$PARAM1', `$1`).replace('$PARAM2', `$2`)} THEN 1 ELSE 0 END) as assigned,
          COALESCE(SUM(CASE WHEN ${dateFilter.replace('$PARAM1', `$1`).replace('$PARAM2', `$2`)} THEN st.price ELSE 0 END), 0) as total_earnings,
          COALESCE(SUM(CASE WHEN (st.status = 'published' OR st.status = 'reviewed') AND ${dateFilter.replace('$PARAM1', `$1`).replace('$PARAM2', `$2`)} THEN st.price ELSE 0 END), 0) as completed_earnings
        FROM users u
        LEFT JOIN submission_tracking st ON u.id = st.assigned_to
        WHERE u.role = 'freelancer'
        GROUP BY u.id, u.username, u.email
        ORDER BY total_templates DESC
      `;
      params = [...dateParams];
    }

    const reports = await db.prepare(query).all(...params);
    
    res.json({
      period,
      reports,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Freelancer report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get template creation rate over time (for graphs)
router.get('/creation-rate', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;
    
    let dateFilter;
    let dateFormat;
    let groupFormat;
    let useSubmissionTime = false;
    
    // PostgreSQL date formatting
    if (period === 'weekly') {
      // For weekly, use submission time and Thursday 2 PM Jordan time as week boundary
      useSubmissionTime = true;
      dateFormat = 'YYYY-MM-DD'; // Group by day
      groupFormat = "TO_CHAR(submission_time.created_at, 'YYYY-MM-DD')";
      dateFilter = `submission_time.created_at >= (
        CASE 
          WHEN EXTRACT(DOW FROM NOW() AT TIME ZONE 'Asia/Amman') < 4 OR 
               (EXTRACT(DOW FROM NOW() AT TIME ZONE 'Asia/Amman') = 4 AND 
                EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Amman') < 14)
          THEN 
            (DATE_TRUNC('week', NOW() AT TIME ZONE 'Asia/Amman') - INTERVAL '4 days' + INTERVAL '14 hours') AT TIME ZONE 'Asia/Amman' AT TIME ZONE 'UTC'
          ELSE 
            (DATE_TRUNC('week', NOW() AT TIME ZONE 'Asia/Amman') + INTERVAL '3 days' + INTERVAL '14 hours') AT TIME ZONE 'Asia/Amman' AT TIME ZONE 'UTC'
        END
      ) AND submission_time.created_at < (
        CASE 
          WHEN EXTRACT(DOW FROM NOW() AT TIME ZONE 'Asia/Amman') < 4 OR 
               (EXTRACT(DOW FROM NOW() AT TIME ZONE 'Asia/Amman') = 4 AND 
                EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Amman') < 14)
          THEN 
            (DATE_TRUNC('week', NOW() AT TIME ZONE 'Asia/Amman') + INTERVAL '3 days' + INTERVAL '14 hours') AT TIME ZONE 'Asia/Amman' AT TIME ZONE 'UTC'
          ELSE 
            (DATE_TRUNC('week', NOW() AT TIME ZONE 'Asia/Amman') + INTERVAL '10 days' + INTERVAL '14 hours') AT TIME ZONE 'Asia/Amman' AT TIME ZONE 'UTC'
        END
      )`;
    } else if (period === 'monthly') {
      dateFilter = "created_at >= NOW() - INTERVAL '30 days'";
      dateFormat = 'YYYY-MM-DD'; // Group by day
      groupFormat = "TO_CHAR(created_at, 'YYYY-MM-DD')";
    } else if (period === 'quarterly') {
      dateFilter = "created_at >= NOW() - INTERVAL '90 days'";
      dateFormat = 'IYYY-IW'; // Group by ISO week
      groupFormat = "TO_CHAR(created_at, 'IYYY-IW')";
    } else if (period === 'yearly') {
      dateFilter = "created_at >= NOW() - INTERVAL '365 days'";
      dateFormat = 'YYYY-MM'; // Group by month
      groupFormat = "TO_CHAR(created_at, 'YYYY-MM')";
    } else {
      dateFilter = "created_at >= NOW() - INTERVAL '30 days'";
      dateFormat = 'YYYY-MM-DD';
      groupFormat = "TO_CHAR(created_at, 'YYYY-MM-DD')";
    }

    // Templates created/submitted over time
    let creationData;
    if (useSubmissionTime) {
      // For weekly, count by submission time
      creationData = await db.prepare(`
        WITH submission_time AS (
          SELECT 
            a.idea_id,
            MIN(a.created_at) as created_at
          FROM activity_log a
          WHERE a.action = 'updated' 
            AND a.details LIKE '%"status"%"submitted"%'
          GROUP BY a.idea_id
        )
        SELECT 
          ${groupFormat} as date,
          COUNT(DISTINCT i.id) as created,
          SUM(CASE WHEN i.status = 'published' THEN 1 ELSE 0 END) as published
        FROM ideas i
        INNER JOIN submission_time ON submission_time.idea_id = i.id
        WHERE ${dateFilter}
        GROUP BY ${groupFormat}
        ORDER BY date ASC
      `).all();
    } else {
      // For other periods, use creation time as before
      creationData = await db.prepare(`
        SELECT 
          ${groupFormat} as date,
          COUNT(*) as created,
          SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published
        FROM ideas
        WHERE ${dateFilter}
        GROUP BY ${groupFormat}
        ORDER BY date ASC
      `).all();
    }

    // Status distribution
    let statusDistribution;
    if (useSubmissionTime) {
      statusDistribution = await db.prepare(`
        WITH submission_time AS (
          SELECT 
            a.idea_id,
            MIN(a.created_at) as created_at
          FROM activity_log a
          WHERE a.action = 'updated' 
            AND a.details LIKE '%"status"%"submitted"%'
          GROUP BY a.idea_id
        )
        SELECT 
          i.status,
          COUNT(DISTINCT i.id) as count
        FROM ideas i
        INNER JOIN submission_time ON submission_time.idea_id = i.id
        WHERE ${dateFilter}
        GROUP BY i.status
        ORDER BY count DESC
      `).all();
    } else {
      statusDistribution = await db.prepare(`
        SELECT 
          status,
          COUNT(*) as count
        FROM ideas
        WHERE ${dateFilter}
        GROUP BY status
        ORDER BY count DESC
      `).all();
    }

    // Top performing freelancers
    let topFreelancers;
    if (useSubmissionTime) {
      topFreelancers = await db.prepare(`
        WITH submission_time AS (
          SELECT 
            a.idea_id,
            MIN(a.created_at) as created_at
          FROM activity_log a
          WHERE a.action = 'updated' 
            AND a.details LIKE '%"status"%"submitted"%'
          GROUP BY a.idea_id
        )
        SELECT 
          u.username,
          COUNT(DISTINCT i.id) as templates_count,
          SUM(CASE WHEN i.status = 'published' THEN 1 ELSE 0 END) as published_count
        FROM users u
        INNER JOIN ideas i ON u.id = i.assigned_to
        INNER JOIN submission_time ON submission_time.idea_id = i.id
        WHERE u.role = 'freelancer' AND ${dateFilter}
        GROUP BY u.id, u.username
        ORDER BY templates_count DESC
        LIMIT 10
      `).all();
    } else {
      topFreelancers = await db.prepare(`
        SELECT 
          u.username,
          COUNT(i.id) as templates_count,
          SUM(CASE WHEN i.status = 'published' THEN 1 ELSE 0 END) as published_count
        FROM users u
        INNER JOIN ideas i ON u.id = i.assigned_to
        WHERE u.role = 'freelancer' AND i.created_at >= NOW() - INTERVAL '${period === 'quarterly' ? '90' : period === 'yearly' ? '365' : '30'} days'
        GROUP BY u.id, u.username
        ORDER BY templates_count DESC
        LIMIT 10
      `).all();
    }

    res.json({
      period,
      creation_over_time: creationData,
      status_distribution: statusDistribution,
      top_freelancers: topFreelancers,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Creation rate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get overall summary statistics
router.get('/summary', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    // Overall stats
    const overall = await db.prepare(`
      SELECT 
        COUNT(*) as total_templates,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN status = 'reviewed' THEN 1 ELSE 0 END) as reviewed,
        SUM(CASE WHEN status IN ('assigned', 'in_progress', 'submitted', 'needs_fixes') THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_templates,
        COALESCE(SUM(price), 0) as total_value
      FROM ideas
    `).get();

    // This month stats (PostgreSQL compatible)
    const thisMonth = await db.prepare(`
      SELECT 
        COUNT(*) as created,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published
      FROM ideas
      WHERE created_at >= DATE_TRUNC('month', NOW())
    `).get();

    // Last month stats (PostgreSQL compatible)
    const lastMonth = await db.prepare(`
      SELECT 
        COUNT(*) as created,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published
      FROM ideas
      WHERE created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '1 month'
        AND created_at < DATE_TRUNC('month', NOW())
    `).get();

    // Active freelancers count
    const activeFreelancers = await db.prepare(`
      SELECT COUNT(DISTINCT assigned_to) as count
      FROM ideas
      WHERE assigned_to IS NOT NULL
        AND created_at >= NOW() - INTERVAL '30 days'
    `).get();

    // Total freelancers
    const totalFreelancers = await db.prepare(`
      SELECT COUNT(*) as count
      FROM users
      WHERE role = 'freelancer'
    `).get();

    res.json({
      overall,
      this_month: thisMonth,
      last_month: lastMonth,
      active_freelancers: activeFreelancers?.count || 0,
      total_freelancers: totalFreelancers?.count || 0,
      month_over_month_growth: lastMonth?.created > 0 
        ? ((thisMonth?.created - lastMonth?.created) / lastMonth?.created * 100).toFixed(1)
        : 0,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get published templates with missing required fields
router.get('/incomplete-published', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    // Required fields for published templates (template_url is optional)
    const incompleteTemplates = await db.prepare(`
      SELECT 
        i.id,
        i.flow_name,
        i.summary,
        i.description,
        i.time_save_per_week,
        i.cost_per_year,
        i.author,
        i.scribe_url,
        i.template_url,
        i.flow_json,
        i.status,
        COALESCE(i.fix_count, 0) as fix_count,
        i.created_at,
        i.updated_at,
        i.assigned_to,
        u.username as assigned_username,
        u.email as assigned_email
      FROM ideas i
      LEFT JOIN users u ON i.assigned_to = u.id
      WHERE i.status = 'published'
        AND (
          i.flow_name IS NULL OR i.flow_name = '' OR
          i.summary IS NULL OR i.summary = '' OR
          i.description IS NULL OR i.description = '' OR
          i.time_save_per_week IS NULL OR i.time_save_per_week = '' OR
          i.cost_per_year IS NULL OR i.cost_per_year = '' OR
          i.author IS NULL OR i.author = '' OR
          i.scribe_url IS NULL OR i.scribe_url = '' OR
          i.flow_json IS NULL OR i.flow_json = ''
        )
      ORDER BY i.updated_at DESC
    `).all();

    // Add missing fields info to each template
    const templatesWithMissingFields = incompleteTemplates.map(template => {
      const missingFields = [];
      if (!template.flow_name) missingFields.push('Flow Name');
      if (!template.summary) missingFields.push('Summary');
      if (!template.description) missingFields.push('Description');
      if (!template.time_save_per_week) missingFields.push('Time Save/Week');
      if (!template.cost_per_year) missingFields.push('Cost/Year');
      if (!template.author) missingFields.push('Author');
      if (!template.scribe_url) missingFields.push('Article/Blog URL');
      if (!template.flow_json) missingFields.push('Flow JSON');
      
      return {
        ...template,
        missing_fields: missingFields,
        missing_count: missingFields.length
      };
    });

    res.json({
      count: templatesWithMissingFields.length,
      templates: templatesWithMissingFields,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Incomplete published templates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get department analytics
router.get('/departments', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const departmentStats = await db.prepare(`
      SELECT 
        d.name as department,
        COUNT(DISTINCT i.id) as template_count,
        SUM(CASE WHEN i.status = 'published' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN i.status IN ('assigned', 'in_progress', 'submitted', 'needs_fixes', 'reviewed') THEN 1 ELSE 0 END) as in_progress
      FROM departments d
      LEFT JOIN idea_departments id ON d.id = id.department_id
      LEFT JOIN ideas i ON id.idea_id = i.id
      GROUP BY d.id, d.name
      ORDER BY template_count DESC
    `).all();

    res.json({
      departments: departmentStats,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Department analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get maintenance data (stale templates, orphans, duplicates, etc.)
router.get('/maintenance', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    // 1. Stale assigned templates (assigned but not updated for 14+ days)
    const staleAssigned = await db.prepare(`
      SELECT 
        i.id,
        i.flow_name,
        i.status,
        COALESCE(i.fix_count, 0) as fix_count,
        i.assigned_to,
        u.username as assigned_username,
        i.updated_at,
        EXTRACT(DAY FROM NOW() - i.updated_at)::integer as days_since_update
      FROM ideas i
      LEFT JOIN users u ON i.assigned_to = u.id
      WHERE i.assigned_to IS NOT NULL
        AND i.status NOT IN ('published', 'archived', 'new')
        AND i.updated_at < NOW() - INTERVAL '14 days'
      ORDER BY i.updated_at ASC
    `).all();

    // 2. Templates without departments
    const noDepartments = await db.prepare(`
      SELECT 
        i.id,
        i.flow_name,
        i.status,
        COALESCE(i.fix_count, 0) as fix_count,
        i.created_at
      FROM ideas i
      LEFT JOIN idea_departments id ON i.id = id.idea_id
      WHERE id.idea_id IS NULL
      ORDER BY i.created_at DESC
    `).all();

    // 3. Templates without flow_json (excluding new status)
    const noFlowJson = await db.prepare(`
      SELECT 
        id,
        flow_name,
        status,
        COALESCE(fix_count, 0) as fix_count,
        created_at
      FROM ideas
      WHERE (flow_json IS NULL OR flow_json = '')
        AND status NOT IN ('new', 'archived')
      ORDER BY created_at DESC
    `).all();

    // 4. Duplicate templates (same flow_name)
    const duplicates = await db.prepare(`
      SELECT 
        flow_name,
        COUNT(*) as count,
        json_agg(json_build_object('id', id, 'status', status, 'fix_count', COALESCE(fix_count, 0), 'created_at', created_at) ORDER BY created_at DESC) as templates
      FROM ideas
      WHERE flow_name IS NOT NULL AND flow_name != ''
      GROUP BY flow_name
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `).all();

    res.json({
      stale_assigned: staleAssigned,
      no_departments: noDepartments,
      no_flow_json: noFlowJson,
      duplicates: duplicates.map(d => ({
        flow_name: d.flow_name,
        count: parseInt(d.count),
        templates: d.templates
      })),
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Maintenance data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
