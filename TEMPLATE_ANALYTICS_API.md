# Template Analytics API Documentation

## Overview

The Template Analytics system tracks usage metrics for published templates, including views, installs, and active flows created from templates. This data is collected via external API endpoints and displayed in the internal dashboard.

---

## External API Endpoints (for Activepieces team)

These endpoints are secured with an API key and used by the Activepieces product to track template usage.

**Base URL:** `<YOUR_SERVER_URL>/api/public/analytics`  
**Auth Header:** `X-API-Key: <TEMPLATE_ANALYTICS_API_KEY>`

---

### 1. Track Template View

Track when a user views a template page.

```
POST /templates/:id/view
Headers:
  X-API-Key: <TEMPLATE_ANALYTICS_API_KEY>

Parameters:
  :id - The public_library_id of the template

Response:
{
  "success": true,
  "message": "View recorded",
  "analytics": {
    "templateId": "template_id_xxx",
    "totalViews": 150,
    "totalInstalls": 25
  }
}
```

---

### 2. Track Template Install

Track when a user installs/uses a template.

```
POST /templates/:id/install
Headers:
  X-API-Key: <TEMPLATE_ANALYTICS_API_KEY>
  Content-Type: application/json

Parameters:
  :id - The public_library_id of the template

Body:
{
  "userId": "user_id_xxx"
}

Response:
{
  "success": true,
  "message": "Install recorded",
  "analytics": {
    "templateId": "template_id_xxx",
    "totalViews": 150,
    "totalInstalls": 26,
    "uniqueUsers": 20
  }
}
```

---

### 3. Track Flow Activation

Track when a flow is created/activated from a template.

```
POST /templates/:id/activate
Headers:
  X-API-Key: <TEMPLATE_ANALYTICS_API_KEY>
  Content-Type: application/json

Parameters:
  :id - The public_library_id of the template

Body:
{
  "flowId": "flow_id_xxx"
}

Response:
{
  "success": true,
  "message": "Flow activation recorded",
  "analytics": {
    "templateId": "template_id_xxx",
    "activeFlows": 15
  }
}
```

---

### 4. Track Flow Deactivation

Track when a flow is deleted/disabled (optional cleanup).

```
POST /templates/:id/deactivate
Headers:
  X-API-Key: <TEMPLATE_ANALYTICS_API_KEY>
  Content-Type: application/json

Parameters:
  :id - The public_library_id of the template

Body:
{
  "flowId": "flow_id_xxx"
}

Response:
{
  "success": true,
  "message": "Flow deactivation recorded",
  "analytics": {
    "templateId": "template_id_xxx",
    "activeFlows": 14
  }
}
```

---

### 5. Track Explore/Discover Page View

Track when a user views the explore/discover page.

```
POST /explore/view
Headers:
  X-API-Key: <TEMPLATE_ANALYTICS_API_KEY>
  Content-Type: application/json

Body:
{
  "userId": "user_id_xxx"  // Optional
}

Response:
{
  "success": true,
  "message": "Explore view recorded",
  "analytics": {
    "totalViews": 5000,
    "uniqueUsers": 1200
  }
}
```

---

## GET Endpoints (for retrieving analytics)

### Get Template Analytics

```
GET /templates/:id
Headers:
  X-API-Key: <TEMPLATE_ANALYTICS_API_KEY>

Response:
{
  "templateId": "template_id_xxx",
  "totalViews": 150,
  "totalInstalls": 26,
  "uniqueUsersInstalled": 20,
  "activeFlows": 15,
  "conversionRate": 17.33,
  "createdAt": "2025-01-15T...",
  "updatedAt": "2025-01-17T..."
}
```

### Get All Templates Analytics

```
GET /templates
Headers:
  X-API-Key: <TEMPLATE_ANALYTICS_API_KEY>

Response:
{
  "count": 50,
  "templates": [
    {
      "templateId": "template_id_xxx",
      "totalViews": 150,
      "totalInstalls": 26,
      "uniqueUsersInstalled": 20,
      "activeFlows": 15,
      "conversionRate": 17.33,
      "updatedAt": "2025-01-17T..."
    },
    ...
  ]
}
```

