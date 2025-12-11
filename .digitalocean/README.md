# DigitalOcean App Platform Configuration

This directory contains the configuration for deploying your application to DigitalOcean App Platform.

## 📄 app.yaml

The `app.yaml` file is the App Spec that defines how your application should be deployed on DigitalOcean.

### What's Configured

- **Backend Service** (Node.js/Express)
  - Source: `/backend`
  - Build: `npm ci`
  - Run: `npm start`
  - Port: 8080
  - Route: `/api`

- **Frontend Static Site** (React/Vite)
  - Source: `/frontend`
  - Build: `npm ci && npm run build`
  - Output: `dist`
  - Route: `/`

- **Database** (PostgreSQL 15)
  - Managed PostgreSQL database
  - Automatic backups
  - Production-ready configuration

### Environment Variables

The following environment variables are defined in the spec:

**Backend:**
- `NODE_ENV` - Set to `production`
- `PORT` - Set to `8080` (DigitalOcean standard)
- `JWT_SECRET` - **You must provide this** (marked as SECRET)
- `FRONTEND_URL` - Auto-filled from frontend service
- `DATABASE_URL` - Auto-filled from database

**Frontend:**
- `VITE_API_URL` - Auto-filled from backend service

## 🔧 Before Deploying

### Required Changes

**1. Update GitHub Repository References**

Find these lines in `app.yaml` (appears twice):
```yaml
repo: YOUR_GITHUB_USERNAME/YOUR_REPO_NAME
```

Change to your actual repository:
```yaml
repo: john-doe/template-management-dashboard
```

**2. Generate JWT Secret**

Generate a secure random string:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

You'll set this in DigitalOcean when deploying.

## 🚀 How to Use

### Option 1: Upload in DigitalOcean Console

1. Create new app in DigitalOcean
2. Connect to GitHub repository
3. Click "Edit App Spec"
4. Upload or paste contents of `app.yaml`
5. Review and create

### Option 2: Use DigitalOcean CLI (doctl)

```bash
# Install doctl if not already installed
# https://docs.digitalocean.com/reference/doctl/how-to/install/

# Authenticate
doctl auth init

# Create app from spec
doctl apps create --spec .digitalocean/app.yaml

# Update existing app
doctl apps update YOUR_APP_ID --spec .digitalocean/app.yaml
```

## 📊 Resource Sizing

Current configuration uses:

- **Backend**: `basic-xxs` (512 MB RAM, 1 vCPU) - $5/month
- **Frontend**: `basic-xxs` (512 MB RAM, 1 vCPU) - $0-5/month (static site)
- **Database**: PostgreSQL Dev (1 GB RAM) - $7/month

**Total: ~$12-17/month**

### Scaling Options

To scale, change `instance_size_slug` in `app.yaml`:

| Slug | RAM | vCPU | Price |
|------|-----|------|-------|
| `basic-xxs` | 512 MB | 1 | $5/mo |
| `basic-xs` | 1 GB | 1 | $10/mo |
| `basic-s` | 2 GB | 1 | $15/mo |
| `professional-xs` | 1 GB | 1 | $12/mo |
| `professional-s` | 2 GB | 2 | $24/mo |

Or increase `instance_count` for horizontal scaling.

## 🔍 Health Checks

The backend service includes a health check:

- **Path**: `/api/health`
- **Initial delay**: 30 seconds
- **Period**: 10 seconds
- **Timeout**: 5 seconds

If health checks fail, DigitalOcean will restart the service.

## 🔄 Deployment Behavior

- **Trigger**: Push to `main` branch
- **Behavior**: Automatic deployment
- **Strategy**: Rolling update (zero downtime)

To disable auto-deploy, change:
```yaml
deploy_on_push: false
```

## 📝 App Spec Reference

For complete documentation of all available options:
https://docs.digitalocean.com/products/app-platform/reference/app-spec/

## 🛠️ Customization

### Add Environment Variable

```yaml
envs:
  - key: MY_VARIABLE
    value: "my_value"
    scope: RUN_AND_BUILD_TIME  # or RUN_TIME
```

### Add Worker Service

```yaml
workers:
  - name: my-worker
    environment_slug: node-js
    github:
      repo: YOUR_USERNAME/YOUR_REPO
      branch: main
    source_dir: /backend
    run_command: node src/worker.js
```

### Add Scheduled Job

```yaml
jobs:
  - name: cleanup-job
    kind: CRON
    schedule: "0 2 * * *"  # Every day at 2 AM
    run_command: node src/jobs/cleanup.js
```

## ⚠️ Important Notes

1. **Secrets**: Mark sensitive environment variables as `type: SECRET`
2. **Database**: PostgreSQL is required for production (SQLite won't persist)
3. **Ports**: Backend must listen on port specified in `PORT` env var (8080)
4. **Build Time**: First build takes 5-10 minutes; subsequent builds are faster
5. **Logs**: Access logs in DigitalOcean dashboard under "Runtime Logs"

## 🔐 Security

- All services run over HTTPS (automatic SSL)
- Environment variables are encrypted at rest
- Database connections use SSL in production
- Services are isolated and firewalled

## 📊 Monitoring

Once deployed, monitor:
- **Deployments**: View build logs and deployment history
- **Runtime Logs**: Real-time application logs
- **Metrics**: CPU, memory, bandwidth usage
- **Alerts**: Set up alerts for failures or resource limits

## 🆘 Troubleshooting

### Build Fails

1. Check build logs in DigitalOcean dashboard
2. Verify `package.json` has all dependencies
3. Ensure Node.js version is compatible (18+)

### Health Check Fails

1. Verify `/api/health` endpoint exists and returns 200
2. Check if app is listening on correct port (`process.env.PORT`)
3. Review runtime logs for errors

### Database Connection Fails

1. Verify database is created and running
2. Check `DATABASE_URL` environment variable is set
3. Ensure SSL is enabled for PostgreSQL connection

## 📚 Additional Resources

- [DigitalOcean App Platform Docs](https://docs.digitalocean.com/products/app-platform/)
- [App Spec Reference](https://docs.digitalocean.com/products/app-platform/reference/app-spec/)
- [Environment Variables Guide](../ENVIRONMENT_VARIABLES.md)
- [Deployment Guide](../DEPLOYMENT_GUIDE.md)

---

**Need help?** Check the main deployment guides in the project root or visit DigitalOcean's documentation.

