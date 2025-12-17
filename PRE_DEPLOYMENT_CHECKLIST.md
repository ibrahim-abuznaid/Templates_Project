# Pre-Deployment Checklist
**Complete this checklist BEFORE deploying to DigitalOcean Droplet**

---

## ✅ Pre-Flight Checks

### 1. Domain Name
- [ ] I have a domain name ready (e.g., `templates.mycompany.com`)
- [ ] I have access to my domain's DNS settings
- [ ] I know my domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)

### 2. DigitalOcean Account
- [ ] I have a DigitalOcean account
- [ ] I have a payment method added
- [ ] I know my SSH key (or will use password authentication)

### 3. GitHub Repository
- [ ] Code is pushed to the main branch
- [ ] Repository is accessible (public or I have deploy keys)

---

## 📋 Information to Have Ready

Fill in these values before starting deployment:

| Item | Your Value |
|------|------------|
| **Domain name** | _________________ |
| **Droplet region** | _________________ (closest to users) |
| **Email for SSL** | _________________ |
| **Database password** | _________________ (use a strong password!) |

---

## 🔑 Generate Secure Passwords

Run this locally to generate secure passwords:

```bash
# Database password (copy and save securely)
node -e "console.log('DB Password:', require('crypto').randomBytes(24).toString('base64'))"

# JWT Secret (will be auto-generated during deployment)
node -e "console.log('JWT Secret:', require('crypto').randomBytes(64).toString('hex'))"
```

---

## 💰 Budget Confirmation

| Resource | Monthly Cost |
|----------|--------------|
| Droplet (2GB RAM) | $12 |
| Managed DB (optional) | $15 |
| **Total** | **$12-27** |

- [ ] I understand and accept the costs

---

## 🚀 Deployment Methods

### Option A: Automated Script (Recommended)
After creating your droplet, SSH in and run:

```bash
# Download and run deployment script
curl -sSL https://raw.githubusercontent.com/ibrahim-abuznaid/Templates_Project/main/scripts/deploy-droplet.sh -o deploy.sh
chmod +x deploy.sh
./deploy.sh
```

### Option B: Manual Deployment
Follow the step-by-step guide in `DROPLET_DEPLOYMENT_GUIDE.md`

---

## ⏱️ Estimated Time

| Step | Time |
|------|------|
| Create Droplet | 2 min |
| Run Deployment Script | 10-15 min |
| DNS Propagation | 5-30 min |
| SSL Setup | 2 min |
| **Total** | **~30-60 min** |

---

## 🆘 If Something Goes Wrong

1. **Check PM2 logs**: `pm2 logs template-api`
2. **Check Nginx errors**: `tail -50 /var/log/nginx/error.log`
3. **Check database**: `systemctl status postgresql`
4. **Start over**: You can always destroy the droplet and create a new one

---

## ✨ After Deployment

- [ ] Changed admin password
- [ ] Changed freelancer password
- [ ] Verified SSL certificate works (green padlock)
- [ ] Tested login functionality
- [ ] Tested creating a template idea
- [ ] Verified real-time notifications work

---

**Ready to deploy? Start with the `DROPLET_DEPLOYMENT_GUIDE.md`!**
