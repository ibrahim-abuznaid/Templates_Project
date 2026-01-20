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

// Get freelancer performance report (weekly/monthly/custom date range)
router.get('/freelancer-report', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { period = 'monthly', freelancerId, startDate, endDate } = req.query;
    
    // Calculate date range based on period
    let dateFilter;
    let dateParams = [];
    let periodInfo = { type: period, startDate: null, endDate: null };
    
    if (period === 'custom' && startDate && endDate) {
      // Custom date range
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include the entire end date
      dateFilter = "st.submitted_at >= $PARAM1 AND st.submitted_at <= $PARAM2";
      dateParams = [start.toISOString(), end.toISOString()];
      periodInfo = { type: 'custom', startDate: start.toISOString(), endDate: end.toISOString() };
    } else if (period === 'weekly') {
      // Weekly: Thursday 2:00 PM Jordan time to next Thursday 2:00 PM Jordan time
      // Count templates that were SUBMITTED within this period
      const { weekStart, weekEnd } = getWeekBoundaries(0);
      dateFilter = "st.submitted_at >= $PARAM1 AND st.submitted_at < $PARAM2";
      dateParams = [weekStart.toISOString(), weekEnd.toISOString()];
      periodInfo = { type: 'weekly', startDate: weekStart.toISOString(), endDate: weekEnd.toISOString() };
    } else if (period === 'past_week') {
      // Past Week: Previous Thursday 2:00 PM to the Thursday before that
      const { weekStart, weekEnd } = getWeekBoundaries(1);
      dateFilter = "st.submitted_at >= $PARAM1 AND st.submitted_at < $PARAM2";
      dateParams = [weekStart.toISOString(), weekEnd.toISOString()];
      periodInfo = { type: 'past_week', startDate: weekStart.toISOString(), endDate: weekEnd.toISOString() };
    } else if (period === 'monthly') {
      dateFilter = "st.submitted_at >= NOW() - INTERVAL '30 days'";
      periodInfo = { type: 'monthly', startDate: null, endDate: null };
    } else if (period === 'all') {
      dateFilter = "1=1";
      periodInfo = { type: 'all', startDate: null, endDate: null };
    } else {
      dateFilter = "st.submitted_at >= NOW() - INTERVAL '30 days'";
      periodInfo = { type: 'monthly', startDate: null, endDate: null };
    }

    let query;
    let params = [];

    // Build query with submission tracking
    // We look for the first time a template reached 'submitted' status in activity_log
    // IMPORTANT: Only use activity_log - do NOT fall back to updated_at as that changes on every edit
    const baseQuery = `
      WITH submission_tracking AS (
        SELECT 
          i.id as idea_id,
          i.status,
          i.price,
          i.assigned_to,
          -- Get first submission time from activity log ONLY
          -- No fallback to updated_at - that would count edits as submissions
          (SELECT MIN(a.created_at) 
           FROM activity_log a 
           WHERE a.idea_id = i.id 
             AND a.action = 'updated' 
             AND (a.details LIKE '%"status":"submitted"%' OR a.details LIKE '%"status": "submitted"%')
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
      periodInfo,
      reports,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Freelancer report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get detailed templates for a specific freelancer within a period
router.get('/freelancer-details/:freelancerId', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { freelancerId } = req.params;
    const { period = 'monthly', startDate, endDate } = req.query;
    
    // Calculate date range based on period
    let dateFilter;
    let dateParams = [];
    let periodInfo = { type: period, startDate: null, endDate: null };
    
    if (period === 'custom' && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = "submitted_at >= $1 AND submitted_at <= $2";
      dateParams = [start.toISOString(), end.toISOString()];
      periodInfo = { type: 'custom', startDate: start.toISOString(), endDate: end.toISOString() };
    } else if (period === 'weekly') {
      const { weekStart, weekEnd } = getWeekBoundaries(0);
      dateFilter = "submitted_at >= $1 AND submitted_at < $2";
      dateParams = [weekStart.toISOString(), weekEnd.toISOString()];
      periodInfo = { type: 'weekly', startDate: weekStart.toISOString(), endDate: weekEnd.toISOString() };
    } else if (period === 'past_week') {
      const { weekStart, weekEnd } = getWeekBoundaries(1);
      dateFilter = "submitted_at >= $1 AND submitted_at < $2";
      dateParams = [weekStart.toISOString(), weekEnd.toISOString()];
      periodInfo = { type: 'past_week', startDate: weekStart.toISOString(), endDate: weekEnd.toISOString() };
    } else if (period === 'monthly') {
      dateFilter = "submitted_at >= NOW() - INTERVAL '30 days'";
      periodInfo = { type: 'monthly', startDate: null, endDate: null };
    } else if (period === 'all') {
      dateFilter = "1=1";
      periodInfo = { type: 'all', startDate: null, endDate: null };
    } else {
      dateFilter = "submitted_at >= NOW() - INTERVAL '30 days'";
      periodInfo = { type: 'monthly', startDate: null, endDate: null };
    }

    // Get freelancer info
    const freelancer = await db.prepare(`
      SELECT id, username, email FROM users WHERE id = $1 AND role = 'freelancer'
    `).get(freelancerId);

    if (!freelancer) {
      return res.status(404).json({ error: 'Freelancer not found' });
    }

    // Get templates with their submission times
    // ONLY use activity_log - no fallback to updated_at
    const query = `
      WITH submission_tracking AS (
        SELECT 
          i.id as idea_id,
          i.flow_name,
          i.status,
          i.price,
          i.assigned_to,
          i.created_at,
          i.updated_at,
          COALESCE(i.fix_count, 0) as fix_count,
          (SELECT MIN(a.created_at) 
           FROM activity_log a 
           WHERE a.idea_id = i.id 
             AND a.action = 'updated' 
             AND (a.details LIKE '%"status":"submitted"%' OR a.details LIKE '%"status": "submitted"%')
          ) as submitted_at
        FROM ideas i
        WHERE i.assigned_to = $${dateParams.length + 1}
      )
      SELECT 
        idea_id,
        flow_name,
        status,
        price,
        fix_count,
        created_at,
        updated_at,
        submitted_at
      FROM submission_tracking
      WHERE submitted_at IS NOT NULL AND ${dateFilter}
      ORDER BY submitted_at DESC
    `;

    const templates = await db.prepare(query).all(...dateParams, freelancerId);

    // Calculate summary stats
    const summary = {
      total: templates.length,
      submitted: templates.filter(t => t.status === 'submitted').length,
      needs_fixes: templates.filter(t => t.status === 'needs_fixes').length,
      reviewed: templates.filter(t => t.status === 'reviewed').length,
      published: templates.filter(t => t.status === 'published').length,
      total_earnings: templates.reduce((sum, t) => sum + parseFloat(t.price || 0), 0),
      completed_earnings: templates
        .filter(t => ['reviewed', 'published'].includes(t.status))
        .reduce((sum, t) => sum + parseFloat(t.price || 0), 0)
    };

    res.json({
      freelancer: {
        id: freelancer.id,
        username: freelancer.username,
        email: freelancer.email
      },
      period,
      periodInfo,
      summary,
      templates: templates.map(t => ({
        id: t.idea_id,
        flowName: t.flow_name,
        status: t.status,
        price: parseFloat(t.price || 0),
        fixCount: t.fix_count,
        createdAt: t.created_at,
        submittedAt: t.submitted_at,
        updatedAt: t.updated_at
      })),
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Freelancer details error:', error);
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

// ========================================
// Template Analytics Endpoints (Internal)
// These endpoints expose analytics data collected via the public API
// ========================================

// Get analytics for a specific template by its public library ID
router.get('/template/:publicLibraryId', authenticateToken, async (req, res) => {
  try {
    const { publicLibraryId } = req.params;

    if (!publicLibraryId) {
      return res.status(400).json({ error: 'Public library ID is required' });
    }

    const analytics = await db.prepare(`
      SELECT * FROM template_analytics WHERE template_id = $1
    `).get(publicLibraryId);

    if (!analytics) {
      // Return empty analytics if not found
      return res.json({
        templateId: publicLibraryId,
        totalViews: 0,
        totalInstalls: 0,
        uniqueUsersInstalled: 0,
        activeFlows: 0,
        conversionRate: 0,
        installedByUserIds: [],
        activeFlowIds: [],
        exists: false
      });
    }

    const conversionRate = analytics.total_views > 0 
      ? ((analytics.total_installs / analytics.total_views) * 100).toFixed(2)
      : 0;

    res.json({
      templateId: analytics.template_id,
      totalViews: analytics.total_views,
      totalInstalls: analytics.total_installs,
      uniqueUsersInstalled: analytics.installed_by_user_ids?.length || 0,
      activeFlows: analytics.active_flow_ids?.length || 0,
      conversionRate: parseFloat(conversionRate),
      installedByUserIds: analytics.installed_by_user_ids || [],
      activeFlowIds: analytics.active_flow_ids || [],
      exists: true,
      updatedAt: analytics.updated_at
    });
  } catch (error) {
    console.error('Get template analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get analytics for a template by its internal idea ID
router.get('/template/by-idea/:ideaId', authenticateToken, async (req, res) => {
  try {
    const { ideaId } = req.params;

    // Get the idea to find its public library ID
    const idea = await db.prepare(`
      SELECT id, flow_name, public_library_id, status FROM ideas WHERE id = $1
    `).get(ideaId);

    if (!idea) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (!idea.public_library_id) {
      return res.json({
        ideaId: parseInt(ideaId),
        flowName: idea.flow_name,
        status: idea.status,
        isPublished: false,
        analytics: null,
        message: 'Template not yet published to public library'
      });
    }

    const analytics = await db.prepare(`
      SELECT * FROM template_analytics WHERE template_id = $1
    `).get(idea.public_library_id);

    const analyticsData = analytics ? {
      totalViews: analytics.total_views,
      totalInstalls: analytics.total_installs,
      uniqueUsersInstalled: analytics.installed_by_user_ids?.length || 0,
      activeFlows: analytics.active_flow_ids?.length || 0,
      conversionRate: analytics.total_views > 0 
        ? parseFloat(((analytics.total_installs / analytics.total_views) * 100).toFixed(2))
        : 0,
      installedByUserIds: analytics.installed_by_user_ids || [],
      activeFlowIds: analytics.active_flow_ids || [],
      updatedAt: analytics.updated_at
    } : {
      totalViews: 0,
      totalInstalls: 0,
      uniqueUsersInstalled: 0,
      activeFlows: 0,
      conversionRate: 0,
      installedByUserIds: [],
      activeFlowIds: []
    };

    res.json({
      ideaId: parseInt(ideaId),
      flowName: idea.flow_name,
      publicLibraryId: idea.public_library_id,
      status: idea.status,
      isPublished: true,
      analytics: analyticsData
    });
  } catch (error) {
    console.error('Get template analytics by idea error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get analytics for all published templates
router.get('/templates/published', authenticateToken, async (req, res) => {
  try {
    // Get all published templates with their analytics
    // Join through idea_departments to get category (first department)
    const templates = await db.prepare(`
      SELECT 
        i.id as idea_id,
        i.flow_name,
        i.public_library_id,
        i.status,
        i.created_at as published_at,
        u.username as assigned_to_name,
        COALESCE(d.name, i.department) as category,
        COALESCE(ta.total_views, 0) as total_views,
        COALESCE(ta.total_installs, 0) as total_installs,
        COALESCE(array_length(ta.installed_by_user_ids, 1), 0) as unique_users_installed,
        COALESCE(array_length(ta.active_flow_ids, 1), 0) as active_flows,
        ta.installed_by_user_ids,
        ta.active_flow_ids
      FROM ideas i
      LEFT JOIN users u ON i.assigned_to = u.id
      LEFT JOIN idea_departments id ON id.idea_id = i.id
      LEFT JOIN departments d ON d.id = id.department_id
      LEFT JOIN template_analytics ta ON i.public_library_id = ta.template_id
      WHERE i.status = 'published' AND i.public_library_id IS NOT NULL
      GROUP BY i.id, i.flow_name, i.public_library_id, i.status, i.created_at, u.username, d.name, i.department,
               ta.total_views, ta.total_installs, ta.installed_by_user_ids, ta.active_flow_ids
      ORDER BY COALESCE(ta.total_installs, 0) DESC
    `).all();

    const results = templates.map(t => ({
      ideaId: t.idea_id,
      flowName: t.flow_name,
      publicLibraryId: t.public_library_id,
      category: t.category || 'Uncategorized',
      assignedTo: t.assigned_to_name,
      publishedAt: t.published_at,
      totalViews: t.total_views,
      totalInstalls: t.total_installs,
      uniqueUsers: t.unique_users_installed,
      activeFlows: t.active_flows,
      conversionRate: t.total_views > 0 
        ? parseFloat(((t.total_installs / t.total_views) * 100).toFixed(2))
        : 0,
      installedByUserIds: t.installed_by_user_ids || [],
      activeFlowIds: t.active_flow_ids || []
    }));

    // Calculate summary stats
    const summary = {
      totalTemplates: results.length,
      totalViews: results.reduce((sum, t) => sum + t.totalViews, 0),
      totalInstalls: results.reduce((sum, t) => sum + t.totalInstalls, 0),
      totalActiveFlows: results.reduce((sum, t) => sum + t.activeFlows, 0),
      templatesWithInstalls: results.filter(t => t.totalInstalls > 0).length
    };

    res.json({
      summary,
      templates: results,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get published templates analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get template analytics overview (for dashboard)
router.get('/templates/overview', authenticateToken, async (req, res) => {
  try {
    // Overall stats
    const overallStats = await db.prepare(`
      SELECT 
        COALESCE(SUM(total_views), 0) as total_views,
        COALESCE(SUM(total_installs), 0) as total_installs,
        COALESCE(SUM(array_length(active_flow_ids, 1)), 0) as total_active_flows,
        COUNT(*) as tracked_templates
      FROM template_analytics
    `).get();

    // Unique users
    const uniqueUsers = await db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM (
        SELECT unnest(installed_by_user_ids) as user_id FROM template_analytics
      ) as users
    `).get();

    // Top 5 templates by installs
    const topByInstalls = await db.prepare(`
      SELECT 
        i.id as idea_id,
        i.flow_name,
        i.public_library_id,
        COALESCE(ta.total_views, 0) as total_views,
        COALESCE(ta.total_installs, 0) as total_installs
      FROM ideas i
      INNER JOIN template_analytics ta ON i.public_library_id = ta.template_id
      WHERE i.status = 'published'
      ORDER BY ta.total_installs DESC
      LIMIT 5
    `).all();

    // Top 5 templates by views
    const topByViews = await db.prepare(`
      SELECT 
        i.id as idea_id,
        i.flow_name,
        i.public_library_id,
        COALESCE(ta.total_views, 0) as total_views,
        COALESCE(ta.total_installs, 0) as total_installs
      FROM ideas i
      INNER JOIN template_analytics ta ON i.public_library_id = ta.template_id
      WHERE i.status = 'published'
      ORDER BY ta.total_views DESC
      LIMIT 5
    `).all();

    // Explore page analytics
    const exploreStats = await db.prepare(`
      SELECT 
        COALESCE(total_views, 0) as total_views,
        COALESCE(array_length(viewed_by_user_ids, 1), 0) as unique_users
      FROM explore_analytics
      LIMIT 1
    `).get();

    // Published templates count
    const publishedCount = await db.prepare(`
      SELECT COUNT(*) as count FROM ideas WHERE status = 'published' AND public_library_id IS NOT NULL
    `).get();

    const conversionRate = parseInt(overallStats?.total_views || 0) > 0 
      ? ((parseInt(overallStats?.total_installs || 0) / parseInt(overallStats?.total_views || 0)) * 100).toFixed(2)
      : 0;

    res.json({
      overview: {
        totalViews: parseInt(overallStats?.total_views || 0),
        totalInstalls: parseInt(overallStats?.total_installs || 0),
        totalActiveFlows: parseInt(overallStats?.total_active_flows || 0),
        uniqueUsersInstalled: parseInt(uniqueUsers?.count || 0),
        conversionRate: parseFloat(conversionRate),
        publishedTemplates: parseInt(publishedCount?.count || 0),
        trackedTemplates: parseInt(overallStats?.tracked_templates || 0)
      },
      explore: {
        totalClicks: parseInt(exploreStats?.total_views || 0),
        uniqueUsers: parseInt(exploreStats?.unique_users || 0)
      },
      topByInstalls: topByInstalls.map(t => ({
        ideaId: t.idea_id,
        flowName: t.flow_name,
        publicLibraryId: t.public_library_id,
        totalViews: t.total_views,
        totalInstalls: t.total_installs
      })),
      topByViews: topByViews.map(t => ({
        ideaId: t.idea_id,
        flowName: t.flow_name,
        publicLibraryId: t.public_library_id,
        totalViews: t.total_views,
        totalInstalls: t.total_installs
      })),
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get templates overview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get analytics by category/department
router.get('/templates/by-category', authenticateToken, async (req, res) => {
  try {
    const categoryStats = await db.prepare(`
      SELECT 
        d.id as department_id,
        d.name as category,
        COUNT(DISTINCT i.id) as available_templates,
        COALESCE(SUM(ta.total_views), 0) as total_views,
        COALESCE(SUM(ta.total_installs), 0) as total_installs,
        COUNT(DISTINCT CASE WHEN ta.total_installs > 0 THEN i.id END) as installed_at_least_once,
        COALESCE(SUM(array_length(ta.active_flow_ids, 1)), 0) as active_flows
      FROM departments d
      LEFT JOIN idea_departments id ON d.id = id.department_id
      LEFT JOIN ideas i ON id.idea_id = i.id AND i.status = 'published' AND i.public_library_id IS NOT NULL
      LEFT JOIN template_analytics ta ON i.public_library_id = ta.template_id
      GROUP BY d.id, d.name
      ORDER BY total_installs DESC
    `).all();

    const results = categoryStats.map(cat => ({
      departmentId: cat.department_id,
      category: cat.category,
      availableTemplates: parseInt(cat.available_templates),
      totalViews: parseInt(cat.total_views),
      totalInstalls: parseInt(cat.total_installs),
      installedAtLeastOnce: parseInt(cat.installed_at_least_once),
      activeFlows: parseInt(cat.active_flows),
      avgInstallsPerTemplate: cat.available_templates > 0 
        ? parseFloat((cat.total_installs / cat.available_templates).toFixed(2))
        : 0,
      conversionRate: cat.total_views > 0 
        ? parseFloat(((cat.total_installs / cat.total_views) * 100).toFixed(2))
        : 0
    }));

    res.json({
      categories: results,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get category analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get integration/piece analytics - most used pieces across all templates
router.get('/integrations', authenticateToken, async (req, res) => {
  try {
    // Get all published templates with their flow_steps
    const templates = await db.prepare(`
      SELECT 
        i.id,
        i.flow_name,
        i.flow_steps,
        i.public_library_id,
        COALESCE(ta.total_installs, 0) as total_installs,
        COALESCE(ta.total_views, 0) as total_views
      FROM ideas i
      LEFT JOIN template_analytics ta ON i.public_library_id = ta.template_id
      WHERE i.flow_steps IS NOT NULL AND i.flow_steps != ''
    `).all();

    // Aggregate piece usage
    const pieceStats = {};
    let totalTemplatesWithPieces = 0;

    templates.forEach(template => {
      let steps = [];
      try {
        steps = typeof template.flow_steps === 'string' 
          ? JSON.parse(template.flow_steps) 
          : template.flow_steps;
      } catch (e) {
        return;
      }

      if (!Array.isArray(steps) || steps.length === 0) return;
      
      totalTemplatesWithPieces++;
      const piecesInTemplate = new Set();

      steps.forEach(step => {
        const pieceName = step.pieceName || step.pieceDisplayName;
        if (!pieceName) return;

        // Track unique pieces per template
        if (!piecesInTemplate.has(pieceName)) {
          piecesInTemplate.add(pieceName);
          
          if (!pieceStats[pieceName]) {
            pieceStats[pieceName] = {
              pieceName: pieceName,
              displayName: step.pieceDisplayName || pieceName,
              templateCount: 0,
              totalInstalls: 0,
              triggerCount: 0,
              actionCount: 0,
              templates: []
            };
          }
          
          pieceStats[pieceName].templateCount++;
          pieceStats[pieceName].totalInstalls += template.total_installs || 0;
          pieceStats[pieceName].templates.push({
            id: template.id,
            flowName: template.flow_name,
            installs: template.total_installs || 0
          });
        }

        // Count triggers vs actions
        if (step.type === 'PIECE_TRIGGER') {
          pieceStats[pieceName].triggerCount++;
        } else {
          pieceStats[pieceName].actionCount++;
        }
      });
    });

    // Convert to array and sort by template count
    const pieceList = Object.values(pieceStats)
      .map(p => ({
        ...p,
        templates: p.templates.slice(0, 5) // Only include top 5 templates per piece
      }))
      .sort((a, b) => b.templateCount - a.templateCount);

    // Top pieces by different metrics
    const topByTemplateCount = pieceList.slice(0, 10);
    const topByInstalls = [...pieceList].sort((a, b) => b.totalInstalls - a.totalInstalls).slice(0, 10);

    res.json({
      summary: {
        totalPieces: pieceList.length,
        totalTemplatesWithPieces,
        totalTemplates: templates.length
      },
      topByTemplateCount,
      topByInstalls,
      allPieces: pieceList,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get integration analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
