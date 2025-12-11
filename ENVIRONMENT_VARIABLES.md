# Environment Variables Guide

This document explains all environment variables needed for the application.

## 📋 Overview

Environment variables are configuration values that differ between environments (development vs production). They should **NEVER** be committed to Git.

## 🔧 Backend Environment Variables

### Local Development
Create `backend/.env` file with:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Security
# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# CORS Configuration
FRONTEND_URL=http://localhost:5173

# Database Configuration
# For production with PostgreSQL (set by DigitalOcean)
# DATABASE_URL=postgresql://user:password@host:port/database

# For development, SQLite is used automatically (no DATABASE_URL needed)
```

### Production (DigitalOcean)
Set in DigitalOcean App Platform dashboard:

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Tells app it's in production mode |
| `PORT` | `8080` | DigitalOcean uses port 8080 |
| `JWT_SECRET` | `[64-char random string]` | ⚠️ Mark as "Encrypted" |
| `FRONTEND_URL` | `${frontend.PUBLIC_URL}` | Auto-filled by DigitalOcean |
| `DATABASE_URL` | `${main-db.DATABASE_URL}` | Auto-filled by DigitalOcean |

## 🎨 Frontend Environment Variables

### Local Development
Create `frontend/.env` file with:

```env
# API Configuration
# Uses Vite proxy in development
VITE_API_URL=http://localhost:3001/api
```

### Production (DigitalOcean)
Set in DigitalOcean App Platform dashboard:

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_API_URL` | `${backend.PUBLIC_URL}/api` | Auto-filled by DigitalOcean |

## 🔐 Generating Secure Secrets

### JWT_SECRET
Generate a secure random string for JWT signing:

**Method 1: Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Method 2: OpenSSL**
```bash
openssl rand -hex 64
```

**Method 3: PowerShell (Windows)**
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | % {[char]$_})
```

**Method 4: Online**
- Visit: https://www.random.org/strings/
- Length: 64
- Characters: Alphanumeric

### Important
- ⚠️ **Never share** your JWT_SECRET
- ⚠️ **Never commit** it to Git
- ⚠️ Store it securely (password manager)
- ⚠️ Use different secrets for dev/production

## 📝 Creating .env Files

### For Backend

1. Navigate to backend folder:
   ```bash
   cd backend
   ```

2. Create `.env` file:
   ```bash
   # Windows PowerShell
   New-Item -Path .env -ItemType File

   # Windows CMD
   type nul > .env

   # Git Bash / Linux / macOS
   touch .env
   ```

3. Open `.env` in text editor and add variables

4. Verify it's in `.gitignore`:
   ```bash
   git status
   ```
   The `.env` file should NOT appear in the list

### For Frontend

1. Navigate to frontend folder:
   ```bash
   cd frontend
   ```

2. Create `.env` file (same as above)

3. Add the `VITE_API_URL` variable

4. Verify it's ignored by Git

## 🌍 Environment Detection

The application automatically detects which environment it's running in:

### Backend
```javascript
if (process.env.DATABASE_URL) {
  // Production: Use PostgreSQL
  initPostgresDatabase();
} else {
  // Development: Use SQLite
  initDatabase();
}
```

### Frontend
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
```

## ✅ Verification

### Local Development
1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Check console for:
   - Backend: "💻 Development mode: Using SQLite database"
   - Frontend: Should connect to `http://localhost:3001/api`

### Production
1. Check DigitalOcean build logs
2. Look for: "🚀 Production mode: Using PostgreSQL database"
3. Verify environment variables are set correctly

## 🚨 Common Issues

### "JWT_SECRET is not defined"
**Problem**: JWT_SECRET environment variable not set
**Solution**: 
- Local: Add to `backend/.env`
- Production: Set in DigitalOcean dashboard

### "Cannot connect to database"
**Problem**: DATABASE_URL is set but incorrect
**Solution**: 
- Production: Verify `${main-db.DATABASE_URL}` is used
- Check database is created in DigitalOcean

### "CORS error"
**Problem**: FRONTEND_URL doesn't match actual frontend URL
**Solution**: 
- Local: Set to `http://localhost:5173`
- Production: Use `${frontend.PUBLIC_URL}`

### "Cannot read environment variable"
**Problem**: Variable name typo or not loaded
**Solution**: 
- Backend: Variables should be in `backend/.env`
- Frontend: Variables must start with `VITE_`
- Restart dev server after changing `.env`

## 📚 DigitalOcean Variable References

DigitalOcean provides special variables:

- `${backend.PUBLIC_URL}` - Full URL of backend service
- `${frontend.PUBLIC_URL}` - Full URL of frontend service
- `${main-db.DATABASE_URL}` - PostgreSQL connection string

These are automatically populated by DigitalOcean.

## 🔄 Updating Environment Variables

### Local Development
1. Edit `.env` file
2. Restart your dev server
3. Changes take effect immediately

### Production
1. Go to DigitalOcean App dashboard
2. Click your app
3. Go to **Settings** → **App-Level Environment Variables** or component settings
4. Update variable
5. **Important**: Click "Save" then manually trigger a redeploy
6. Or: Push any commit to GitHub to trigger auto-deploy

## 🎯 Best Practices

1. **Never commit `.env` files** to Git
2. **Use different secrets** for development and production
3. **Document all variables** (like this file does)
4. **Use example files** (`.env.example`) for reference
5. **Rotate secrets periodically** (especially if exposed)
6. **Mark sensitive variables** as encrypted in DigitalOcean
7. **Don't log environment variables** in production

## 📖 Example Files

Your project includes example files (not committed to Git):

- `backend/.env.example` - Template for backend variables
- `frontend/.env.example` - Template for frontend variables

Copy these to `.env` and fill in your actual values:

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend  
cp frontend/.env.example frontend/.env
```

Then edit and add your actual values.

## 🔗 References

- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [DigitalOcean App Spec](https://docs.digitalocean.com/products/app-platform/reference/app-spec/)
- [Node.js Best Practices - Environment Variables](https://github.com/goldbergyoni/nodebestpractices#6-security-best-practices)

---

## Quick Reference

| File | Purpose | Committed to Git? |
|------|---------|-------------------|
| `.env` | Actual secrets | ❌ NO |
| `.env.example` | Template/documentation | ✅ YES |
| `.gitignore` | Lists files to ignore | ✅ YES |

**Remember**: If you accidentally commit a secret, you must:
1. Rotate/change the secret immediately
2. Update it everywhere (local, production)
3. Remove from Git history (advanced)

---

Need help? Check the deployment guides or DigitalOcean documentation!

