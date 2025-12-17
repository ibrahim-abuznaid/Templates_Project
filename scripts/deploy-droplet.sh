#!/bin/bash

# =============================================================================
# Template Management Dashboard - DigitalOcean Droplet Deployment Script
# =============================================================================
# 
# This script automates the deployment of the Template Management Dashboard
# to a fresh DigitalOcean Droplet running Ubuntu 22.04.
#
# Usage:
#   1. SSH into your droplet as root
#   2. Run: curl -sSL https://raw.githubusercontent.com/ibrahim-abuznaid/Templates_Project/main/scripts/deploy-droplet.sh | bash
#   Or:
#   1. Copy this script to the server
#   2. chmod +x deploy-droplet.sh
#   3. ./deploy-droplet.sh
#
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/var/www/template-dashboard"
REPO_URL="https://github.com/ibrahim-abuznaid/Templates_Project.git"
DB_NAME="template_management"
DB_USER="template_user"

echo -e "${BLUE}"
echo "=============================================="
echo "  Template Dashboard Deployment Script"
echo "=============================================="
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: Please run as root (sudo)${NC}"
  exit 1
fi

# Prompt for configuration
echo -e "${YELLOW}Please provide the following configuration:${NC}"
echo ""

read -p "Enter your domain name (e.g., dashboard.example.com): " DOMAIN
read -p "Enter your email (for SSL certificate): " EMAIL
read -sp "Enter a strong database password: " DB_PASSWORD
echo ""
read -sp "Enter admin user password (for 'admin' account): " ADMIN_PASSWORD
echo ""
read -sp "Enter freelancer user password (for 'freelancer' account): " FREELANCER_PASSWORD
echo ""

# Generate JWT secret
JWT_SECRET=$(openssl rand -hex 64)
echo -e "${GREEN}Generated JWT Secret${NC}"

echo ""
echo -e "${BLUE}Configuration Summary:${NC}"
echo "  Domain: $DOMAIN"
echo "  Email: $EMAIL"
echo "  Database: $DB_NAME"
echo "  App Directory: $APP_DIR"
echo ""
read -p "Continue with deployment? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
  echo "Deployment cancelled."
  exit 0
fi

# =============================================================================
# Step 1: System Update
# =============================================================================
echo -e "\n${BLUE}[1/9] Updating system...${NC}"
apt update && apt upgrade -y
echo -e "${GREEN}✓ System updated${NC}"

# =============================================================================
# Step 2: Install Node.js 20
# =============================================================================
echo -e "\n${BLUE}[2/9] Installing Node.js 20...${NC}"
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1 | tr -d 'v') -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
echo -e "${GREEN}✓ Node.js $(node -v) installed${NC}"

# =============================================================================
# Step 3: Install Dependencies
# =============================================================================
echo -e "\n${BLUE}[3/9] Installing dependencies...${NC}"
apt install -y git nginx postgresql postgresql-contrib build-essential
npm install -g pm2
echo -e "${GREEN}✓ Dependencies installed${NC}"

# =============================================================================
# Step 4: Configure Swap (for build process)
# =============================================================================
echo -e "\n${BLUE}[4/9] Configuring swap space...${NC}"
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
fi
echo -e "${GREEN}✓ Swap configured ($(free -h | grep Swap | awk '{print $2}'))${NC}"

# =============================================================================
# Step 5: Setup PostgreSQL
# =============================================================================
echo -e "\n${BLUE}[5/9] Setting up PostgreSQL...${NC}"
systemctl start postgresql
systemctl enable postgresql

# Create user and database
sudo -u postgres psql -c "DROP DATABASE IF EXISTS ${DB_NAME};" 2>/dev/null || true
sudo -u postgres psql -c "DROP USER IF EXISTS ${DB_USER};" 2>/dev/null || true
sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

echo -e "${GREEN}✓ PostgreSQL configured${NC}"

# =============================================================================
# Step 6: Clone and Setup Application
# =============================================================================
echo -e "\n${BLUE}[6/9] Deploying application...${NC}"

