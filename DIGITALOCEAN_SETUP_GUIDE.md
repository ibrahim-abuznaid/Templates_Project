# DigitalOcean App Platform Setup Guide
**Template Management Dashboard - Complete Configuration**

---

## 🎯 Overview

You'll create 3 resources:
1. **Backend** (Web Service) - Node.js API
2. **Frontend** (Static Site) - React app
3. **Database** (PostgreSQL) - Managed database

---

## 📝 Step 1: Create Backend Service

### 1.1 Add Component
1. In DigitalOcean App Platform, click **"Create App"** (or if app exists, click **"+ Add Resource"**)
2. Select **"Service"** (Web Service)

### 1.2 Source Configuration
| Setting | Value |
|---------|-------|
| **Service provider** | GitHub |
| **Repository** | `ibrahim-abuznaid/Templates_Project` |
| **Branch** | `main` |
| **Source Directory** | `/backend` |
| **Autodeploy** | ✅ Enabled |

### 1.3 Build Configuration
| Setting | Value |
|---------|-------|
| **Name** | `api` (or `backend`) |
| **Environment** | Node.js |
| **Build Command** | `npm install` |
| **Run Command** | `npm start` |

### 1.4 Instance Configuration
| Setting | Value |
|---------|-------|
| **Instance Size** | Basic ($5/mo) or Professional ($12/mo) |
| **Instance Count** | 1 |

### 1.5 HTTP Configuration
| Setting | Value |
|---------|-------|
| **HTTP Port** | `8080` |
| **HTTP Routes** | `/api` and `/socket.io` |

**To add routes:**
- Click **Edit** next to "HTTP request routes"
- Add route: `/api`
- Click **"+ Add Route"**
- Add route: `/socket.io`

### 1.6 Health Check
| Setting | Value |
|---------|-------|
| **HTTP Path** | `/api/health` |
| **Initial Delay** | 30 seconds |
| **Period** | 10 seconds |
| **Timeout** | 5 seconds |
| **Failure Threshold** | 3 |

### 1.7 Environment Variables

**IMPORTANT:** Click **Edit** next to "Environment variables" and add these:

#### Generate JWT_SECRET First
Run this in your terminal:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Copy the output - you'll use it below.

#### Add These Variables:

| Key | Value | Type | Encrypt? |
|-----|-------|------|----------|
| `NODE_ENV` | `production` | Plain Text | No |
| `PORT` | `8080` | Plain Text | No |
| `JWT_SECRET` | `[paste generated secret]` | Secret | Yes |
| `FRONTEND_URL` | `${APP_URL}` | Plain Text | No |
| `DATABASE_URL` | `${db.DATABASE_URL}` | Plain Text | No |

**Note:** The `${}` syntax tells DigitalOcean to inject values automatically.

---

## 🌐 Step 2: Create Frontend Static Site

### 2.1 Add Component
1. Click **"+ Add Resource"**
2. Select **"Static Site"** (NOT Service!)

### 2.2 Source Configuration
| Setting | Value |
|---------|-------|
| **Service provider** | GitHub |
| **Repository** | `ibrahim-abuznaid/Templates_Project` |
| **Branch** | `main` |
| **Source Directory** | `/frontend` |
| **Autodeploy** | ✅ Enabled |

### 2.3 Build Configuration
| Setting | Value |
|---------|-------|
| **Name** | `frontend` |
| **Build Command** | `npm install && npm run build` |
| **Output Directory** | `dist` |

⚠️ **IMPORTANT:** Output directory is `dist` (NOT `frontend/dist`)

### 2.4 HTTP Configuration
| Setting | Value |
|---------|-------|
| **HTTP Routes** | `/` |
| **Catchall Document** | `index.html` |

### 2.5 Environment Variables (Build-time)

Click **Edit** next to "Environment variables" and add:

| Key | Value | Scope |
|-----|-------|-------|
| `VITE_API_URL` | `${api.PUBLIC_URL}/api` | Build Time |

⚠️ **Note:** Replace `api` with your backend component name if different.

---

## 🗄️ Step 3: Create Database

### 3.1 Add Database
1. Click **"+ Add Resource"**
2. Select **"Database"**

### 3.2 Database Configuration
| Setting | Value |
|---------|-------|
| **Name** | `db` |
| **Engine** | PostgreSQL |
| **Version** | Latest (16+) |
| **Cluster** | Dev Database (Free) or Basic ($15/mo) |

**Cost Options:**
- **Dev Database:** FREE (for testing, less resources)
- **Basic:** $15/mo (for production, more reliable)

### 3.3 Connection
The database will automatically inject `DATABASE_URL` to your backend service.

---

## 🔗 Step 4: Configure Routes (Final Check)

