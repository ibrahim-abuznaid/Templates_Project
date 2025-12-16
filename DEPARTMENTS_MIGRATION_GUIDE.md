# Department Migration Guide

This guide explains how to migrate from single department per template to multiple departments per template.

---

## 📋 Overview

The new department structure allows templates to belong to multiple departments, providing better organization and discoverability.

### Changes Made:

1. **Database Schema**:
   - Added `departments` table with predefined departments
   - Added `idea_departments` junction table for many-to-many relationships
   - Kept old `department` column in `ideas` table for backward compatibility

2. **Predefined Departments**:
   1. Everyone - Everyday
   2. Customer Support/Success
   3. Finance/Accounting
   4. HR
   5. IT
   6. Legal
   7. Marketing
   8. Operations
   9. Personal Productivity
   10. Product Management
   11. Sales

3. **API Updates**:
   - `/api/departments` - Get all departments
   - `/api/ideas` - Now returns `departments` array for each idea
   - `/api/ideas/:id` - Includes `departments` array
   - POST/PUT `/api/ideas` - Accepts `department_ids` array

4. **Frontend Updates**:
   - Multiple department badges displayed on idea cards
   - Checkbox selection for departments when creating/editing ideas
   - Department view page updated to work with new structure

---

## 🚀 Migration Steps

### Step 1: Stop the Application

```bash
# Stop the backend server
# Press Ctrl+C in the terminal running the backend
```

### Step 2: Backup Your Database (Recommended)

```bash
# If using SQLite (development)
cp backend/data/database.db backend/data/database.db.backup

# If using PostgreSQL (production)
# Use your PostgreSQL backup tools
pg_dump your_database > backup.sql
```

### Step 3: Run the Migration Script

```bash
cd backend
node scripts/migrate-departments.js
```

**What this script does**:
- Creates `departments` table with 10 predefined departments
- Creates `idea_departments` junction table
- Migrates existing department data from the old single field to the new structure
- Maps old department names to new department names:
  - Sales → Sales
  - Finance → Finance/Accounting
  - Marketing → Marketing
  - HR → HR
  - Support/Customer Support → Customer Support/Success
  - Operations → Operations
  - Legal → Legal
  - IT → IT
  - QA/Security/Engineering → IT

**Expected Output**:
```
🔄 Starting department migration...

📋 Step 1: Creating departments table...
📋 Step 2: Inserting predefined departments...
   ✅ Inserted 10 departments
📋 Step 3: Creating idea_departments junction table...
📋 Step 4: Migrating existing department data...
   Found X ideas with departments
   ✅ Migrated X idea-department relationships
📋 Step 5: Verifying migration...
   ✅ Total idea-department relationships: X

📊 Department Statistics:
   Everyone - Everyday: X templates
   Customer Support/Success: X templates
   Finance/Accounting: X templates
   HR: X templates
   IT: X templates
   Legal: X templates
   Marketing: X templates
   Operations: X templates
   Personal Productivity: X templates
   Product Management: X templates
   Sales: X templates

✅ Migration completed successfully!
```

### Step 4: (Optional) Seed Additional Sample Data

If you want to add sample templates that use the new multi-department structure:

```bash
node scripts/seed-with-departments.js
```

### Step 5: Update Prisma Schema (If using Prisma)

```bash
# Generate Prisma client with new schema
npx prisma generate

# If you want to create a Prisma migration
npx prisma migrate dev --name add_departments
```

### Step 6: Restart the Application

```bash
# Backend
npm start

# Frontend (in a new terminal)
cd frontend
npm run dev
```

---

## 🧪 Testing the Migration

### 1. Verify Departments API

```bash
curl http://localhost:3001/api/departments \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected response:
```json
[
  {
    "id": 1,
    "name": "Everyone - Everyday",
    "description": "Templates useful for everyone in daily tasks",
    "display_order": 1
  },
  ...
]
```

### 2. Check Ideas with Departments

```bash
curl http://localhost:3001/api/ideas \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Each idea should now have a `departments` array:
```json
{
  "id": 1,
  "use_case": "Employee Onboarding",
  "departments": [
    {
      "id": 4,
      "name": "HR",
      "description": "Human resources templates",
      "display_order": 4
    }
  ],
  ...
}
```

