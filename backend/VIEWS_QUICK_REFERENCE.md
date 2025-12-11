# Quick Reference: Database Views API

## All Available Endpoints

### Department Views
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/views/departments` | GET | List all departments with counts |
| `/api/views/departments/:department/templates` | GET | Get templates in a department |
| `/api/views/departments/performance` | GET | Department analytics |

### Status & Pipeline
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/views/status` | GET | Templates grouped by status |

### Freelancer Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/views/freelancers/workload` | GET | All freelancers workload |
| `/api/views/freelancers/:id/workload` | GET | Specific freelancer workload |

### Templates
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/views/templates/detailed` | GET | Detailed template list with filters |
| `/api/views/unassigned` | GET | Unassigned templates |
| `/api/views/high-value` | GET | High-value templates |

### Analytics & Activity
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/views/tags` | GET | Tag analysis |
| `/api/views/recent-activity` | GET | Recent activity feed |
| `/api/views/dashboard` | GET | Complete dashboard data |

---

## Common Use Cases

### 1. Build a Department Dashboard
```
GET /api/views/departments
→ Show cards for each department with template counts
→ Click a card to get templates: GET /api/views/departments/Marketing/templates
```

### 2. Show Freelancer Workload
```
GET /api/views/freelancers/workload
→ Display table/cards showing each freelancer's workload
→ Show in_progress, submitted, published counts
→ Show total earnings
```

### 3. Display Pipeline/Kanban Board
```
GET /api/views/status
→ Create columns for each status
→ Show template counts in each column
→ Show total value per status
```

### 4. Admin Dashboard
```
GET /api/views/dashboard
→ Get everything in one call
→ Show department summary
→ Show status summary
→ Show recent activity
→ Show unassigned count
→ Show freelancer workload
```

### 5. Assignment Queue
```
GET /api/views/unassigned
→ Show templates waiting for assignment
→ Sort by days_waiting
→ Alert on old unassigned items
```

### 6. Priority Management
```
GET /api/views/high-value?limit=10
→ Show top 10 highest-value templates
→ Prioritize these for completion
```

---

## Query Parameters

### `/api/views/templates/detailed`
- `?department=Marketing` - Filter by department
- `?status=published` - Filter by status
- `?assigned_to=freelancer` - Filter by freelancer name

### `/api/views/recent-activity`
- `?limit=20` - Limit number of results (default: 50)

### `/api/views/high-value`
- `?limit=10` - Limit number of results (default: 20)

---

## Response Examples

### Department Summary
```json
{
  "department": "Marketing",
  "template_count": 15,
  "published_count": 10,
  "in_progress_count": 3,
  "new_count": 2,
  "total_value": 1500.00,
  "avg_price": 100.00
}
```

### Freelancer Workload
```json
{
  "freelancer_id": 2,
  "freelancer_name": "john_doe",
  "freelancer_email": "john@example.com",
  "total_assigned": 8,
  "in_progress": 3,
  "submitted": 2,
  "needs_fixes": 1,
  "published": 2,
  "total_earnings": 800.00,
  "last_activity": "2025-12-11 10:30:00"
}
```

### Status Summary
```json
{
  "status": "in_progress",
  "template_count": 12,
  "departments_count": 5,
  "total_value": 1200.00,
  "assigned_count": 12,
  "unassigned_count": 0
}
```

---

## Authentication

All endpoints require authentication. Include JWT token in headers:

```javascript
headers: {
  'Authorization': 'Bearer YOUR_JWT_TOKEN'
}
```

---

## Testing

Use the provided test script:
```bash
node backend/src/database/test-views.js
```

This will show sample data from each view.