After creating all components, verify routes don't conflict:

### Backend Routes:
- `/api` ✅
- `/socket.io` ✅

### Frontend Routes:
- `/` ✅ (catch-all, should be last)

**Route Priority:** Backend routes (`/api`, `/socket.io`) will be checked first, then frontend catch-all (`/`).

---

## 🚀 Step 5: Deploy

1. Review all configurations
2. Click **"Create Resources"** (or **"Deploy"** if app exists)
3. Wait 5-10 minutes for:
   - Database to provision
   - Backend to build and deploy
   - Frontend to build and deploy

---

## ✅ Step 6: Verify Deployment

### 6.1 Get Your App URL
After deployment, DigitalOcean will provide URLs like:
- **App URL:** `https://your-app-xxxxx.ondigitalocean.app`
- **Backend URL:** `https://api-xxxxx.ondigitalocean.app`
- **Frontend URL:** Same as App URL

### 6.2 Test Backend Health
Open in browser:
```
https://your-app-xxxxx.ondigitalocean.app/api/health
```

Should return:
```json
{
  "status": "OK",
  "message": "Server is running"
}
```

### 6.3 Test Frontend
Open in browser:
```
https://your-app-xxxxx.ondigitalocean.app
```

Should show the login page.

### 6.4 Login
Use default credentials:
- **Admin:** `admin` / `admin123`
- **Freelancer:** `freelancer` / `freelancer123`

⚠️ **Change these passwords immediately after first login!**

---

## 🐛 Troubleshooting

### Backend Not Starting
**Check Runtime Logs:**
1. Go to App Platform → Your App
2. Click on backend component
3. Click **Runtime Logs** tab
4. Look for errors like:
   - Database connection failed → Check `DATABASE_URL`
   - Port binding issues → Ensure `PORT=8080`
   - Missing `JWT_SECRET` → Check environment variables

### Frontend Build Fails
**Check Build Logs:**
1. Click on frontend component
2. Click **Build Logs** tab
3. Common issues:
   - TypeScript errors → Push latest code
   - `VITE_API_URL` not set → Check environment variables

### Frontend Shows Blank Page
**Check Browser Console:**
1. Open browser DevTools (F12)
2. Check Console tab for errors
3. Common issues:
   - API calls failing → Check `VITE_API_URL`
   - CORS errors → Check backend `FRONTEND_URL`

### Database Connection Issues
1. Verify database is "Running" status
2. Check backend logs for connection errors
3. Ensure `DATABASE_URL` environment variable is set
4. DigitalOcean managed databases require SSL (already configured in code)

---

## 💰 Cost Summary

| Resource | Tier | Cost/Month |
|----------|------|------------|
| Backend | Basic | $5 |
| Frontend | Static Site | FREE |
| Database | Dev | FREE |
| **Total (Dev)** | | **$5/month** |

| Resource | Tier | Cost/Month |
|----------|------|------------|
| Backend | Basic | $5 |
| Frontend | Static Site | FREE |
| Database | Basic | $15 |
| **Total (Production)** | | **$20/month** |

---

## 🔒 Security Checklist

After deployment:

- [ ] Change default admin password
- [ ] Change default freelancer password  
- [ ] Verify JWT_SECRET is strong (64+ characters)
- [ ] Ensure DATABASE_URL is encrypted
- [ ] Check that database requires SSL (automatic)
- [ ] Consider making GitHub repo private

---

## 📚 Quick Reference

### Environment Variable Reference Table

#### Backend (Runtime)
```
NODE_ENV=production
PORT=8080
JWT_SECRET=[your-secret-here]
FRONTEND_URL=${APP_URL}
DATABASE_URL=${db.DATABASE_URL}
```

#### Frontend (Build Time)
```
VITE_API_URL=${api.PUBLIC_URL}/api
```

### Command Reference

#### Backend
```bash
Build: npm install
Run:   npm start
```

#### Frontend
```bash
Build: npm install && npm run build
Output: dist/
```

---

## 🆘 Need Help?

1. **Check Logs:** App Platform → Component → Logs tab
2. **DigitalOcean Docs:** https://docs.digitalocean.com/products/app-platform/
3. **Repository Issues:** Create an issue in your GitHub repo

---

## ✨ Next Steps After Deployment

1. **Test all features:**
   - Login with both roles
   - Create a template idea
   - Assign to freelancer
   - Test real-time notifications
   - Try invoice generation

2. **Change default passwords**

3. **Add your team:**
   - Invite users via the app
   - Assign appropriate roles

4. **Monitor performance:**
   - Check runtime logs regularly
   - Monitor database usage
   - Watch for errors

---

**🎉 That's it! Your app should now be live on DigitalOcean!**

