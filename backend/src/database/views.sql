-- ============================================
-- Database Views for Template Management System
-- ============================================

-- View 1: Templates by Department with Count
-- This view shows all departments with their templates and counts
DROP VIEW IF EXISTS department_summary;
CREATE VIEW department_summary AS
SELECT 
    department,
    COUNT(*) as template_count,
    COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_count,
    COUNT(CASE WHEN status = 'new' THEN 1 END) as new_count,
    SUM(price) as total_value,
    AVG(price) as avg_price
FROM ideas
WHERE department IS NOT NULL AND department != ''
GROUP BY department
ORDER BY template_count DESC;

-- View 2: Templates by Status with Details
-- Shows all templates grouped by their current status
DROP VIEW IF EXISTS status_summary;
CREATE VIEW status_summary AS
SELECT 
    status,
    COUNT(*) as template_count,
    COUNT(DISTINCT department) as departments_count,
    SUM(price) as total_value,
    COUNT(CASE WHEN assigned_to IS NOT NULL THEN 1 END) as assigned_count,
    COUNT(CASE WHEN assigned_to IS NULL THEN 1 END) as unassigned_count
FROM ideas
GROUP BY status
ORDER BY 
    CASE status
        WHEN 'published' THEN 1
        WHEN 'reviewed' THEN 2
        WHEN 'submitted' THEN 3
        WHEN 'in_progress' THEN 4
        WHEN 'assigned' THEN 5
        WHEN 'needs_fixes' THEN 6
        WHEN 'new' THEN 7
    END;

-- View 3: Freelancer Workload
-- Shows each freelancer and their assigned templates
DROP VIEW IF EXISTS freelancer_workload;
CREATE VIEW freelancer_workload AS
SELECT 
    u.id as freelancer_id,
    u.username as freelancer_name,
    u.email as freelancer_email,
    COUNT(i.id) as total_assigned,
    COUNT(CASE WHEN i.status = 'in_progress' THEN 1 END) as in_progress,
    COUNT(CASE WHEN i.status = 'submitted' THEN 1 END) as submitted,
    COUNT(CASE WHEN i.status = 'needs_fixes' THEN 1 END) as needs_fixes,
    COUNT(CASE WHEN i.status = 'published' THEN 1 END) as published,
    SUM(i.price) as total_earnings,
    MAX(i.updated_at) as last_activity
FROM users u
LEFT JOIN ideas i ON u.id = i.assigned_to
WHERE u.role = 'freelancer'
GROUP BY u.id, u.username, u.email
ORDER BY total_assigned DESC;

-- View 4: Detailed Templates View (with user names)
-- Enriched view of all templates with creator and assignee names
DROP VIEW IF EXISTS templates_detailed;
CREATE VIEW templates_detailed AS
SELECT 
    i.id,
    i.use_case,
    i.flow_name,
    i.short_description,
    i.department,
    i.tags,
    i.status,
    i.price,
    i.template_url,
    i.scribe_url,
    i.reviewer_name,
    creator.username as created_by_name,
    creator.email as created_by_email,
    assignee.username as assigned_to_name,
    assignee.email as assigned_to_email,
    i.created_at,
    i.updated_at,
    (SELECT COUNT(*) FROM comments c WHERE c.idea_id = i.id) as comment_count,
    (SELECT COUNT(*) FROM activity_log a WHERE a.idea_id = i.id) as activity_count
FROM ideas i
LEFT JOIN users creator ON i.created_by = creator.id
LEFT JOIN users assignee ON i.assigned_to = assignee.id;

-- View 5: Department Details
-- Detailed view showing all templates in each department
DROP VIEW IF EXISTS department_templates;
CREATE VIEW department_templates AS
SELECT 
    i.department,
    i.id as template_id,
    i.use_case,
    i.flow_name,
    i.status,
    i.price,
    u.username as assigned_to,
    i.created_at,
    i.updated_at