# Remove existing app directory if exists
rm -rf $APP_DIR

# Clone repository
git clone $REPO_URL $APP_DIR
cd $APP_DIR

# Create backend .env file
cat > backend/.env << EOF
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}
JWT_SECRET=${JWT_SECRET}
FRONTEND_URL=https://${DOMAIN}
DEFAULT_ADMIN_PASSWORD=${ADMIN_PASSWORD}
DEFAULT_FREELANCER_PASSWORD=${FREELANCER_PASSWORD}
EOF

chmod 600 backend/.env

# Install dependencies
echo "Installing root dependencies..."
npm install

echo "Installing backend dependencies..."
cd backend && npm install && cd ..

echo "Installing frontend dependencies..."
cd frontend && npm install

# Build frontend
echo "Building frontend..."
VITE_API_URL=/api npm run build

cd $APP_DIR
echo -e "${GREEN}✓ Application deployed${NC}"

# =============================================================================
# Step 7: Configure Nginx
# =============================================================================
echo -e "\n${BLUE}[7/9] Configuring Nginx...${NC}"

cat > /etc/nginx/sites-available/template-dashboard << EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    root ${APP_DIR}/frontend/dist;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)\$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/template-dashboard /etc/nginx/sites-enabled/

nginx -t
systemctl reload nginx
echo -e "${GREEN}✓ Nginx configured${NC}"

# =============================================================================
# Step 8: Setup PM2
# =============================================================================
echo -e "\n${BLUE}[8/9] Setting up PM2...${NC}"

cat > $APP_DIR/ecosystem.config.cjs << EOF
module.exports = {
  apps: [{
    name: 'template-api',
    cwd: '${APP_DIR}/backend',
    script: 'src/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/pm2/template-api-error.log',
    out_file: '/var/log/pm2/template-api-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    exp_backoff_restart_delay: 100,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF

mkdir -p /var/log/pm2

# Start application
cd $APP_DIR
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root

echo -e "${GREEN}✓ PM2 configured${NC}"

# =============================================================================
# Step 9: Configure Firewall
# =============================================================================
echo -e "\n${BLUE}[9/9] Configuring firewall...${NC}"
ufw --force enable
ufw allow OpenSSH
ufw allow 'Nginx Full'
echo -e "${GREEN}✓ Firewall configured${NC}"

# =============================================================================
# Final Steps & Summary
# =============================================================================
echo -e "\n${GREEN}"
echo "=============================================="
echo "  Deployment Complete!"
echo "=============================================="
echo -e "${NC}"

echo -e "${YELLOW}IMPORTANT: Complete these final steps:${NC}"
echo ""
echo "1. Point your domain DNS to this server:"
echo "   Create an A record: ${DOMAIN} → $(curl -s ifconfig.me)"
echo ""
echo "2. Wait for DNS propagation (5-10 minutes)"
echo ""
echo "3. Install SSL certificate:"
echo "   certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --email ${EMAIL} --agree-tos --no-eff-email"
echo ""
echo "4. Test your deployment:"
echo "   https://${DOMAIN}"
echo ""
echo -e "${BLUE}Login Credentials (as you configured):${NC}"
echo "   Admin: admin / [password you entered]"
echo "   Freelancer: freelancer / [password you entered]"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "   pm2 status          - Check app status"
echo "   pm2 logs            - View logs"
echo "   pm2 restart all     - Restart app"
echo ""
echo "Configuration saved to: ${APP_DIR}/backend/.env"
echo ""

# Test the deployment
echo -e "${BLUE}Testing deployment...${NC}"
sleep 5

HEALTH_CHECK=$(curl -s http://localhost:3001/api/health || echo "failed")
if [[ $HEALTH_CHECK == *"OK"* ]]; then
  echo -e "${GREEN}✓ Backend is running correctly!${NC}"
else
  echo -e "${RED}✗ Backend health check failed. Check logs: pm2 logs${NC}"
fi
