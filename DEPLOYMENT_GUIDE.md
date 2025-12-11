# Deployment Guide - GitHub & DigitalOcean App Platform

This guide will walk you through deploying your Template Management Dashboard to GitHub and DigitalOcean App Platform.

## 📋 Prerequisites

Before you begin, make sure you have:

- [ ] A GitHub account ([Sign up here](https://github.com/signup))
- [ ] A DigitalOcean account ([Sign up here](https://www.digitalocean.com/))
- [ ] Git installed on your computer
- [ ] Your project tested and working locally
- [ ] All sensitive data removed from code (no hardcoded passwords, API keys, etc.)

## Part 1: Prepare Your Project for GitHub

### Step 1: Review and Update Configuration Files

Your project already has `.gitignore` files configured. Verify they're working:

```bash
git status
```

Ensure the following are NOT listed (they should be ignored):
- `node_modules/` folders
- `.env` files
- `backend/data/` folder
- Build directories (`dist/`, `build/`)

### Step 2: Create Environment Variable Templates

Since `.env` files are ignored, create example files for documentation:

**Create `backend/.env.example`:**
```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# CORS Configuration
FRONTEND_URL=http://localhost:5173

# Database Configuration (for production with PostgreSQL)
# DATABASE_URL=postgresql://user:password@host:port/database
```

**Create `frontend/.env.example`:**
```env
# API Configuration
# For local development
VITE_API_URL=http://localhost:3001/api

# For production, this will be set automatically by DigitalOcean
# VITE_API_URL=https://your-backend-url/api
```

### Step 3: Initialize Git Repository (if not already done)

```bash
# Navigate to your project root
cd C:\AP_work\Templates_Project

# Check if git is already initialized
git status

# If not initialized, run:
git init

# Set your name and email (if not already set globally)
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

### Step 4: Stage and Commit Your Files

```bash
# Add all files (respecting .gitignore)
git add .

# Create your initial commit
git commit -m "Initial commit: Template Management Dashboard"
```

## Part 2: Push to GitHub

### Step 1: Create a New GitHub Repository

1. Go to [GitHub](https://github.com)
2. Click the **"+"** icon in the top-right corner
3. Select **"New repository"**
4. Fill in the details:
   - **Repository name**: `template-management-dashboard` (or your preferred name)
   - **Description**: "Full-stack template management system with role-based access control"
   - **Visibility**: Choose Public or Private
   - ⚠️ **DO NOT** initialize with README, .gitignore, or license (you already have these)
5. Click **"Create repository"**

### Step 2: Connect Local Repository to GitHub

GitHub will show you commands. Use these (replace with your actual URL):

```bash
# Add GitHub as remote origin
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Verify remote was added
git remote -v

# Push your code to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Verify Upload

1. Refresh your GitHub repository page
2. You should see all your files except ignored ones
3. Verify that `.env` files and `node_modules/` are NOT present

## Part 3: Prepare for DigitalOcean Deployment

### Important: Database Considerations

**Your app currently uses SQLite**, which is NOT recommended for production on DigitalOcean App Platform because:
- SQLite stores data in a file
- App Platform containers are ephemeral (data would be lost on redeploy)
- No persistent storage for SQLite

**Solution: You have two options:**

#### Option A: Use PostgreSQL (Recommended for Production)
You'll need to modify your backend to support PostgreSQL alongside SQLite.

#### Option B: Use SQLite with Development Database (Testing Only)
Keep SQLite but understand data will reset on each deployment.

### Step 1: Update Backend for PostgreSQL Support

**Install PostgreSQL driver:**
```bash
cd backend
npm install pg
```

**Create `backend/src/database/db-postgres.js`:**
```javascript
import pg from 'pg';
const { Pool } = pg;

let pool;

export function initPostgresDatabase() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    return;
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  // Create tables
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      email VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ideas (
      id SERIAL PRIMARY KEY,
      use_case TEXT,
      department VARCHAR(100),
      flow_name TEXT,
      short_description TEXT,
      description TEXT,
      setup_guide TEXT,
      tags TEXT,
      template_url TEXT,
      scribe_url TEXT,
      reviewer_name VARCHAR(255),
      price DECIMAL(10, 2),
      status VARCHAR(50) DEFAULT 'new',
      assigned_to INTEGER REFERENCES users(id),
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      idea_id INTEGER REFERENCES ideas(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      comment TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      idea_id INTEGER REFERENCES ideas(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      action VARCHAR(255) NOT NULL,
      details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      idea_id INTEGER REFERENCES ideas(id),
      freelancer_id INTEGER REFERENCES users(id),
      amount DECIMAL(10, 2) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      paid_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50),
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS blockers (
      id SERIAL PRIMARY KEY,
      idea_id INTEGER REFERENCES ideas(id) ON DELETE CASCADE,
      reported_by INTEGER REFERENCES users(id),
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      severity VARCHAR(50) DEFAULT 'medium',
      status VARCHAR(50) DEFAULT 'open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP
    );
  `;

  pool.query(schema, (err) => {
    if (err) {
      console.error('Error creating PostgreSQL schema:', err);
    } else {
      console.log('✅ PostgreSQL database initialized');
    }
  });

  return pool;
}

export function getPostgresPool() {
  return pool;
}
```

**Update `backend/src/server.js`** to use the appropriate database:
```javascript
// Add at the top with other imports
import { initPostgresDatabase, getPostgresPool } from './database/db-postgres.js';

// Replace the initDatabase() call with:
if (process.env.DATABASE_URL) {
  console.log('Using PostgreSQL database');
  initPostgresDatabase();
} else {
  console.log('Using SQLite database');
  initDatabase();
}
```

### Step 2: Update DigitalOcean Configuration

The `.digitalocean/app.yaml` file has been created for you. You need to update it:

1. Open `.digitalocean/app.yaml`
2. Replace `YOUR_GITHUB_USERNAME/YOUR_REPO_NAME` with your actual GitHub repository
   - Example: `john-doe/template-management-dashboard`

### Step 3: Configure API URL in Frontend

Update `frontend/src/services/api.ts` to use environment variable:

```typescript
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ... rest of the file
```

## Part 4: Deploy to DigitalOcean App Platform

### Step 1: Create New App

1. Log in to your [DigitalOcean account](https://cloud.digitalocean.com/)
2. Click **"Create"** → **"Apps"**
3. Choose **"GitHub"** as your source
4. Click **"Manage Access"** and authorize DigitalOcean to access your GitHub repositories
5. Select your repository: `YOUR_USERNAME/template-management-dashboard`
6. Choose branch: `main`
7. Click **"Next"**

### Step 2: Configure Resources

DigitalOcean will auto-detect your app structure. You have two deployment options:

#### Option A: Use App Spec (Recommended)

1. On the "Configure your app" screen, click **"Edit App Spec"**
2. Upload or paste the contents of `.digitalocean/app.yaml`
3. Update the GitHub repository references in the spec
4. Click **"Save"**

#### Option B: Manual Configuration

If not using app.yaml, configure manually:

**Add Database:**
1. Click **"Add Resource"** → **"Database"**
2. Choose **"PostgreSQL"**
3. Select version **15**
4. Choose a plan (Dev Database for testing: $7/month, or Production: $15/month+)
5. Click **"Add Database"**

**Configure Backend Service:**
1. Resource Type: **Web Service**
2. Source Directory: `/backend`
3. Build Command: `npm ci`
4. Run Command: `npm start`
5. HTTP Port: `8080`
6. Instance Size: **Basic (512 MB RAM / 1 vCPU)** - $5/month
7. Add Environment Variables:
   - `NODE_ENV` = `production`
   - `PORT` = `8080`
   - `JWT_SECRET` = `[Generate a strong secret - click "Encrypt"]`
   - `FRONTEND_URL` = `${frontend.PUBLIC_URL}`
   - `DATABASE_URL` = `${db.DATABASE_URL}` (auto-filled from database)

**Configure Frontend Service:**
1. Resource Type: **Static Site**
2. Source Directory: `/frontend`
3. Build Command: `npm ci && npm run build`
4. Output Directory: `dist`
5. Add Environment Variable:
   - `VITE_API_URL` = `${backend.PUBLIC_URL}/api`

### Step 3: Configure Environment Variables

Critical variables to set:

1. **JWT_SECRET**: 
   - Generate a secure random string: `openssl rand -base64 32`
   - Or use: [Random.org](https://www.random.org/strings/)
   - Mark as **"Encrypted"** in DigitalOcean

2. **Frontend/Backend URLs**: 
   - DigitalOcean will auto-generate these
   - Use the variable references: `${backend.PUBLIC_URL}`, `${frontend.PUBLIC_URL}`

### Step 4: Review and Launch

1. Review your app configuration
2. Choose a name for your app (e.g., `template-management-prod`)
3. Select region (e.g., **New York** or closest to your users)
4. Review pricing (estimate: $12-20/month for basic setup)
5. Click **"Create Resources"**

### Step 5: Wait for Deployment

- DigitalOcean will build and deploy your app (5-10 minutes)
- Watch the build logs for any errors
- Once complete, you'll get URLs:
  - Frontend: `https://your-app-name-xxxxx.ondigitalocean.app`
  - Backend: `https://your-app-name-backend-xxxxx.ondigitalocean.app`

## Part 5: Post-Deployment Setup

### Step 1: Seed Production Database

You'll need to create initial users in production. Options:

**Option A: Create a seed script endpoint (temporary):**

Add to `backend/src/server.js`:
```javascript
// TEMPORARY - Remove after first use
app.post('/api/admin/seed', async (req, res) => {
  const { secret } = req.body;
  
  // Use a one-time secret key you'll delete after use
  if (secret !== 'YOUR_ONE_TIME_SECRET_123') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    // Your seed logic here (create admin user)
    // ... 
    res.json({ message: 'Database seeded successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

Call it once via Postman or curl, then remove the endpoint and redeploy.

**Option B: Use DigitalOcean Console:**

1. Go to your App → Database → Console
2. Connect to PostgreSQL
3. Manually insert admin user:
```sql
INSERT INTO users (username, password, role, email) 
VALUES ('admin', '$2a$10$...', 'admin', 'admin@example.com');
```
(Use bcrypt to hash password first)

### Step 2: Test Your Deployment

1. Visit your frontend URL
2. Try logging in with your admin account
3. Create a test idea
4. Check all major features work
5. Test API endpoints

### Step 3: Set Up Automatic Deployments

DigitalOcean will automatically deploy when you push to the `main` branch.

To deploy updates:
```bash
git add .
git commit -m "Your update message"
git push origin main
```

DigitalOcean will detect the push and redeploy automatically.

### Step 4: Configure Custom Domain (Optional)

1. In DigitalOcean App Platform, go to **Settings** → **Domains**
2. Add your custom domain
3. Update DNS records as instructed
4. Enable HTTPS (automatic with Let's Encrypt)

## 💰 Estimated Costs

| Resource | Plan | Cost |
|----------|------|------|
| Backend (Web Service) | Basic - 512MB RAM | $5/month |
| Frontend (Static Site) | Starter | $0 (Free tier) or $5/month |
| PostgreSQL Database | Dev Database | $7/month |
| **Total** | | **~$12-17/month** |

You can upgrade/downgrade as needed.

## 🔧 Troubleshooting

### Build Fails

**Check build logs:**
1. Go to your app in DigitalOcean
2. Click on the failed deployment
3. Read the build logs

**Common issues:**
- Missing dependencies: Ensure `package.json` is correct
- Wrong Node version: Add `engines` to `package.json`:
  ```json
  "engines": {
    "node": "18.x"
  }
  ```
- Build command fails: Test locally with `npm ci && npm run build`

### Database Connection Fails

- Verify `DATABASE_URL` environment variable is set
- Check database is running in DigitalOcean dashboard
- Verify connection string format

### CORS Errors

- Ensure `FRONTEND_URL` in backend environment variables points to your frontend URL
- Check CORS configuration in `backend/src/server.js`

### Environment Variables Not Working

- Ensure they're set in DigitalOcean App settings
- Redeploy after changing environment variables
- Check variable names match exactly (case-sensitive)

## 🔄 Making Updates

### To update your code:

```bash
# Make your changes
git add .
git commit -m "Description of changes"
git push origin main
```

DigitalOcean will automatically detect and deploy.

### To rollback:

1. Go to DigitalOcean App dashboard
2. Click **Deployments** tab
3. Find previous successful deployment
4. Click **"Rollback"**

## 📚 Additional Resources

- [DigitalOcean App Platform Docs](https://docs.digitalocean.com/products/app-platform/)
- [DigitalOcean App Spec Reference](https://docs.digitalocean.com/products/app-platform/reference/app-spec/)
- [GitHub Docs](https://docs.github.com/)
- [PostgreSQL vs SQLite Comparison](https://www.digitalocean.com/community/tutorials/sqlite-vs-postgresql-comparing-relational-databases)

## 🆘 Getting Help

If you encounter issues:

1. Check DigitalOcean build logs
2. Review this guide's troubleshooting section
3. Search [DigitalOcean Community](https://www.digitalocean.com/community)
4. Contact DigitalOcean Support (if you have a paid plan)

---

## Quick Checklist

Before deploying, ensure:

- [ ] `.env` files are in `.gitignore`
- [ ] All secrets removed from code
- [ ] Database is properly configured
- [ ] `package.json` scripts are correct
- [ ] Code is tested locally
- [ ] `.digitalocean/app.yaml` is configured
- [ ] Repository is pushed to GitHub
- [ ] Environment variables are set in DigitalOcean
- [ ] Initial database seeding plan is ready

Good luck with your deployment! 🚀

