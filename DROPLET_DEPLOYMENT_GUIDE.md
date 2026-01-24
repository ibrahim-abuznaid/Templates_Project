# DigitalOcean Droplet Deployment Guide
**Template Management Dashboard - Complete VPS Deployment**

---

## 📋 Application Overview

Your application consists of:
| Component | Technology | Port | Notes |
|-----------|------------|------|-------|
| **Backend** | Node.js 20 + Express | 3001 | REST API + Socket.IO |
| **Frontend** | React + Vite | Static | Built files served by Nginx |
| **Database** | PostgreSQL 16 | 5432 | Local or managed |
| **WebSocket** | Socket.IO | 3001 | Real-time notifications |

---

## ⚠️ POTENTIAL ISSUES & PREVENTIONS

Before we start, here are the issues you might face and how we'll prevent them:

| Issue | Cause | Prevention |
|-------|-------|------------|
| **Build fails** | Low RAM on small droplet | Add swap space (Step 2.5) |
| **CORS errors** | Frontend/Backend URL mismatch | Proper env vars + Nginx proxy |
| **WebSocket disconnects** | Nginx not configured for WS | Special Nginx config (Step 5) |
| **SSL handshake fails** | Wrong certificate path | Use Certbot auto-config |
| **App crashes** | Process not managed | PM2 with auto-restart (Step 6) |
| **Database connection fails** | Wrong SSL config | Proper DATABASE_URL format |
| **"Address in use" error** | Port conflicts | Check/kill existing processes |
| **Firewall blocks traffic** | UFW misconfigured | Open only needed ports |
| **Permission denied** | File ownership issues | Correct permissions (Step 3) |
| **Node version wrong** | Old Node.js installed | Use NodeSource repo (Step 2.3) |

---

## 🚀 Step 1: Create the Droplet

### 1.1 Droplet Specifications

**Recommended specs:**
| Tier | RAM | CPU | Storage | Cost | Use Case |
|------|-----|-----|---------|------|----------|
| **Basic** | 2GB | 1 vCPU | 50GB | $12/mo | Testing, small team |
| **Production** | 4GB | 2 vCPU | 80GB | $24/mo | Production, larger team |

⚠️ **IMPORTANT**: Don't use the $4/mo (512MB RAM) droplet - builds will fail!

### 1.2 Create Droplet in DigitalOcean

