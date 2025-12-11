# Database Views Documentation

This document describes all the database views available in the Template Management System and how to use them.

## Overview

We've created 10 powerful database views that provide different perspectives on your template data. These views are automatically created when the database initializes.

---

## Available Views

### 1. **Department Summary** (`department_summary`)

**Purpose**: Shows all departments with template counts and metrics.

**Columns**:
- `department` - Department name
- `template_count` - Total templates in this department
- `published_count` - Number of published templates
- `in_progress_count` - Number of templates in progress
- `new_count` - Number of new templates
- `total_value` - Sum of all template prices
- `avg_price` - Average price per template

**API Endpoint**: `GET /api/views/departments`

**Use Case**: Perfect for displaying a dashboard showing all departments and their template counts. Click on a department to drill down.

**Example Response**:
```json
[
  {
    "department": "Marketing",
    "template_count": 15,
    "published_count": 10,
    "in_progress_count": 3,
    "new_count": 2,
    "total_value": 1500.00,
    "avg_price": 100.00
  }
]
```

---

### 2. **Department Templates** (`department_templates`)

**Purpose**: Shows all templates within each department with details.

**Columns**:
- `department` - Department name
- `template_id` - Template ID
- `use_case` - Template use case
- `flow_name` - Flow name
- `status` - Current status
- `price` - Template price
- `assigned_to` - Username of assigned freelancer
- `created_at` - Creation date
- `updated_at` - Last update date

**API Endpoint**: `GET /api/views/departments/:department/templates`

**Use Case**: When a user clicks on a department, show all templates in that department.

---

### 3. **Department Performance** (`department_performance`)

**Purpose**: Advanced metrics and analytics for each department.

**Columns**:
- `department` - Department name
- `total_templates` - Total number of templates
- `published` - Published templates
- `in_pipeline` - Templates in progress/submitted/reviewed
- `not_started` - New templates not yet started
- `completion_rate` - Percentage of published templates
- `total_value` - Sum of all prices
- `avg_template_value` - Average price
- `freelancers_involved` - Number of freelancers working on this department
- `first_template_date` - When the first template was created
- `last_activity_date` - Most recent activity

**API Endpoint**: `GET /api/views/departments/performance`

**Use Case**: Analytics dashboard showing department health and performance.

---

### 4. **Status Summary** (`status_summary`)

**Purpose**: Templates grouped by their current status.

**Columns**:
- `status` - Status name
- `template_count` - Number of templates with this status
- `departments_count` - How many departments have templates in this status
- `total_value` - Total value of templates in this status
- `assigned_count` - How many are assigned
- `unassigned_count` - How many are unassigned

**API Endpoint**: `GET /api/views/status`

**Use Case**: Pipeline view showing workflow stages and bottlenecks.

---

### 5. **Freelancer Workload** (`freelancer_workload`)

**Purpose**: Shows each freelancer's assigned templates and workload.

**Columns**:
- `freelancer_id` - Freelancer user ID
- `freelancer_name` - Freelancer username
- `freelancer_email` - Email address
- `total_assigned` - Total templates assigned
- `in_progress` - Templates in progress
- `submitted` - Templates submitted
- `needs_fixes` - Templates needing fixes
- `published` - Published templates
- `total_earnings` - Sum of template prices
- `last_activity` - Last activity timestamp

**API Endpoints**: 
- `GET /api/views/freelancers/workload` - All freelancers
- `GET /api/views/freelancers/:id/workload` - Specific freelancer

**Use Case**: Resource management, workload balancing, freelancer performance tracking.

---

### 6. **Templates Detailed** (`templates_detailed`)

**Purpose**: Enriched view of all templates with creator and assignee names.

**Columns**:
- All template fields
- `created_by_name` - Username of creator
- `created_by_email` - Email of creator
- `assigned_to_name` - Username of assignee
- `assigned_to_email` - Email of assignee
- `comment_count` - Number of comments
- `activity_count` - Number of activity log entries

**API Endpoint**: `GET /api/views/templates/detailed?department=X&status=Y`

**Query Parameters**:
- `department` (optional) - Filter by department
- `status` (optional) - Filter by status
- `assigned_to` (optional) - Filter by freelancer name

**Use Case**: Main templates list with all details in one view.

---

### 7. **Tags Summary** (`tags_summary`)

**Purpose**: Analysis of all tags used across templates.

**Columns**:
- `tag` - Tag name
- `template_count` - How many templates use this tag
- `departments_using` - How many departments use this tag
- `total_value` - Total value of templates with this tag
- `published_count` - Published templates with this tag

**API Endpoint**: `GET /api/views/tags`

**Use Case**: Tag cloud, filtering by tags, finding similar templates.

---

### 8. **Recent Activity Dashboard** (`recent_activity_dashboard`)

**Purpose**: Recent template activities for quick overview.

**Columns**:
- `template_id` - Template ID
- `use_case` - Template use case
- `department` - Department
- `status` - Current status
- `price` - Price
- `assigned_to` - Assigned freelancer
- `last_updated` - Last update timestamp
- `comments` - Comment count
- `last_action` - Most recent action
- `days_since_update` - Days since last update

