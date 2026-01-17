# Template Analytics API - Integration Guide

## Overview

This API allows the Activepieces product to track template usage metrics including views, installs, and active flows.

---

## API Details

**Base URL:** `https://YOUR_DOMAIN.com/api/public/analytics`

**Authentication:** API Key in header
```
X-API-Key: YOUR_API_KEY
```

---

## Endpoints

### 1. Track Template View

Call this when a user views a template page in the product.

```
POST /templates/{templateId}/view
```

**Headers:**
```
X-API-Key: YOUR_API_KEY
```

**Parameters:**
- `templateId` - The template's `public_library_id` (the ID returned when template was published)

**Example:**
```bash
curl -X POST https://YOUR_DOMAIN.com/api/public/analytics/templates/abc123/view \
  -H "X-API-Key: YOUR_API_KEY"
```

**Response:**
```json
{
  "success": true,
  "message": "View recorded",
  "analytics": {
    "templateId": "abc123",
    "totalViews": 150,
    "totalInstalls": 25
  }
}
```

---

### 2. Track Template Install

Call this when a user installs/uses a template.

```
POST /templates/{templateId}/install
```

**Headers:**
```
X-API-Key: YOUR_API_KEY
Content-Type: application/json
```

**Body:**
```json
{
  "userId": "user_id_here"
}
```

**Example:**
```bash
curl -X POST https://YOUR_DOMAIN.com/api/public/analytics/templates/abc123/install \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user_12345"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Install recorded",
  "analytics": {
    "templateId": "abc123",
    "totalViews": 150,
    "totalInstalls": 26,
    "uniqueUsers": 20
  }
}
```

---

### 3. Track Flow Activation

Call this when a flow is created/enabled from a template.

```
POST /templates/{templateId}/activate
```

**Headers:**
```
X-API-Key: YOUR_API_KEY
Content-Type: application/json
```

**Body:**
```json
{
  "flowId": "flow_id_here"
}
```

**Example:**
```bash
curl -X POST https://YOUR_DOMAIN.com/api/public/analytics/templates/abc123/activate \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"flowId": "flow_98765"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Flow activation recorded",
  "analytics": {
    "templateId": "abc123",
    "activeFlows": 15
  }
}
```

---

### 4. Track Flow Deactivation (Optional)

Call this when a flow created from a template is deleted/disabled.

```
POST /templates/{templateId}/deactivate
```

**Headers:**
```
X-API-Key: YOUR_API_KEY
Content-Type: application/json
```

**Body:**
```json
{
  "flowId": "flow_id_here"
}
```

---

### 5. Track Explore/Discover Page View

Call this when a user views the explore/discover templates page.

```
POST /explore/view
```

**Headers:**
```
X-API-Key: YOUR_API_KEY
Content-Type: application/json
```

**Body (optional):**
```json
{
  "userId": "user_id_here"
}
```

**Example:**
```bash
curl -X POST https://YOUR_DOMAIN.com/api/public/analytics/explore/view \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user_12345"}'
```

---

## Read Endpoints (Optional - for verification)

### Get Template Analytics
```
GET /templates/{templateId}
```

### Get All Templates Analytics
```
GET /templates
```

### Get Summary
```
GET /summary
```

---

## Important Notes

1. **Template ID**: Always use the `public_library_id` that was returned when the template was published to the public library. This is the unique identifier that links the analytics to the correct template.

2. **User ID**: For install tracking, pass the Activepieces user ID. This allows tracking unique users who installed templates.

3. **Flow ID**: For activation tracking, pass the flow ID. This allows tracking active flows created from templates.

4. **Idempotency**: 
   - User IDs in `installedByUserIds` are stored uniquely (duplicates ignored)
   - Flow IDs in `activeFlowIds` are stored uniquely (duplicates ignored)
   - Views and installs are always incremented (not idempotent)

5. **Error Handling**: All endpoints return appropriate HTTP status codes:
   - `200` - Success
   - `400` - Bad request (missing required fields)
   - `401` - Missing API key
   - `403` - Invalid API key
   - `500` - Server error

---

## Metrics Tracked

### Per Template
- Total views (page views)
- Total installs
- Unique users who installed
- Active flows created from template
- Conversion rate (installs / views)

### Per Category
- Number of templates
- Total installs for all templates
- Templates installed at least once
- Active flows linked to category
- Average installs per template

### Explore Page
- Total clicks on "Discover"
- Unique users who clicked
- Conversion rate to installs

---

## Quick Reference

| Action | Method | Endpoint | Body |
|--------|--------|----------|------|
| Template viewed | POST | `/templates/{id}/view` | - |
| Template installed | POST | `/templates/{id}/install` | `{"userId": "..."}` |
| Flow activated | POST | `/templates/{id}/activate` | `{"flowId": "..."}` |
| Flow deactivated | POST | `/templates/{id}/deactivate` | `{"flowId": "..."}` |
| Explore page viewed | POST | `/explore/view` | `{"userId": "..."}` (optional) |
