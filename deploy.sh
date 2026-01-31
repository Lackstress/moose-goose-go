#!/bin/bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Games Hub - Automated Deployment Script${NC}"
echo "=================================================="

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    echo -e "${RED}❌ Don't run this script as root/sudo${NC}"
    exit 1
fi

# Remember repo dir to reliably cd back later
REPO_DIR="$(pwd)"

# Prompt for domain name
read -p "Enter your domain name (e.g., mygames.com): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}❌ Domain name is required${NC}"
    exit 1
fi

read -p "Enter your email for SSL certificate: " EMAIL

if [ -z "$EMAIL" ]; then
    echo -e "${RED}❌ Email is required${NC}"
    exit 1
fi

echo -e "${YELLOW}📝 Configuration:${NC}"
echo "   Domain: $DOMAIN"
echo "   Email: $EMAIL"
read -p "Continue? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

##############################################
# Step 1/10: Update system
##############################################
echo -e "${GREEN}📦 Step 1/10: Updating system...${NC}"
sudo apt update
echo -e "${YELLOW}   Upgrading packages (this may take a few minutes)...${NC}"
sudo DEBIAN_FRONTEND=noninteractive apt upgrade -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" || echo -e "${YELLOW}⚠️  Some packages failed to upgrade, continuing...${NC}"

##############################################
# Step 2/10: Install Node.js 20.x if missing
##############################################
if ! command -v node &> /dev/null; then
    echo -e "${GREEN}📦 Step 2/10: Installing Node.js 20.x...${NC}"
    curl -fsSL --connect-timeout 30 --max-time 120 https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo -e "${GREEN}✅ Step 2/10: Node.js already installed: $(node -v)${NC}"
fi

##############################################
# Step 3/10: Install Nginx
##############################################
echo -e "${GREEN}📦 Step 3/10: Installing Nginx...${NC}"
sudo apt install -y nginx

##############################################
# Step 4/10: Install Certbot
##############################################
echo -e "${GREEN}📦 Step 4/10: Installing Certbot...${NC}"
sudo apt install -y certbot python3-certbot-nginx

##############################################
# Step 4.5/10: Install yt-dlp (media player)
##############################################
echo -e "${GREEN}📦 Step 4.5/10: Installing yt-dlp for media player...${NC}"
if ! command -v yt-dlp &> /dev/null; then
    sudo apt install -y yt-dlp || sudo pip3 install yt-dlp || {
        echo -e "${YELLOW}   Installing via direct download...${NC}"
        sudo curl -fsSL --connect-timeout 30 --max-time 60 https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
        sudo chmod a+rx /usr/local/bin/yt-dlp
    }
    echo -e "${GREEN}   ✅ yt-dlp installed${NC}"
else
    echo -e "${GREEN}   ✅ yt-dlp already installed${NC}"
fi

##############################################
# Step 5/10: Install PM2
##############################################
echo -e "${GREEN}📦 Step 5/10: Installing PM2...${NC}"
sudo npm install -g pm2

# Stop existing app if present (idempotent)
echo -e "${YELLOW}🛑 Stopping existing PM2 process (if any)...${NC}"
pm2 delete games-hub 2>/dev/null || true

##############################################
# Step 5.5/10: DuckMath Setup (Using Existing)
##############################################
echo -e "${GREEN}📦 Step 5.5/10: DuckMath setup...${NC}"
echo -e "${YELLOW}   DuckMath: Using existing installation (original repo unavailable)${NC}"
echo -e "${GREEN}   ✅ DuckMath ready${NC}"

##############################################
# Step 5.6/10: Clone/Update Lunaar
##############################################
echo -e "${GREEN}🌙 Step 5.6/10: Cloning/Updating Lunaar...${NC}"
if [ ! -d "lunaar.org-main" ]; then
    echo -e "${YELLOW}   Cloning Lunaar...${NC}"
    timeout 300 git clone --depth 1 https://github.com/parcoil/lunaar.org.git lunaar.org-main || {
        echo -e "${YELLOW}⚠️  Lunaar clone failed or timed out, continuing without Lunaar...${NC}"
    }
else
    echo -e "${YELLOW}   Updating Lunaar...${NC}"
    (cd lunaar.org-main && timeout 120 git pull --ff-only) || echo -e "${YELLOW}⚠️  Lunaar update failed, using existing version...${NC}"
fi
if [ -d "lunaar.org-main" ]; then
    echo -e "${GREEN}   ✅ Lunaar ready${NC}"
fi