1. Log in to [DigitalOcean](https://cloud.digitalocean.com/)
2. Click **Create** → **Droplets**
3. Choose:
   - **Region**: Choose closest to your users
   - **Image**: Ubuntu 22.04 (LTS) x64
   - **Size**: Basic → Regular → $12/mo (2GB/1CPU)
   - **Authentication**: SSH Keys (recommended) or Password
   - **Hostname**: `template-dashboard` (or your choice)

4. Click **Create Droplet**
5. Note the **IP Address** once created

---

## 🔧 Step 2: Initial Server Setup

### 2.1 Connect to Your Droplet

```bash
ssh root@YOUR_DROPLET_IP
```

### 2.2 Update System

```bash
apt update && apt upgrade -y
```

### 2.3 Install Node.js 20 (IMPORTANT: Must be v20+)

```bash
# Install NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
apt install -y nodejs

# Verify versions (Node should be 20.x, npm 10.x)
node --version
npm --version
```

### 2.4 Install Required Packages

```bash
# Install Git, Nginx, and build tools
apt install -y git nginx build-essential

# Install PM2 globally (process manager)
npm install -g pm2
```

### 2.5 Add Swap Space (CRITICAL for small droplets!)

This prevents build failures due to low memory:

```bash
# Create 2GB swap file
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab

# Verify
free -h
```

### 2.6 Create Application User (Security best practice)

```bash
# Create user for running the app
adduser --system --group --home /home/nodeapp nodeapp

# Add to sudo group (optional, for maintenance)
usermod -aG sudo nodeapp
```

---

## 🗄️ Step 3: Install & Configure PostgreSQL

### Option A: Local PostgreSQL (Recommended for simplicity)

```bash
# Install PostgreSQL 16
apt install -y postgresql postgresql-contrib

# Start and enable service
systemctl start postgresql
systemctl enable postgresql

# Create database and user
sudo -u postgres psql <<EOF
CREATE USER template_user WITH PASSWORD 'YOUR_SECURE_PASSWORD_HERE';
CREATE DATABASE template_management OWNER template_user;
GRANT ALL PRIVILEGES ON DATABASE template_management TO template_user;
\q
EOF
```

**Your DATABASE_URL will be:**
```
postgresql://template_user:YOUR_SECURE_PASSWORD_HERE@localhost:5432/template_management
```

### Option B: DigitalOcean Managed Database

If you prefer a managed database ($15/mo):
1. Go to DigitalOcean → Databases → Create Database
2. Choose PostgreSQL 16
3. Use the connection string provided (includes SSL by default)

**Managed DATABASE_URL format:**
```
postgresql://user:password@host:25060/defaultdb?sslmode=require
```

---

## 📁 Step 4: Deploy Application Code

### 4.1 Clone Repository

```bash
# Create app directory
mkdir -p /var/www
cd /var/www

# Clone your repository
git clone https://github.com/ibrahim-abuznaid/Templates_Project.git template-dashboard
cd template-dashboard

# Set ownership
chown -R nodeapp:nodeapp /var/www/template-dashboard
```

### 4.2 Create Environment File for Backend

```bash
# Create .env file
cat > /var/www/template-dashboard/backend/.env << 'EOF'
# Server Configuration
NODE_ENV=production
PORT=3001

# Database (Update with your actual values!)
DATABASE_URL=postgresql://template_user:YOUR_DB_PASSWORD_HERE@localhost:5432/template_management

# JWT Secret (Generate a new one using the command below!)
JWT_SECRET=<GENERATE_WITH_COMMAND_BELOW>

# Frontend URL (Update with your domain!)
FRONTEND_URL=http://YOUR_SERVER_IP_OR_DOMAIN

# Default User Passwords (CHANGE THESE! Only used when seeding fresh database)
DEFAULT_ADMIN_PASSWORD=<GENERATE_SECURE_PASSWORD>
DEFAULT_FREELANCER_PASSWORD=<GENERATE_SECURE_PASSWORD>
EOF

# Secure the file
chmod 600 /var/www/template-dashboard/backend/.env
chown nodeapp:nodeapp /var/www/template-dashboard/backend/.env
```

**Generate secure values:**
```bash
# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate strong passwords for default users
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"
```

### 4.3 Install Dependencies

```bash
cd /var/www/template-dashboard

# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies  
cd ../frontend
npm install
```

### 4.4 Build Frontend

```bash
cd /var/www/template-dashboard/frontend

# Set build-time environment variable
export VITE_API_URL=/api

# Build production bundle
npm run build

# Verify build succeeded
ls -la dist/
```

### 4.5 Test Backend Locally (Quick Check)

```bash
cd /var/www/template-dashboard/backend

# Test that server starts
node src/server.js

# You should see:
# 🐘 Connecting to PostgreSQL...
# ✅ PostgreSQL schema initialized
# 🚀 Server is running on http://localhost:3001
```

Press `Ctrl+C` to stop.

---

## 🌐 Step 5: Configure Nginx (Reverse Proxy)

### 5.1 Create Nginx Configuration

```bash
cat > /etc/nginx/sites-available/template-dashboard << 'EOF'
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;  # UPDATE THIS!

    # Frontend static files
    root /var/www/template-dashboard/frontend/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # API proxy (IMPORTANT: Include trailing slash handling)
    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Socket.IO WebSocket proxy (CRITICAL for real-time features!)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001/socket.io/;
        proxy_http_version 1.1;
        
        # WebSocket upgrade headers (REQUIRED!)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket timeout (keep connections alive)
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Frontend SPA routing (React Router)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
```

### 5.2 Enable Site

```bash
# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Enable our site
ln -sf /etc/nginx/sites-available/template-dashboard /etc/nginx/sites-enabled/

# Test configuration
nginx -t

# Reload Nginx
systemctl reload nginx
```

---

## 🔄 Step 6: Setup PM2 Process Manager

### 6.1 Create PM2 Ecosystem File

```bash
cat > /var/www/template-dashboard/ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'template-api',
    cwd: '/var/www/template-dashboard/backend',
    script: 'src/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    // Logging
    error_file: '/var/log/pm2/template-api-error.log',
    out_file: '/var/log/pm2/template-api-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    // Restart policy
    exp_backoff_restart_delay: 100,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF

# Create log directory
mkdir -p /var/log/pm2
chown -R nodeapp:nodeapp /var/log/pm2
```

### 6.2 Start Application with PM2

```bash
cd /var/www/template-dashboard

# Start the app
pm2 start ecosystem.config.cjs

# Check status
pm2 status

# View logs (real-time)
pm2 logs template-api

# Save PM2 process list (so it survives reboot)
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd -u root --hp /root
```

### 6.3 Useful PM2 Commands

```bash
pm2 restart template-api   # Restart app
pm2 stop template-api      # Stop app
pm2 delete template-api    # Remove from PM2
pm2 logs                   # View logs
pm2 monit                  # Live monitoring dashboard
```

---

## 🔥 Step 7: Configure Firewall (UFW)

```bash
# Enable UFW
ufw --force enable

# Allow SSH (DON'T SKIP THIS or you'll be locked out!)
ufw allow OpenSSH

# Allow HTTP and HTTPS
ufw allow 'Nginx Full'

# Check status
ufw status
```

**Expected output:**
```
Status: active
To                         Action      From
--                         ------      ----
OpenSSH                    ALLOW       Anywhere
Nginx Full                 ALLOW       Anywhere
```

---

## 🔒 Step 8: Setup SSL with Let's Encrypt

### 8.1 Point Your Domain to the Droplet

Before this step, create an A record in your DNS:
| Type | Name | Value |
|------|------|-------|
| A | @ | YOUR_DROPLET_IP |
| A | www | YOUR_DROPLET_IP |

**Wait 5-10 minutes for DNS propagation.**

### 8.2 Install Certbot

```bash
apt install -y certbot python3-certbot-nginx
```

### 8.3 Obtain SSL Certificate

```bash
# Get certificate (replace with your domain)
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow prompts:
# - Enter email
# - Agree to terms
# - Choose redirect HTTP to HTTPS (recommended)
```

### 8.4 Verify Auto-Renewal

```bash
# Test renewal
certbot renew --dry-run

# Certbot automatically sets up a cron job/timer
systemctl status certbot.timer
```

---

## ✅ Step 9: Verify Deployment

### 9.1 Check All Services

```bash
# Check Nginx
systemctl status nginx

# Check PostgreSQL
systemctl status postgresql

# Check PM2/Node app
pm2 status

# Check app logs for errors
pm2 logs template-api --lines 50
```

### 9.2 Test Endpoints

```bash
# Test health endpoint (from server)
curl http://localhost:3001/api/health

# Expected: {"status":"OK","message":"Server is running"}

# Test through Nginx
curl http://localhost/api/health
```

### 9.3 Test in Browser

1. Open `https://yourdomain.com`
2. You should see the login page
3. Login with the credentials you set in `.env`:
   - **Admin**: `admin` / (password you set as `DEFAULT_ADMIN_PASSWORD`)
   - **Freelancer**: `freelancer` / (password you set as `DEFAULT_FREELANCER_PASSWORD`)

💡 **Note**: These default users are created only on first database initialization. Consider changing passwords through the application after first login.

---

## 🐛 Troubleshooting Guide

### Issue: "502 Bad Gateway"

**Cause**: Backend not running

```bash
# Check if backend is running
pm2 status

# If stopped, check logs
pm2 logs template-api --lines 100

# Restart
pm2 restart template-api
```

### Issue: "Connection refused to database"

**Cause**: PostgreSQL not running or wrong credentials

```bash
# Check PostgreSQL status
systemctl status postgresql

# Test connection manually
psql -U template_user -h localhost -d template_management

# Check .env file
cat /var/www/template-dashboard/backend/.env
```

### Issue: "WebSockets not working / Real-time updates not showing"

**Cause**: Nginx WebSocket proxy misconfigured

```bash
# Verify Nginx config has WebSocket headers
grep -A 10 "socket.io" /etc/nginx/sites-available/template-dashboard

# Should show: proxy_set_header Upgrade $http_upgrade
```

### Issue: "CORS Error in browser console"

**Cause**: FRONTEND_URL mismatch

```bash
# Check backend .env
grep FRONTEND_URL /var/www/template-dashboard/backend/.env

# Should match your actual domain (with https://)
# Example: FRONTEND_URL=https://yourdomain.com
```

### Issue: "Build failed - out of memory"

**Cause**: Not enough RAM, swap not configured

```bash
# Check swap
free -h

# If swap is 0, add it (Step 2.5)
```

### Issue: "Address already in use"

**Cause**: Another process using port 3001

```bash
# Find what's using the port
lsof -i :3001

# Kill it if needed
kill -9 <PID>

# Or use PM2 to handle it
pm2 delete all
pm2 start ecosystem.config.cjs
```

### Issue: "SSL Certificate error"

**Cause**: Certificate expired or not properly configured

```bash
# Check certificate status
certbot certificates

# Renew if needed
certbot renew

# Check Nginx SSL config
nginx -t
```

---

## 📊 Monitoring & Maintenance

### View Application Logs

```bash
# PM2 logs (application)
pm2 logs template-api

# Nginx access logs
tail -f /var/log/nginx/access.log

# Nginx error logs
tail -f /var/log/nginx/error.log

# PostgreSQL logs
tail -f /var/log/postgresql/postgresql-16-main.log
```

### Update Application

```bash
cd /var/www/template-dashboard

# Pull latest code
git pull origin main

# Install any new dependencies
cd backend && npm install
cd ../frontend && npm install

# Rebuild frontend
cd ../frontend
VITE_API_URL=/api npm run build

# Restart backend
pm2 restart template-api
```

### Database Backup

```bash
# Create backup
pg_dump -U template_user -h localhost template_management > backup_$(date +%Y%m%d).sql

# Restore backup
psql -U template_user -h localhost template_management < backup_YYYYMMDD.sql
```

### Automated Backups (Optional)

```bash
# Create backup script
cat > /usr/local/bin/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/postgresql"
mkdir -p $BACKUP_DIR
pg_dump -U template_user -h localhost template_management > $BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql
# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
EOF

chmod +x /usr/local/bin/backup-db.sh

# Add to cron (daily at 2 AM)
echo "0 2 * * * /usr/local/bin/backup-db.sh" | crontab -
```

---

## 💰 Cost Summary

| Resource | Configuration | Cost/Month |
|----------|---------------|------------|
| **Droplet** | 2GB RAM / 1 vCPU | $12 |
| **Droplet** | 4GB RAM / 2 vCPU | $24 |
| **Managed DB** | Basic PostgreSQL | $15 (optional) |
| **Domain** | .com | ~$12/year |
| **SSL** | Let's Encrypt | FREE |

**Minimum Setup**: ~$12/month
**Production Setup**: ~$24-39/month

---

## 🔒 Security Checklist

After deployment, ensure:

- [ ] Changed default admin password
- [ ] Changed default freelancer password
- [ ] JWT_SECRET is 64+ random characters
- [ ] DATABASE_URL password is strong
- [ ] SSH uses key authentication (not password)
- [ ] UFW firewall is enabled
- [ ] SSL certificate is active (HTTPS)
- [ ] Nginx security headers are set
- [ ] `.env` file has restricted permissions (600)
- [ ] Regular database backups are configured

---

## 🎉 Quick Reference Commands

```bash
# SSH into server
ssh root@YOUR_DROPLET_IP

# Check app status
pm2 status

# View logs
pm2 logs template-api

# Restart app
pm2 restart template-api

# Check Nginx
systemctl status nginx
nginx -t

# Check database
systemctl status postgresql

# Update app
cd /var/www/template-dashboard && git pull && pm2 restart template-api

# View resource usage
htop
```

---

## 🆘 Getting Help

1. **Check PM2 logs first**: `pm2 logs template-api --lines 100`
2. **Check Nginx error log**: `tail -50 /var/log/nginx/error.log`
3. **Test database connection**: `psql -U template_user -h localhost template_management`
4. **Verify services**: `systemctl status nginx postgresql`

---

**🎊 Congratulations! Your Template Management Dashboard is now deployed!**
