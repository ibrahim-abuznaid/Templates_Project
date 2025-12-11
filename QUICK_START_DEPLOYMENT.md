# Quick Start: Deploy to GitHub & DigitalOcean

This is a condensed guide for experienced developers. For detailed instructions, see `DEPLOYMENT_GUIDE.md`.

## 📦 Prerequisites

```bash
# Install PostgreSQL package
cd backend
npm install pg
cd ..
```

## 🔧 1. Prepare Repository

```bash
# Navigate to project
cd C:\AP_work\Templates_Project

# Check git status (should ignore .env, node_modules, database)
git status

# Stage and commit
git add .
git commit -m "Prepare for deployment"
```

## 🐙 2. Push to GitHub

```bash
# Create repo on GitHub: https://github.com/new
# Then connect local to remote:

git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

## 🌊 3. Deploy to DigitalOcean

### Update App Spec

Edit `.digitalocean/app.yaml` and replace:
```yaml
repo: YOUR_GITHUB_USERNAME/YOUR_REPO_NAME
```

With your actual GitHub username and repo name.

### Create App on DigitalOcean

1. **Login**: https://cloud.digitalocean.com/
2. **Create** → **Apps**
3. **Connect GitHub** → Select your repository → Branch: `main`
4. **Edit App Spec** → Upload `.digitalocean/app.yaml`
5. **Set Environment Variables**:
   
   **Backend:**
   - `NODE_ENV` = `production`
   - `PORT` = `8080`
   - `JWT_SECRET` = Generate random string (mark as encrypted)
   - `FRONTEND_URL` = `${frontend.PUBLIC_URL}`
   - `DATABASE_URL` = `${main-db.DATABASE_URL}`
   
   **Frontend:**
   - `VITE_API_URL` = `${backend.PUBLIC_URL}/api`

6. **Create Resources** → Wait 5-10 minutes

### Generate JWT Secret

```bash
# Option 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Option 2: Using OpenSSL
openssl rand -hex 64

# Option 3: Online
# Visit: https://www.random.org/strings/
```

## ✅ 4. Verify Deployment

```bash
# Test backend health
curl https://your-backend-url.ondigitalocean.app/api/health

# Should return:
# {"status":"OK","message":"Server is running"}
```

Visit frontend URL and test:
- Login with: `admin` / `admin123`
- Create an idea
- Verify all features work

## 🔄 5. Future Updates

Simply push to GitHub:

```bash
git add .
git commit -m "Your changes"
git push origin main
```

DigitalOcean auto-deploys from `main` branch.

## 💰 Estimated Costs

- **Backend**: $5/month (Basic - 512MB)
- **Frontend**: $0-5/month (Static Site)
- **Database**: $7/month (PostgreSQL Dev)
- **Total**: ~$12-17/month

## 🔧 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Build fails | Check logs in DigitalOcean dashboard |
| Database error | Verify `DATABASE_URL` is set |
| CORS error | Check `FRONTEND_URL` matches actual URL |
| 404 on routes | Ensure `catchall_document: index.html` |

## 📚 Important Files Created

- ✅ `.digitalocean/app.yaml` - App Platform configuration
- ✅ `backend/src/database/db-postgres.js` - PostgreSQL adapter
- ✅ `backend/package.json` - Updated with `pg` dependency
- ✅ `frontend/src/services/api.ts` - Updated for environment variables

## 🎯 Key Changes Made

1. **Backend now supports PostgreSQL** in production (auto-detects `DATABASE_URL`)
2. **Frontend API URL** uses environment variable for production
3. **Package.json** includes Node.js engine requirements
4. **PostgreSQL adapter** with automatic schema creation and user seeding

## ⚠️ Important Notes

- Default users (admin/freelancer) are created automatically in production
- Database is PostgreSQL in production, SQLite in development
- SSL/HTTPS is automatic via DigitalOcean
- Backups are automatic (can be configured in DigitalOcean)

## 🆘 Need Help?

- **Detailed Guide**: See `DEPLOYMENT_GUIDE.md`
- **Checklist**: See `GITHUB_DEPLOYMENT_CHECKLIST.md`
- **DigitalOcean Docs**: https://docs.digitalocean.com/products/app-platform/

---

**You're ready to deploy!** 🚀

Files to edit:
1. `.digitalocean/app.yaml` (update GitHub repo)
2. DigitalOcean dashboard (set environment variables)

Then push to GitHub and watch it deploy!

