# GitHub & DigitalOcean Deployment Checklist

Use this checklist to ensure you've completed all necessary steps before and during deployment.

## ✅ Pre-Deployment Checklist

### 1. Code Review & Cleanup
- [ ] Remove all console.log() statements (or ensure they're appropriate for production)
- [ ] Remove all commented-out code
- [ ] Ensure no hardcoded credentials or API keys in code
- [ ] Remove debug/development-only code
- [ ] Test all features locally
- [ ] Fix all linter errors and warnings

### 2. Environment Configuration
- [ ] Create `backend/.env.example` with all required variables (no actual values)
- [ ] Create `frontend/.env.example` with all required variables
- [ ] Verify `.env` files are listed in `.gitignore`
- [ ] Document all environment variables in deployment guide

### 3. Database
- [ ] Decide: SQLite (dev only) vs PostgreSQL (production)
- [ ] If using PostgreSQL: Install `pg` package in backend
- [ ] If using PostgreSQL: Create database adapter/migration scripts
- [ ] Plan for initial data seeding in production
- [ ] Backup any existing local database data if needed

### 4. Dependencies
- [ ] Run `npm audit` in all projects and fix critical vulnerabilities
- [ ] Remove unused dependencies
- [ ] Ensure all dependencies are in `dependencies` (not `devDependencies`) if needed at runtime
- [ ] Add `engines` field to `package.json` specifying Node.js version

### 5. Build Process
- [ ] Test frontend build: `cd frontend && npm run build`
- [ ] Test backend starts: `cd backend && npm start`
- [ ] Verify build outputs are in `.gitignore`

### 6. Git Repository
- [ ] Verify `.gitignore` is working correctly
- [ ] Run `git status` and ensure no sensitive files are tracked
- [ ] All changes are committed
- [ ] Repository has descriptive README.md

---

## 📤 GitHub Upload Steps

### 1. Initialize Git (if not already done)
```bash
cd C:\AP_work\Templates_Project
git init
git branch -M main
```

### 2. Configure Git User
```bash
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

### 3. Stage and Commit Files
```bash
git add .
git commit -m "Initial commit: Template Management Dashboard"
```

### 4. Create GitHub Repository
- [ ] Go to https://github.com/new
- [ ] Repository name: `template-management-dashboard` (or your choice)
- [ ] Description: "Full-stack template management system with role-based access control"
- [ ] Choose visibility: Public or Private
- [ ] **DO NOT** check "Initialize with README"
- [ ] Click "Create repository"

### 5. Push to GitHub
```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

### 6. Verify Upload
- [ ] Refresh GitHub repository page
- [ ] Verify all expected files are present
- [ ] Verify `.env` files are NOT present
- [ ] Verify `node_modules/` is NOT present
- [ ] Verify database files are NOT present

---

## 🚀 DigitalOcean Deployment Steps

### 1. Update Configuration Files

**Update `.digitalocean/app.yaml`:**
- [ ] Replace `YOUR_GITHUB_USERNAME/YOUR_REPO_NAME` with actual repository
- [ ] Verify all service names are correct
- [ ] Verify build and run commands are correct
- [ ] Review resource sizing (instance_size_slug)

### 2. Prepare Backend for Production

**If using PostgreSQL:**
- [ ] Install `pg` package: `npm install pg`
- [ ] Create PostgreSQL database adapter
- [ ] Update server.js to detect and use DATABASE_URL
- [ ] Test database connection logic locally (if possible)

**Update API URL handling:**
- [ ] Ensure backend uses `PORT` environment variable
- [ ] Ensure backend CORS allows frontend URL from environment variable

### 3. Prepare Frontend for Production

**Update API configuration:**
- [ ] Frontend uses `VITE_API_URL` environment variable
- [ ] Default fallback URL is appropriate
- [ ] Test build: `npm run build`

### 4. Commit and Push Updates
```bash
git add .
git commit -m "Prepare for DigitalOcean deployment"
git push origin main
```

### 5. Create DigitalOcean App

- [ ] Log in to DigitalOcean
- [ ] Navigate to Apps → Create App
- [ ] Connect GitHub account
- [ ] Authorize DigitalOcean to access repositories
- [ ] Select your repository
- [ ] Select branch: `main`
- [ ] Choose autodeploy on push: Yes

### 6. Configure App Resources

**Option A: Upload App Spec**
- [ ] Click "Edit App Spec"
- [ ] Paste contents of `.digitalocean/app.yaml`
- [ ] Update repository references
- [ ] Save spec

**Option B: Manual Configuration**

**Add Database:**
- [ ] Click "Add Resource" → "Database"
- [ ] Choose "PostgreSQL" version 15
- [ ] Select plan: Dev ($7/mo) or Production ($15+/mo)
- [ ] Name: `main-db`

**Configure Backend:**
- [ ] Resource type: Web Service
- [ ] Name: `backend`
- [ ] Source directory: `/backend`
- [ ] Build command: `npm ci`
- [ ] Run command: `npm start`
- [ ] HTTP port: `8080`
- [ ] Instance size: Basic - 512 MB RAM ($5/mo)
- [ ] Route: `/api`

**Configure Frontend:**
- [ ] Resource type: Static Site
- [ ] Name: `frontend`
- [ ] Source directory: `/frontend`
- [ ] Build command: `npm ci && npm run build`
- [ ] Output directory: `dist`
- [ ] Route: `/`

### 7. Set Environment Variables

**Backend Environment Variables:**
- [ ] `NODE_ENV` = `production`
- [ ] `PORT` = `8080`
- [ ] `JWT_SECRET` = [Generate secure random string] - Mark as "Encrypted"
- [ ] `FRONTEND_URL` = `${frontend.PUBLIC_URL}`
- [ ] `DATABASE_URL` = `${main-db.DATABASE_URL}` (if using database)

**Frontend Environment Variables:**
- [ ] `VITE_API_URL` = `${backend.PUBLIC_URL}/api`

### 8. Review and Launch
- [ ] Review all settings
- [ ] Check pricing estimate
- [ ] Choose app name
- [ ] Select region (e.g., New York)
- [ ] Click "Create Resources"

### 9. Monitor Deployment
- [ ] Watch build logs for errors
- [ ] Wait for deployment to complete (5-10 minutes)
- [ ] Note down the generated URLs

---

## 🧪 Post-Deployment Testing

### 1. Initial Access
- [ ] Visit frontend URL
- [ ] Check that site loads without errors
- [ ] Open browser console - check for any errors

### 2. Backend Health Check
- [ ] Visit `https://your-backend-url.ondigitalocean.app/api/health`
- [ ] Should return: `{"status":"OK","message":"Server is running"}`

### 3. Database Seeding
- [ ] Create initial admin user (via seed script or manual SQL)
- [ ] Verify user can be created successfully

### 4. Authentication Testing
- [ ] Try logging in with admin credentials
- [ ] Verify JWT token is generated and stored
- [ ] Check that authentication persists on page reload

### 5. Core Features Testing
- [ ] Admin can create ideas
- [ ] Ideas are saved to database
- [ ] Ideas can be viewed and edited
- [ ] Status changes work correctly
- [ ] Comments can be added
- [ ] All pages load correctly

### 6. API Testing
- [ ] Test all major API endpoints
- [ ] Verify error handling works
- [ ] Check that unauthorized access is blocked

### 7. Performance Testing
- [ ] Check page load times
- [ ] Verify images/assets load correctly
- [ ] Test on different devices/browsers

---

## 🔧 Troubleshooting

### Build Failures
- [ ] Check DigitalOcean build logs
- [ ] Verify `package.json` scripts are correct
- [ ] Ensure all dependencies are listed
- [ ] Check Node.js version compatibility

### Database Connection Issues
- [ ] Verify DATABASE_URL is set correctly
- [ ] Check database is running in DigitalOcean
- [ ] Review connection string format
- [ ] Check database user permissions

### Frontend Not Loading
- [ ] Check static site build succeeded
- [ ] Verify `dist` folder was created during build
- [ ] Check for JavaScript errors in browser console
- [ ] Verify VITE_API_URL is set correctly

### CORS Errors
- [ ] Verify FRONTEND_URL in backend matches actual frontend URL
- [ ] Check CORS configuration in server.js
- [ ] Ensure credentials: true is set if using cookies

### 404 Errors on Frontend Routes
- [ ] Verify `catchall_document: index.html` is set for static site
- [ ] This allows React Router to handle routing

---

## 📝 Post-Deployment Tasks

### Immediate
- [ ] Save all URLs (frontend, backend, database)
- [ ] Document admin credentials securely
- [ ] Remove any temporary seed endpoints
- [ ] Set up monitoring/alerts (optional)

### Within First Week
- [ ] Monitor error logs
- [ ] Check database size and performance
- [ ] Review and optimize resource usage
- [ ] Set up backups (DigitalOcean has automatic backups)

### Ongoing
- [ ] Set up CI/CD (already automatic with GitHub push)
- [ ] Configure custom domain (optional)
- [ ] Set up SSL certificate (automatic with DigitalOcean)
- [ ] Monitor costs and adjust resources as needed

---

## 📊 Cost Summary

| Resource | Configuration | Monthly Cost |
|----------|--------------|--------------|
| Backend Service | Basic - 512 MB RAM | $5 |
| Frontend Static Site | Starter | $0-5 |
| PostgreSQL Database | Dev Database | $7 |
| **Estimated Total** | | **$12-17/month** |

*Prices as of December 2025. Check DigitalOcean for current pricing.*

---

## 🆘 Emergency Procedures

### Rollback to Previous Version
1. Go to DigitalOcean App → Deployments
2. Find last working deployment
3. Click "Rollback"

### Database Backup
1. Go to DigitalOcean → Databases → Your Database
2. Click "Backups"
3. Create manual backup or restore from automatic backup

### Emergency Shutdown
1. Go to DigitalOcean App → Settings
2. Click "Destroy App" (careful!)
3. Or: Scale to 0 instances to stop without destroying

---

## 📚 Important URLs

Once deployed, save these:

- **Frontend URL**: `https://_____.ondigitalocean.app`
- **Backend URL**: `https://_____.ondigitalocean.app`
- **Database Connection**: Available in DigitalOcean dashboard
- **GitHub Repository**: `https://github.com/YOUR_USERNAME/YOUR_REPO_NAME`
- **DigitalOcean App Dashboard**: `https://cloud.digitalocean.com/apps/YOUR_APP_ID`

---

## ✅ Final Verification

Before considering deployment complete:

- [ ] All features tested and working
- [ ] No console errors in browser
- [ ] API endpoints responding correctly
- [ ] Database connected and saving data
- [ ] Authentication working properly
- [ ] Admin and freelancer roles working correctly
- [ ] Mobile responsive (test on phone)
- [ ] URLs saved in secure location
- [ ] Team members can access the app
- [ ] Documentation is up to date

---

**Congratulations! Your app is deployed! 🎉**

For updates, simply push to GitHub:
```bash
git add .
git commit -m "Your update"
git push origin main
```

DigitalOcean will automatically deploy the changes!