**API Endpoint**: `GET /api/views/recent-activity?limit=50`

**Query Parameters**:
- `limit` (optional, default: 50) - Number of recent items

**Use Case**: Dashboard showing what's happening recently, activity feed.

---

### 9. **Unassigned Templates** (`unassigned_templates`)

**Purpose**: Templates that need to be assigned to freelancers.

**Columns**:
- `id` - Template ID
- `use_case` - Use case
- `department` - Department
- `status` - Status
- `price` - Price
- `short_description` - Short description
- `created_by` - Creator username
- `created_at` - Creation date
- `days_waiting` - Days since creation

**API Endpoint**: `GET /api/views/unassigned`

**Use Case**: Assignment queue, alerts for old unassigned templates.

---

### 10. **High-Value Templates** (`high_value_templates`)

**Purpose**: Templates sorted by price for priority management.

**Columns**:
- `id` - Template ID
- `use_case` - Use case
- `department` - Department
- `status` - Status
- `price` - Price (sorted desc)
- `assigned_to` - Assigned freelancer
- `created_at` - Creation date
- `updated_at` - Last update

**API Endpoint**: `GET /api/views/high-value?limit=20`

**Query Parameters**:
- `limit` (optional, default: 20) - Number of templates to return

**Use Case**: Priority queue, revenue tracking, high-value project management.

---

## Special Endpoint: Dashboard Overview

**Endpoint**: `GET /api/views/dashboard`

**Purpose**: Combines multiple views into a single response for a comprehensive dashboard.

**Response includes**:
- Department summary
- Status summary
- Recent activity (last 10 items)
- Unassigned template count
- Freelancer workload

**Use Case**: Single API call to populate an admin dashboard with all key metrics.

---

## Implementation Notes

1. **Automatic Creation**: All views are created automatically when `initDatabase()` is called on server startup.

2. **Real-time Data**: Views always reflect the current state of the database - they're not cached.

3. **Performance**: Views are pre-computed queries, making them faster than running complex joins every time.

4. **Authentication**: All view endpoints require authentication via the `authenticateToken` middleware.

5. **Error Handling**: All endpoints include proper error handling and return appropriate error messages.

---

## Frontend Integration Examples

### Example 1: Department View

```javascript
// Fetch all departments
const response = await fetch('/api/views/departments', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const departments = await response.json();

// When user clicks a department, fetch its templates
const deptResponse = await fetch(`/api/views/departments/${department}/templates`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const templates = await deptResponse.json();
```

### Example 2: Dashboard

```javascript
// Single call to get all dashboard data
const response = await fetch('/api/views/dashboard', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const dashboardData = await response.json();
// Use dashboardData.departments, dashboardData.statuses, etc.
```

### Example 3: Freelancer Workload

```javascript
// Get all freelancers and their workload
const response = await fetch('/api/views/freelancers/workload', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const freelancers = await response.json();
```

---

## Database Schema Reference

The views are based on these main tables:

- **users** - Admin and freelancer accounts
- **ideas** - Templates/Ideas with department, status, tags, etc.
- **comments** - Comments on templates
- **activity_log** - Activity history

---

## Tips for Best UX

1. **Department View**: 
   - Show department cards with template counts
   - Make them clickable to drill down
   - Show completion rates and total value

2. **Status Pipeline**:
   - Use a Kanban-style board
   - Show template counts in each column
   - Allow drag-and-drop to change status

3. **Freelancer Dashboard**:
   - Show workload distribution
   - Highlight overloaded freelancers
   - Show earnings and performance metrics

4. **Priority Management**:
   - Use high-value templates view for priority queue
   - Show unassigned templates prominently
   - Alert on templates with `days_waiting` > 7

5. **Analytics**:
   - Use department performance for charts
   - Show trends over time
   - Compare departments side-by-side

---

## Need More Views?

If you need additional views or modifications to existing ones:

1. Add your view definition to `backend/src/database/views.sql`
2. The view will be created automatically on next server restart
3. Add a corresponding endpoint in `backend/src/routes/views.js`
4. Document it here for your team

---

## Troubleshooting

**Views not created?**
- Check console for error messages during database initialization
- Ensure `views.sql` syntax is correct
- Restart the server to recreate views

**Data not updating?**
- Views reflect real-time data automatically
- If you see stale data, check if the underlying tables are updating
- Verify your queries are using the correct view names

**Performance issues?**
- Views are already optimized with proper indexes
- For very large datasets, consider adding pagination
- Use query parameters to filter data client-side

---

## Summary

You now have 10 powerful views and corresponding API endpoints that provide:

✅ **Department Management** - View templates by department with counts and metrics  
✅ **Status Tracking** - Monitor workflow pipeline and bottlenecks  
✅ **Resource Management** - Track freelancer workload and assignments  
✅ **Priority Queue** - Manage high-value and unassigned templates  
✅ **Analytics** - Performance metrics and trends  
✅ **Activity Monitoring** - Recent changes and updates  
✅ **Tag Analysis** - Discover patterns and relationships  
✅ **Detailed Views** - Enriched data with user information  

All endpoints are secured with authentication and include proper error handling!

