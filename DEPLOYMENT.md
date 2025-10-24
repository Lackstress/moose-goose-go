# 🚀 Games Hub - Quick Deployment Guide

Choose your preferred deployment method:

## ⚡ Method 1: One-Command Deploy (Fastest - 5 minutes)

```bash
# On your VM, run:
git clone https://github.com/Lackstress/games.git
cd games
chmod +x quick-deploy.sh
./quick-deploy.sh
```

**Enter your domain and email when prompted. Done!**

---

## 🐳 Method 2: Docker Deploy (Easiest - 10 minutes)

```bash
git clone https://github.com/Lackstress/games.git
cd games
chmod +x deploy-docker.sh
./deploy-docker.sh
```

**Pros:** Isolated containers, easy to update, portable  
**Cons:** Uses Docker (slightly more resources)

---

## 🔧 Method 3: Traditional Deploy (Most Control - 15 minutes)

```bash
git clone https://github.com/Lackstress/games.git
cd games
chmod +x deploy.sh
./deploy.sh
```

**Pros:** Full control, PM2 process manager, direct access  
**Cons:** Manually manage dependencies

---

## 📋 DNS Setup (Do This FIRST!)

Before running any script, configure your domain DNS on Namecheap:

1. Get your VM's public IP:
   ```bash
   curl ifconfig.me
   ```

2. On Namecheap:
   - Go to your domain → **Advanced DNS**
   - Add **A Record**: `@` → `YOUR_VM_IP`
   - Add **A Record**: `www` → `YOUR_VM_IP`

3. Wait 5-15 minutes for DNS propagation

---

## 🎯 What Gets Installed Automatically

All methods install:
- ✅ Node.js & npm
- ✅ Nginx (reverse proxy)
- ✅ SSL Certificate (HTTPS)
- ✅ Firewall configuration
- ✅ Auto-restart on crash
- ✅ Auto-renew SSL certificates

---

## 🛠️ Post-Deployment Commands

### View Logs
```bash
# Method 1 & 3 (PM2)
pm2 logs games-hub

# Method 2 (Docker)
docker-compose logs -f
```

### Restart App
```bash
# Method 1 & 3 (PM2)
pm2 restart games-hub

# Method 2 (Docker)
docker-compose restart
```

### Update App
```bash
# Method 1 & 3
cd games
git pull
npm install
pm2 restart games-hub

# Method 2
cd games
git pull
docker-compose up -d --build
```

### Stop App
```bash
# Method 1 & 3
pm2 stop games-hub

# Method 2
docker-compose down
```

---

## 🔍 Troubleshooting

### Check if app is running
```bash
# Method 1 & 3
pm2 status

# Method 2
docker-compose ps
```

### Check Nginx
```bash
sudo nginx -t
sudo systemctl status nginx
```

### Check SSL Certificate
```bash
sudo certbot certificates
```

### View all ports in use
```bash
sudo netstat -tulpn | grep LISTEN
```

### Test from command line
```bash
curl http://localhost:3000  # Test Node app
curl http://localhost       # Test Nginx
```

---

## 🔄 Quick Updates

Pull latest changes and restart:

```bash
cd games
git pull
npm install

# If using PM2:
pm2 restart games-hub

# If using Docker:
docker-compose up -d --build
```

---

## 🔐 Security Notes

- All methods automatically set up HTTPS
- Firewall configured to only allow HTTP/HTTPS/SSH
- Node app runs on localhost:3000 (not exposed directly)
- Nginx acts as reverse proxy with security headers
- SSL certificates auto-renew every 90 days

---

## 📊 Resource Requirements

**Minimum VM Specs:**
- **CPU:** 1 core
- **RAM:** 1GB (2GB recommended)
- **Storage:** 10GB
- **OS:** Ubuntu 20.04+ or Debian 11+

**Recommended VM Specs:**
- **CPU:** 2 cores
- **RAM:** 2-4GB
- **Storage:** 20GB

---

## 💰 Estimated Costs

- **Domain (Namecheap):** $10-15/year
- **VM (DigitalOcean):** $6-12/month
- **VM (AWS Lightsail):** $3.50-10/month
- **VM (Vultr):** $6-12/month
- **SSL Certificate:** FREE (Let's Encrypt)

**Total:** ~$10-15/year + $3.50-12/month

---

## 🎮 Your Site Structure

After deployment:
- `https://yourdomain.com/` - Landing page
- `https://yourdomain.com/ghub` - Game hub
- `https://yourdomain.com/games` - Your games lobby
- `https://yourdomain.com/duckmath` - DuckMath games

---

## 📞 Need Help?

If deployment fails:
1. Check DNS propagation: https://dnschecker.org
2. Verify firewall: `sudo ufw status`
3. Check logs: `pm2 logs` or `docker-compose logs`
4. Test Nginx: `sudo nginx -t`
5. Restart everything:
   ```bash
   pm2 restart all
   sudo systemctl restart nginx
   ```

---

## 🎯 Recommended: Method 1 (One-Command)

For most users, **Method 1** is the best choice:
- ✅ Fastest deployment (5 minutes)
- ✅ Everything automated
- ✅ PM2 for process management
- ✅ Easy to update
- ✅ Low resource usage

**Just run:**
```bash
git clone https://github.com/Lackstress/games.git
cd games
chmod +x quick-deploy.sh
./quick-deploy.sh
```