FROM ideas i
LEFT JOIN users u ON i.assigned_to = u.id
WHERE i.department IS NOT NULL AND i.department != ''
ORDER BY i.department, i.created_at DESC;

-- View 6: Tags Analysis
-- Shows all unique tags and how many templates use them
DROP VIEW IF EXISTS tags_summary;
CREATE VIEW tags_summary AS
WITH tag_split AS (
    SELECT 
        id,
        department,
        status,
        price,
        TRIM(value) as tag
    FROM ideas
    CROSS JOIN json_each('["' || REPLACE(REPLACE(tags, ', ', '","'), ',', '","') || '"]')
    WHERE tags IS NOT NULL AND tags != ''
)
SELECT 
    tag,
    COUNT(*) as template_count,
    COUNT(DISTINCT department) as departments_using,
    SUM(price) as total_value,
    COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count
FROM tag_split
GROUP BY tag
ORDER BY template_count DESC;

-- View 7: Recent Activity Dashboard
-- Shows recent template activities for a quick overview
DROP VIEW IF EXISTS recent_activity_dashboard;
CREATE VIEW recent_activity_dashboard AS
SELECT 
    i.id as template_id,
    i.use_case,
    i.department,
    i.status,
    i.price,
    u.username as assigned_to,
    i.updated_at as last_updated,
    (SELECT COUNT(*) FROM comments c WHERE c.idea_id = i.id) as comments,
    (SELECT action FROM activity_log a WHERE a.idea_id = i.id ORDER BY created_at DESC LIMIT 1) as last_action,
    CAST((julianday('now') - julianday(i.updated_at)) AS INTEGER) as days_since_update
FROM ideas i
LEFT JOIN users u ON i.assigned_to = u.id
ORDER BY i.updated_at DESC
LIMIT 50;

-- View 8: Department Performance Metrics
-- Advanced metrics for each department
DROP VIEW IF EXISTS department_performance;
CREATE VIEW department_performance AS
SELECT 
    department,
    COUNT(*) as total_templates,
    COUNT(CASE WHEN status = 'published' THEN 1 END) as published,
    COUNT(CASE WHEN status IN ('in_progress', 'submitted', 'reviewed') THEN 1 END) as in_pipeline,
    COUNT(CASE WHEN status = 'new' THEN 1 END) as not_started,
    ROUND(COUNT(CASE WHEN status = 'published' THEN 1 END) * 100.0 / COUNT(*), 2) as completion_rate,
    SUM(price) as total_value,
    AVG(price) as avg_template_value,
    COUNT(DISTINCT assigned_to) as freelancers_involved,
    MIN(created_at) as first_template_date,
    MAX(updated_at) as last_activity_date
FROM ideas
WHERE department IS NOT NULL AND department != ''
GROUP BY department
ORDER BY total_templates DESC;

-- View 9: Unassigned Templates
-- Quick view of templates that need to be assigned
DROP VIEW IF EXISTS unassigned_templates;
CREATE VIEW unassigned_templates AS
SELECT 
    i.id,
    i.use_case,
    i.department,
    i.status,
    i.price,
    i.short_description,
    creator.username as created_by,
    i.created_at,
    CAST((julianday('now') - julianday(i.created_at)) AS INTEGER) as days_waiting
FROM ideas i
LEFT JOIN users creator ON i.created_by = creator.id
WHERE i.assigned_to IS NULL
ORDER BY i.created_at ASC;

-- View 10: High-Value Templates
-- Templates sorted by price for priority management
DROP VIEW IF EXISTS high_value_templates;
CREATE VIEW high_value_templates AS
SELECT 
    i.id,
    i.use_case,
    i.department,
    i.status,
    i.price,
    u.username as assigned_to,
    i.created_at,
    i.updated_at
FROM ideas i
LEFT JOIN users u ON i.assigned_to = u.id
WHERE i.price > 0
ORDER BY i.price DESC;

