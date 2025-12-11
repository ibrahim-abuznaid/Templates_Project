# Database Views System

## 🎯 Overview

This system provides **10 powerful database views** and corresponding API endpoints to manage and visualize your templates by departments, status, freelancers, and more.

## 🚀 Quick Start

### 1. Start with Sample Data

```bash
# Seed the database with sample templates
npm run seed

# Test the views
npm run test-views

# Start the server
npm run dev
```

### 2. Access the API

All endpoints are available at `http://localhost:3001/api/views/`

Example:
```bash
# Get all departments
curl http://localhost:3001/api/views/departments \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📊 Available Views

### 1. **Department View** - Your Main Request! ✨

Show all departments with their template counts:

**API:** `GET /api/views/departments`

**Response:**
```json
[
  {
    "department": "Marketing",
    "template_count": 3,
    "published_count": 1,
    "in_progress_count": 1,
    "new_count": 1,
    "total_value": 470.00,
    "avg_price": 156.67
  },
  {
    "department": "Sales",
    "template_count": 3,
    "published_count": 1,
    "in_progress_count": 1,
    "new_count": 0,
    "total_value": 530.00,
    "avg_price": 176.67
  }
]
```

**Click on a department to see its templates:**

**API:** `GET /api/views/departments/Marketing/templates`

**Response:**
```json
[
  {
    "department": "Marketing",
    "template_id": 1,
    "use_case": "Email Marketing Campaign Automation",
    "flow_name": "Marketing Email Flow",
    "status": "published",
    "price": 150,
    "assigned_to": "freelancer",
    "created_at": "2025-12-11 10:00:00",
    "updated_at": "2025-12-11 12:30:00"
  }
]
```

### 2. **Status Pipeline View**

Track templates through your workflow stages:

**API:** `GET /api/views/status`

Perfect for Kanban boards!

### 3. **Freelancer Workload View**

See who's working on what:

**API:** `GET /api/views/freelancers/workload`

### 4. **Unassigned Templates**

Quick queue of templates waiting for assignment:

**API:** `GET /api/views/unassigned`

### 5. **High-Value Templates**

Priority queue sorted by price:

**API:** `GET /api/views/high-value`

### 6. **Recent Activity Feed**

Latest updates across all templates:

**API:** `GET /api/views/recent-activity`

### 7. **Tags Analysis**

Discover patterns in your templates:

**API:** `GET /api/views/tags`

### 8. **Department Performance**

Advanced analytics per department:

**API:** `GET /api/views/departments/performance`

### 9. **Detailed Templates**

Enriched template data with filters:

**API:** `GET /api/views/templates/detailed?department=Sales&status=published`

### 10. **Dashboard Overview**

Everything in one API call:

**API:** `GET /api/views/dashboard`

## 📁 Files Structure

```
backend/
├── src/
│   ├── database/
│   │   ├── db.js                 # Database connection & initialization
│   │   ├── views.sql             # View definitions
│   │   ├── seed-data.js          # Sample data generator
│   │   └── test-views.js         # View testing script
│   └── routes/
│       └── views.js              # API endpoints for views
├── VIEWS_DOCUMENTATION.md        # Complete documentation
├── VIEWS_QUICK_REFERENCE.md      # Quick API reference
└── VIEWS_README.md               # This file
```

## 🔧 How It Works

1. **Views are SQL queries** stored in `views.sql`
2. **Views are created automatically** when the server starts
3. **API endpoints** provide easy access to view data
4. **Real-time data** - views always reflect current database state
5. **No caching issues** - data is always fresh

## 💻 Frontend Integration

See the example React component in `FRONTEND_EXAMPLE.md` for a complete implementation.

Basic example:

```javascript
// Fetch departments
const response = await fetch('/api/views/departments', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const departments = await response.json();

// Display as cards
departments.forEach(dept => {
  console.log(`${dept.department}: ${dept.template_count} templates`);
});
```

## 🎨 UI Suggestions

### Department Dashboard
- **Card Grid**: Show each department as a card
- **Template Count**: Display prominently
- **Progress Indicators**: Show published vs in-progress
- **Click to Drill Down**: Navigate to department detail view

### Department Detail View
- **Header**: Department name, total count, total value
- **Table/List**: All templates in that department
- **Filters**: By status, assigned freelancer
- **Actions**: Assign, edit, view details

### Status Pipeline (Kanban)
- **Columns**: One for each status
- **Cards**: Templates in each status
- **Drag & Drop**: Move between statuses
- **Counts**: Show template count per column

### Freelancer Dashboard
- **Workload Bars**: Visual representation of work
- **Earnings**: Total and per-freelancer
- **Status Breakdown**: In progress, submitted, published
- **Recent Activity**: What they're working on

## 🧪 Testing

### Test All Views
```bash
npm run test-views
```

This will:
- ✅ Test all 10 views
- ✅ Show sample data from each
- ✅ Display summary statistics
- ✅ Verify everything is working

### Add Sample Data
```bash
npm run seed
```

This adds:
- 17 sample templates
- 6 departments
- Various statuses
- Sample comments and activity logs

## 📝 Adding Custom Views

1. **Add SQL to `views.sql`:**
```sql
DROP VIEW IF EXISTS my_custom_view;
CREATE VIEW my_custom_view AS
SELECT * FROM ideas WHERE department = 'Custom';
```

2. **Add API endpoint to `routes/views.js`:**
```javascript
router.get('/my-custom', authenticateToken, (req, res) => {
  const data = db.prepare('SELECT * FROM my_custom_view').all();
  res.json(data);
});
```

3. **Restart server** - views are recreated automatically!

## 🔒 Security

- ✅ All endpoints require authentication
- ✅ JWT token validation
- ✅ Role-based access (can be added per endpoint)
- ✅ SQL injection protection (prepared statements)
- ✅ Error handling on all endpoints

## ⚡ Performance

- **Fast**: Views are pre-computed queries
- **Efficient**: Indexed columns for quick lookups
- **Scalable**: Works with thousands of templates
- **No N+1 Queries**: All joins handled in views

## 🐛 Troubleshooting

### Views not created?
- Check console logs on server startup
- Verify `views.sql` syntax
- Restart the server

### Empty results?
- Run `npm run seed` to add sample data
- Check if templates exist: query the `ideas` table directly

### Authentication errors?
- Ensure valid JWT token in headers
- Check token expiration
- Verify user is logged in

## 📚 Documentation

- **VIEWS_DOCUMENTATION.md** - Complete detailed docs
- **VIEWS_QUICK_REFERENCE.md** - Quick API reference
- **FRONTEND_EXAMPLE.md** - React component examples

## 🎉 Features Summary

✅ **10 powerful views** for different perspectives  
✅ **Complete API endpoints** with authentication  
✅ **Sample data generator** for testing  
✅ **Test script** to verify everything works  
✅ **Comprehensive documentation**  
✅ **Frontend examples** (React components)  
✅ **Department view** - your main request!  
✅ **Drill-down capability** - click departments to see templates  
✅ **Real-time data** - always up to date  
✅ **Production-ready** - proper error handling and security  

## 🚀 Next Steps

1. ✅ Run `npm run seed` to add sample data
2. ✅ Run `npm run test-views` to verify views
3. ✅ Start server with `npm run dev`
4. ✅ Test API endpoints with Postman/curl
5. ✅ Integrate into your frontend
6. ✅ Customize views as needed

## 💡 Pro Tips

- **Use the dashboard endpoint** for initial page load (one API call)
- **Cache department list** on frontend (changes infrequently)
- **Add pagination** for large template lists
- **Use query parameters** to filter detailed templates view
- **Show recent activity** for engagement
- **Highlight unassigned templates** as action items

---

**Questions?** Check the documentation files or examine the code - it's well-commented!

**Want more views?** Just add them to `views.sql` and create the endpoint!

**Happy coding! 🎉**

