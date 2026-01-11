# DigitalOcean App Platform Deployment Guide

This guide walks you through deploying the Template Management Dashboard to DigitalOcean App Platform with a managed PostgreSQL database.

---

## Prerequisites

1. **DigitalOcean Account** - Create one at [digitalocean.com](https://www.digitalocean.com/)
2. **GitHub Account** - Your code needs to be in a GitHub repository
3. **Git** - Installed on your local machine

---

## Step 1: Prepare Your Code for GitHub

### 1.1 Initialize Git (if not already done)

```bash
cd C:\AP_work\Templates_Project
git init
```

### 1.2 Create a New GitHub Repository

1. Go to [github.com](https://github.com) and log in
2. Click the **+** icon → **New repository**
3. Name it (e.g., `template-management-dashboard`)
4. Keep it **Private** (recommended) or **Public**
5. Do NOT initialize with README (you already have one)
6. Click **Create repository**

### 1.3 Push Your Code to GitHub

```bash
# Add all files
git add .

# Commit
git commit -m "Initial commit - Template Management Dashboard"

# Add remote origin (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push to main branch
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy on DigitalOcean App Platform

### 2.1 Create a New App

1. Log in to [DigitalOcean Cloud Console](https://cloud.digitalocean.com/)
2. Click **Create** → **Apps** (or go to **App Platform** in the left menu)
3. Click **Create App**

### 2.2 Connect Your GitHub Repository

1. Select **GitHub** as the source
2. Click **Manage Access** if you haven't connected GitHub before
3. Authorize DigitalOcean to access your repositories
4. Select your repository (`template-management-dashboard`)
5. Select the **main** branch
6. Click **Next**

### 2.3 Configure Resources

DigitalOcean will auto-detect your app structure. You need to configure:

#### Backend API Service

1. Click on the detected backend component
2. Settings:
   - **Name**: `api`
   - **Source Directory**: `backend`
   - **Resource Type**: Web Service
   - **Build Command**: `npm install`
   - **Run Command**: `npm start`
   - **HTTP Port**: `3001`
   - **HTTP Route**: `/api`

3. Add additional route for WebSocket:
   - Click **Edit** on routes
   - Add route: `/socket.io`

#### Frontend Static Site

1. Click on the detected frontend component
2. Settings:
   - **Name**: `frontend`
   - **Source Directory**: `frontend`
   - **Resource Type**: Static Site
   - **Build Command**: `npm install && npm run build`
   - **Output Directory**: `dist`

### 2.4 Add Database

1. Click **Add Resource** → **Database**
2. Select **PostgreSQL**
3. Configure:
   - **Name**: `db`
   - **Version**: Latest (16+)
   - Choose **Dev Database** ($0/month) for testing or **Production** for live use
4. Click **Create and Attach**

---

## Step 3: Configure Environment Variables

Go to **Settings** → **App-Level Environment Variables** for each component:

### Backend API Environment Variables

| Variable | Value | Type |
|----------|-------|------|
| `NODE_ENV` | `production` | Plain |
| `PORT` | `3001` | Plain |
| `DATABASE_URL` | `${db.DATABASE_URL}` | Reference |
| `JWT_SECRET` | Generate a secure random string (32+ chars) | Secret |
| `FRONTEND_URL` | `${APP_URL}` | Reference |
| `TEMPLATES_API_KEY` | Your Activepieces Public Library API key (optional) | Secret |

> **Note**: The `TEMPLATES_API_KEY` is required for syncing categories to the Activepieces Public Library. You can get this key from your Activepieces admin settings. Without this key, the Category Management page will still work for local category management, but sync to Public Library will be disabled.

**To generate a JWT_SECRET**, run in your terminal:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Frontend Environment Variables (Build-time)

| Variable | Value | Type |
|----------|-------|------|
| `VITE_API_URL` | `${api.PUBLIC_URL}/api` | Reference |

---

## Step 4: Deploy the App

1. Review all settings
2. Select your **Plan** (Basic starts at $5/month per component)
   - Recommended: **Basic** plan with:
     - Backend: 1x Basic ($5/mo)
     - Frontend: Static Site (Free)
     - Database: Dev Database (Free) or Basic ($15/mo for production)
3. Click **Create Resources**

DigitalOcean will now:
- Build your frontend
- Deploy your backend
- Create and connect the database
- Set up SSL certificates automatically

**First deployment takes 5-10 minutes.**

---

## Step 5: Initialize the Database

After the first deployment, the database tables will be created automatically when the backend starts (thanks to the `initDatabase()` function in `db.js`).

Default login credentials:
- **Admin**: `admin` / `admin123`
- **Freelancer**: `freelancer` / `freelancer123`

⚠️ **IMPORTANT**: Change these passwords immediately after first login!

---

## Step 6: Verify Deployment

1. Click on your app name to see the dashboard
2. Get your app URL (e.g., `https://your-app-xxxxx.ondigitalocean.app`)
3. Test endpoints:
   - Frontend: `https://your-app-xxxxx.ondigitalocean.app`
   - Health check: `https://your-app-xxxxx.ondigitalocean.app/api/health`

---

## Troubleshooting

### View Logs

1. Go to **App Platform** → Your App
2. Click on **Runtime Logs** tab
3. Select component (api or frontend)

### Common Issues

#### 1. Database Connection Failed
- Ensure `DATABASE_URL` is set correctly with `${db.DATABASE_URL}`
- Check that the database status is "Running"

#### 2. CORS Errors
- Verify `FRONTEND_URL` environment variable matches your app URL
- The backend accepts multiple origins (comma-separated)

#### 3. Build Fails
- Check **Build Logs** for specific errors
- Ensure all dependencies are in `package.json`

#### 4. WebSocket Not Connecting
- Verify `/socket.io` route is added to the backend service
- Check that `VITE_API_URL` is set correctly

---

## Updating Your App

### Automatic Deployments

With `deploy_on_push: true` (default), every push to `main` triggers a new deployment.

```bash
git add .
git commit -m "Update feature X"
git push origin main
```

### Manual Deployment

1. Go to **App Platform** → Your App
2. Click **Actions** → **Deploy**

---

## Cost Estimate

| Component | Plan | Cost/Month |
|-----------|------|-----------|
| Backend API | Basic (1 vCPU, 512MB) | $5 |
| Frontend | Static Site | $0 |
| Database | Dev (for testing) | $0 |
| Database | Basic (for production) | $15 |
| **Total (Dev)** | | **$5/month** |
| **Total (Production)** | | **$20/month** |

---

## Security Checklist

- [ ] Changed default admin password
- [ ] Changed default freelancer password
- [ ] JWT_SECRET is a strong random string
- [ ] Database uses SSL (automatic with DigitalOcean managed DBs)
- [ ] Repository is private on GitHub

---

## Using the App Spec (Alternative Method)

Instead of configuring through the UI, you can use the `.do/app.yaml` file:

1. Edit `.do/app.yaml` and replace:
   - `YOUR_GITHUB_USERNAME/YOUR_REPO_NAME` with your actual repo path
   - `CHANGE_THIS_TO_A_STRONG_SECRET` with your JWT secret

2. In DigitalOcean:
   - Go to **App Platform**
   - Click **Create App**
   - Choose **From Source Code**
   - Select your repo
   - DigitalOcean will detect the `.do/app.yaml` and use its configuration

---

## Support

- [DigitalOcean App Platform Docs](https://docs.digitalocean.com/products/app-platform/)
- [Managing Databases](https://docs.digitalocean.com/products/app-platform/how-to/manage-databases/)
- [Environment Variables](https://docs.digitalocean.com/products/app-platform/how-to/use-environment-variables/)