### Get Explore Page Analytics

```
GET /explore
Headers:
  X-API-Key: <TEMPLATE_ANALYTICS_API_KEY>

Response:
{
  "totalViews": 5000,
  "uniqueUsers": 1200,
  "conversionRate": 0.52,
  "totalInstallsFromExplore": 26
}
```

### Get Full Summary

```
GET /summary
Headers:
  X-API-Key: <TEMPLATE_ANALYTICS_API_KEY>

Response:
{
  "perTemplate": {
    "totalViews": 10000,
    "totalInstalls": 500,
    "uniqueUsersInstalled": 350,
    "activeFlows": 200,
    "conversionRate": 5.0
  },
  "perCategory": [
    {
      "category": "HR",
      "available_templates": 10,
      "total_installs": 100,
      "installed_at_least_once": 8,
      "active_flows": 30,
      "avg_installs_per_template": 10.0
    },
    ...
  ],
  "perUser": {
    "totalUsersInstalled": 350,
    "averageTemplatesPerUser": 1.43
  },
  "discoverPage": {
    "totalClicks": 5000,
    "uniqueUsers": 1200,
    "conversionRate": 10.0
  },
  "metadata": {
    "totalTrackedTemplates": 50,
    "templatesInstalledAtLeastOnce": 40,
    "averageInstallsPerTemplate": 10.0
  },
  "generatedAt": "2025-01-17T..."
}
```

---

## Environment Variables

Add the following to your `.env` file:

```
# Template Analytics API Key (required for external API access)
TEMPLATE_ANALYTICS_API_KEY=your-secure-api-key-here
```

> **Security Note:** Generate a strong, unique API key and share it securely with the Activepieces team.

---

## Database Models

### template_analytics

Stores analytics data per published template.

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| template_id | String | The public_library_id (unique) |
| total_views | Int | Total view count |
| total_installs | Int | Total install count |
| active_flow_ids | String[] | Array of unique active flow IDs |
| installed_by_user_ids | String[] | Array of unique user IDs who installed |
| created_at | DateTime | Record creation time |
| updated_at | DateTime | Last update time |

### explore_analytics

Stores analytics for the explore/discover page (singleton record).

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| total_views | Int | Total page views |
| viewed_by_user_ids | String[] | Array of unique user IDs who viewed |
| created_at | DateTime | Record creation time |
| updated_at | DateTime | Last update time |

---

## Migration

Run the following command to apply database changes:

```bash
cd backend
npx prisma migrate dev --name add_template_analytics
```

---

## Internal Dashboard Features

The analytics data is displayed in:

1. **Dashboard (IdeaCard)** - Shows views, installs, and active flows for published templates
2. **Template Detail Page (IdeaDetail)** - Shows detailed analytics section for published templates
3. **Analytics Page** - New "Public Template Analytics" section with:
   - Overview cards (total views, installs, active flows, users, conversion rate)
   - Top templates by installs and views
   - Category-level analytics breakdown

---

## Metrics Definitions

### Per Template
- **Total Views**: Number of times the template page was viewed
- **Total Installs**: Number of times the template was installed
- **Unique Users**: Number of distinct users who installed the template
- **Active Flows**: Number of flows currently active from this template
- **Conversion Rate**: (Total Installs / Total Views) × 100

### Per Category
- **Available Templates**: Number of published templates in the category
- **Total Installs**: Sum of installs for all templates in category
- **Installed At Least Once**: Templates with at least one install
- **Avg Installs Per Template**: Total installs / Available templates

### Discover Page
- **Total Clicks**: Total views on the explore/discover page
- **Unique Users**: Distinct users who viewed the explore page
- **Conversion Rate**: (Total Installs / Total Discover Clicks) × 100