##############################################
# Step 5.7/10: Clone/Update Seraph
##############################################
echo -e "${GREEN}📦 Step 5.7/10: Cloning/Updating Seraph gaming hub...${NC}"
if [ ! -d "seraph" ]; then
    echo -e "${YELLOW}   Cloning Seraph (5.68 GiB - may take 5-10 minutes)...${NC}"
    timeout 900 git clone --depth 1 --progress https://github.com/Lackstress/seraph.git seraph || {
        echo -e "${YELLOW}⚠️  Seraph clone failed or timed out, continuing without Seraph...${NC}"
    }
else
    echo -e "${YELLOW}   Updating Seraph...${NC}"
    (cd seraph && timeout 300 git pull --ff-only) || echo -e "${YELLOW}⚠️  Seraph update failed or timed out, using existing version...${NC}"
fi
if [ -d "seraph" ]; then
    echo -e "${GREEN}   ✅ Seraph ready${NC}"
fi

# Return to repo directory reliably
cd "${REPO_DIR}"

##############################################
# Step 6/10: Pull latest repo + install deps
##############################################
echo -e "${GREEN}📦 Step 6/10: Pulling latest repository changes...${NC}"

# One-time: Remove games.db from git tracking if it's tracked
if git ls-files --error-unmatch database/games.db &>/dev/null; then
    echo -e "${YELLOW}🔧 Removing games.db from git tracking (one-time)...${NC}"
    if [ -f "database/games.db" ]; then
        cp database/games.db database/games.db.permanent_backup
    fi
    git rm --cached database/games.db 2>/dev/null || true
    if [ -f "database/games.db.permanent_backup" ]; then
        mv database/games.db.permanent_backup database/games.db
    fi
    echo -e "${GREEN}   ✓ Database will no longer conflict with git${NC}"
fi

# Preserve games.db before pulling
echo -e "${YELLOW}🛡️  Preserving database before git pull...${NC}"
if [ -f "database/games.db" ]; then
    cp database/games.db database/games.db.backup
    git stash push -u database/games.db 2>/dev/null || true
    echo -e "${GREEN}   ✓ Database backed up${NC}"
fi

echo -e "${YELLOW}   Pulling latest changes...${NC}"
timeout 120 git pull --ff-only || echo -e "${YELLOW}⚠️  Git pull failed or timed out, using existing version...${NC}"

# Restore games.db after pull
if [ -f "database/games.db.backup" ]; then
    mv database/games.db.backup database/games.db
    echo -e "${GREEN}   ✓ Database restored${NC}"
fi

echo -e "${GREEN}📦 Installing project dependencies...${NC}"
timeout 300 npm install || {
    echo -e "${RED}❌ npm install failed or timed out${NC}"
    exit 1
}

##############################################
# Step 7/10: Create/Update .env
##############################################
echo -e "${GREEN}📝 Step 7/10: Creating environment file...${NC}"
cat > .env << EOL
PORT=3000
NODE_ENV=production
EOL

##############################################
# Step 8/10: Configure Nginx
##############################################
echo -e "${GREEN}⚙️  Step 8/10: Configuring Nginx...${NC}"
sudo tee /etc/nginx/sites-available/$DOMAIN > /dev/null << EOL
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    client_max_body_size 100M;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }
    
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOL

# Enable site
sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx config
echo -e "${YELLOW}🧪 Testing Nginx configuration...${NC}"
sudo nginx -t

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Nginx configuration failed${NC}"
    exit 1
fi

echo -e "${YELLOW}🔄 Restarting and enabling Nginx...${NC}"
sudo systemctl restart nginx
sudo systemctl enable nginx
echo -e "${GREEN}   ✅ Nginx configured and enabled${NC}"

##############################################
# Step 9/10: Configure firewall
##############################################
echo -e "${GREEN}🔒 Configuring firewall...${NC}"
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
echo "y" | sudo ufw enable

##############################################
# Step 9.5/10: Start application with PM2
##############################################
echo -e "${GREEN}🚀 Step 9.5/10: Starting application with PM2...${NC}"
pm2 delete games-hub 2>/dev/null || true

echo -e "${YELLOW}   Starting Node.js server...${NC}"
pm2 start server.js --name "games-hub" --time --watch false --max-memory-restart 500M

if ! pm2 list | grep -q "games-hub.*online"; then
    echo -e "${RED}❌ Failed to start server with PM2${NC}"
    echo -e "${YELLOW}Check logs with: pm2 logs games-hub${NC}"
    exit 1
fi

echo -e "${YELLOW}   Saving PM2 process list...${NC}"
pm2 save --force

echo -e "${YELLOW}   Configuring PM2 to start on boot...${NC}"
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
pm2 save --force

echo -e "${GREEN}   ✅ Application started and configured for auto-start${NC}"

