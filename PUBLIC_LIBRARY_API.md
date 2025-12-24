# Public Library API Documentation

## Overview

This application integrates with the Activepieces Public Library API to publish, update, and manage templates.

**Base URL:** `https://cloud.activepieces.com/api/v1/admin/templates`  
**Auth Header:** `templates-api-key: <API_KEY>`

---

## API Requests

### 1. Create Template (Publish)

**When:** Template status changes to `published` (first time)

```
POST /templates
Headers:
  Content-Type: application/json
  templates-api-key: <API_KEY>

Body:
{
  "name": "Flow Name",
  "summary": "Short description",
  "description": "Full description",
  "tags": [
    { "title": "Value Tag", "color": "#e4fded" },
    { "title": "Time Tag", "color": "#dbeaff" }
  ],
  "blogUrl": "https://...",
  "author": "Author Name",
  "categories": ["HR", "Sales", ...],
  "type": "OFFICIAL",
  "flows": [{ ...flow JSON object... }]
}

Response: { "id": "template_id_xxx" }
```

---

### 2. Update Template

**When:** Manual sync via `POST /ideas/:id/sync-public-library`

```
POST /templates/{public_library_id}
Headers:
  Content-Type: application/json
  templates-api-key: <API_KEY>

Body:
{
  "name": "Updated Name",
  "summary": "Updated summary",
  "description": "Updated description",
  "tags": [...],
  "blogUrl": "...",
  "author": "...",
  "categories": [...],
  "type": "OFFICIAL",
  "flows": [...]
}
```

---

### 3. Change Status (Archive/Republish)

**When:** 
- Archive: Template status changes to `archived`
- Republish: Template with existing `public_library_id` changes to `published`

```
POST /templates/{public_library_id}
Headers:
  Content-Type: application/json
  templates-api-key: <API_KEY>

Body:
{ "status": "ARCHIVED" }   // or "PUBLISHED" to republish
```

---

### 4. Delete Template

**When:** 
- Template deleted from system
- Admin removes from Public Library via `DELETE /ideas/:id/public-library`

```
DELETE /templates/{public_library_id}
Headers:
  templates-api-key: <API_KEY>
```

---

## Local Endpoints (Backend API)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ideas/:id/publish-preview` | GET | Preview what will be sent to Public Library |
| `/ideas/:id/sync-public-library` | POST | Force sync/update published template |
| `/ideas/:id/public-library` | DELETE | Remove from Public Library (keeps local) |
| `/ideas/quick-publish` | POST | Create + publish template in one step |

---

## Status Mapping

| Local Status | Public Library Action |
|--------------|----------------------|
| `published` (new) | Create template |
| `published` (existing) | Republish (status: PUBLISHED) |
| `archived` | Archive (status: ARCHIVED) |
| Delete template | Delete from Public Library |

---

## Environment Variables

```
PUBLIC_LIBRARY_API_URL=https://cloud.activepieces.com/api/v1/admin/templates
PUBLIC_LIBRARY_API_KEY=<your-api-key>
```

> **Note:** Without `PUBLIC_LIBRARY_API_KEY`, the system runs in mock mode (no actual API calls).