### 3. Test Creating Ideas with Multiple Departments

In the frontend:
1. Click "Create New Use Case"
2. Fill in the form
3. Select multiple departments using checkboxes
4. Submit
5. Verify the idea shows all selected departments

### 4. Test Department View

1. Navigate to the "Departments" page in the UI
2. Verify all 10 departments are listed
3. Click on a department
4. Verify templates are shown correctly
5. Verify templates with multiple departments appear in all relevant departments

---

## 🔧 Troubleshooting

### Migration Failed

If the migration script fails:

1. **Check Error Message**: The script will display specific errors
2. **Restore Backup**: 
   ```bash
   cp backend/data/database.db.backup backend/data/database.db
   ```
3. **Check Database Connection**: Ensure database is accessible
4. **Manual Rollback**: The script uses transactions, so partial changes are rolled back automatically

### Departments Not Showing in UI

1. **Clear Browser Cache**: Hard refresh (Ctrl+Shift+R)
2. **Check API Response**: Use browser DevTools Network tab
3. **Verify Migration**: Run a database query:
   ```sql
   SELECT * FROM departments;
   SELECT * FROM idea_departments;
   ```

### Old Department Field Still Showing

- The old `department` field is kept for backward compatibility
- Frontend components check for `departments` array first, then fall back to old `department` field
- You can safely remove the old field once you verify everything works

---

## 📝 Code Changes Summary

### Backend Changes

**New Files**:
- `backend/scripts/migrate-departments.js` - Migration script
- `backend/scripts/seed-with-departments.js` - Enhanced seed data
- `backend/src/routes/departments.js` - Departments API endpoints

**Modified Files**:
- `backend/prisma/schema.prisma` - Added Department and IdeaDepartment models
- `backend/src/routes/ideas.js` - Added department handling in CRUD operations
- `backend/src/routes/views.js` - Updated department views to use new structure
- `backend/src/server.js` - Added departments route

### Frontend Changes

**Modified Files**:
- `frontend/src/types/index.ts` - Added Department interface, updated Idea interface
- `frontend/src/services/api.ts` - Added departmentsApi, updated ideasApi
- `frontend/src/components/IdeaCard.tsx` - Display multiple department badges
- `frontend/src/pages/IdeaDetail.tsx` - Show and edit multiple departments
- `frontend/src/pages/Dashboard.tsx` - Multi-select departments when creating ideas

---

## 🎯 Best Practices

### When Creating Templates

1. **Select Relevant Departments**: Choose all departments that would find this template useful
2. **Include "Everyone - Everyday"**: For templates useful across the organization
3. **Be Specific**: Don't select all departments unless truly universal

### Department Selection Guidelines

- **Everyone - Everyday**: Daily tasks, common processes (expense reports, time off, etc.)
- **Customer Support/Success**: Customer-facing processes, ticket handling
- **Finance/Accounting**: Financial processes, budgeting, invoicing
- **HR**: Employee-related processes, onboarding, reviews
- **IT**: Technical processes, asset management, access requests
- **Legal**: Contracts, compliance, legal reviews
- **Marketing**: Campaigns, content, lead generation
- **Operations**: Logistics, procurement, facilities
- **Personal Productivity**: Individual task management, note-taking
- **Product Management**: Product launches, feature planning, roadmaps
- **Sales**: Sales processes, pipelines, proposals, and customer acquisition

---

## 🆘 Need Help?

If you encounter issues:

1. Check the error messages carefully
2. Review this guide
3. Check the application logs
4. Restore from backup if needed
5. Create an issue in the repository with:
   - Error message
   - Steps to reproduce
   - Database type (SQLite/PostgreSQL)
   - Environment (development/production)

---

## ✅ Migration Checklist

- [ ] Stop the application
- [ ] Backup the database
- [ ] Run migration script
- [ ] Verify migration output
- [ ] (Optional) Run enhanced seed script
- [ ] Restart application
- [ ] Test departments API
- [ ] Test creating ideas with multiple departments
- [ ] Test department view page
- [ ] Test editing existing ideas
- [ ] Verify all templates show correct departments
- [ ] Test on production (if applicable)

---

**Migration Date**: December 2024  
**Version**: 2.0 - Multi-Department Support