##############################################
# Step 10/10: SSL certificate
##############################################
echo -e "${GREEN}🔐 Step 10/10: Setting up SSL certificate...${NC}"

# Wait a moment for server to be fully ready
echo -e "${YELLOW}   Waiting for server to be ready...${NC}"
sleep 3

# Verify server is responding on port 3000
if ! curl -s http://localhost:3000 > /dev/null; then
    echo -e "${YELLOW}⚠️  Warning: Server may not be responding on port 3000${NC}"
    echo -e "${YELLOW}   Check with: pm2 logs games-hub${NC}"
fi

echo -e "${YELLOW}   Obtaining SSL certificate from Let's Encrypt...${NC}"
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  SSL certificate setup failed. You can try again later with:${NC}"
    echo -e "${YELLOW}   sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN${NC}"
else
    echo -e "${GREEN}   ✅ SSL certificate installed successfully${NC}"
fi

echo ""
echo -e "${GREEN}================================================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "=================================================================${NC}"
echo ""
echo -e "${YELLOW}🌐 Your site should be live at:${NC}"
echo -e "   • https://$DOMAIN"
echo -e "   • https://www.$DOMAIN"
echo ""
echo -e "${YELLOW}📍 Available Routes:${NC}"
echo -e "   • https://$DOMAIN/ - Landing page (hub selector)"
echo -e "   • https://$DOMAIN/ghub - Custom GameHub"
echo -e "   • https://$DOMAIN/duckmath - DuckMath educational games"
if [ -d "../lunaar.org-main" ]; then
    echo -e "   • https://$DOMAIN/lunaar - Lunaar (350+ games + proxy)"
fi
if [ -d "../seraph" ]; then
    echo -e "   • https://$DOMAIN/seraph - Seraph (350+ games)"
fi
echo ""
echo -e "${YELLOW}⚙️  SERVER MANAGEMENT COMMANDS:${NC}"
echo ""
echo -e "${GREEN}Start/Stop/Restart:${NC}"
echo "   pm2 start games-hub          # Start the server"
echo "   pm2 stop games-hub           # Stop the server"
echo "   pm2 restart games-hub        # Restart the server"
echo "   pm2 reload games-hub         # Reload with zero-downtime"
echo "   pm2 delete games-hub         # Remove from PM2"
echo ""
echo -e "${GREEN}Monitoring:${NC}"
echo "   pm2 status                   # View all PM2 processes"
echo "   pm2 logs games-hub           # View live logs (Ctrl+C to exit)"
echo "   pm2 logs games-hub --lines 50  # View last 50 log lines"
echo "   pm2 monit                    # Interactive monitoring dashboard"
echo ""
echo -e "${GREEN}Nginx Commands:${NC}"
echo "   sudo systemctl status nginx  # Check Nginx status"
echo "   sudo systemctl restart nginx # Restart Nginx"
echo "   sudo nginx -t                # Test Nginx configuration"
echo "   sudo systemctl reload nginx  # Reload config without downtime"
echo ""
echo -e "${GREEN}SSL Certificate:${NC}"
echo "   sudo certbot renew --dry-run # Test certificate renewal"
echo "   sudo certbot certificates    # List all certificates"
echo "   sudo certbot renew           # Manually renew certificates"
echo ""
echo -e "${YELLOW}🔧 TROUBLESHOOTING:${NC}"
echo ""
echo -e "${GREEN}If site isn't accessible:${NC}"
echo "   1. Check server is running:  pm2 status"
echo "   2. Check logs for errors:    pm2 logs games-hub --err"
echo "   3. Check Nginx status:       sudo systemctl status nginx"
echo "   4. Check firewall:           sudo ufw status"
echo "   5. Verify DNS propagation:   nslookup $DOMAIN"
echo ""
echo -e "${GREEN}DNS Configuration (Namecheap):${NC}"
echo "   If domain not working, verify these DNS records exist:"
echo "   • A Record: @   → $(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP')"
echo "   • A Record: www → $(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP')"
echo ""
echo -e "${YELLOW}   ⚠️  DNS propagation can take 5-30 minutes after adding records${NC}"
echo -e "${YELLOW}   ⚠️  Check propagation: https://dnschecker.org/#A/$DOMAIN${NC}"
echo ""
echo -e "${GREEN}Quick Deployment Commands:${NC}"
echo "   cd $(pwd)                    # Navigate to repo"
echo "   git pull                     # Pull latest changes"
echo "   npm install                  # Update dependencies"
echo "   pm2 restart games-hub        # Restart server"
echo ""
echo -e "${GREEN}🎮 Happy Gaming! If you need help, check PM2 logs first.${NC}"
echo ""
