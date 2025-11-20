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
# Step 5.5/10: Clone/Update DuckMath
##############################################
echo -e "${GREEN}📦 Step 5.5/10: Cloning/Updating DuckMath games...${NC}"
cd "${REPO_DIR}"
cd ..
if [ ! -d "duckmath" ]; then
    echo -e "${YELLOW}   Cloning DuckMath repository...${NC}"
    timeout 300 git clone --depth 1 https://github.com/duckmath/duckmath.github.io.git duckmath || echo -e "${YELLOW}⚠️  DuckMath clone failed or timed out, continuing...${NC}"
else
    echo -e "${YELLOW}   Updating DuckMath repository...${NC}"
    (cd duckmath && timeout 120 git pull --ff-only) || echo -e "${YELLOW}⚠️  DuckMath update failed or timed out, continuing...${NC}"
fi
echo -e "${GREEN}   ✅ DuckMath ready${NC}"

##############################################
# Step 5.6/10: Clone/Update + Patch + Build Radon Games
##############################################
echo -e "${GREEN}⚡ Step 5.6/10: Cloning/Patching/Building Radon Games...${NC}"
# Install pnpm if not already installed
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}   Installing pnpm...${NC}"
    sudo npm install -g pnpm
fi

if [ ! -d "radon-games" ]; then
    echo -e "${YELLOW}   Cloning Radon Games repository (this may take a minute)...${NC}"
    timeout 300 git clone --depth 1 https://github.com/Radon-Games/Radon-Games.git radon-games || {
        echo -e "${RED}❌ Radon Games clone failed or timed out${NC}"
        exit 1
    }
fi

cd radon-games
echo -e "${YELLOW}   Updating Radon Games...${NC}"
git reset --hard HEAD || true
timeout 120 git pull --ff-only || echo -e "${YELLOW}⚠️  Update failed or timed out, using existing version...${NC}"

echo -e "${YELLOW}   Applying configuration patches for /radon-g3mes path...${NC}"

# Always reset files to ensure clean patching
git checkout vite.config.ts src/main.tsx 'src/routes/game/$gameid.tsx' src/components/GameCard.tsx 2>/dev/null || true

# Patch vite.config.ts - add base path
sed -i '/export default defineConfig({/a\  base: "/radon-g3mes/",' vite.config.ts || true
echo "  ✓ vite.config.ts patched (base: '/radon-g3mes/')"

# Patch src/main.tsx - add basepath to router
sed -i 's/const router = createRouter({ routeTree, defaultPreload: "viewport" });/const router = createRouter({ routeTree, defaultPreload: "viewport", basepath: "\/radon-g3mes" });/' src/main.tsx || true
echo "  ✓ src/main.tsx patched (basepath: '/radon-g3mes')"

# Patch CDN paths used in game pages and cards
sed -i 's|src={`/cdn/|src={`/radon-g3mes/cdn/|g' 'src/routes/game/$gameid.tsx' || true
echo "  ✓ src/routes/game/$gameid.tsx patched (CDN paths)"

sed -i 's|src={`/cdn/|src={`/radon-g3mes/cdn/|g' 'src/components/GameCard.tsx' || true
echo "  ✓ src/components/GameCard.tsx patched (CDN paths)"

# Add missing search.tsx route (bug in upstream Radon Games)
echo "🔍 Installing missing search.tsx route..."
cp "${REPO_DIR}/radon-search.tsx" src/routes/search.tsx
echo "  ✓ src/routes/search.tsx installed"

echo -e "${YELLOW}   Installing Radon dependencies (3-5 minutes)...${NC}"
timeout 600 bash -c "NODE_OPTIONS='--max-old-space-size=1024' pnpm install --no-frozen-lockfile --network-concurrency=1" || {
    echo -e "${RED}❌ Radon dependency installation failed or timed out${NC}"
    exit 1
}
echo -e "${GREEN}   ✅ Dependencies installed${NC}"

echo -e "${YELLOW}   Building Radon Games (2-3 minutes)...${NC}"
timeout 600 bash -c "NODE_OPTIONS='--max-old-space-size=1024' pnpm run build" || {
    echo -e "${RED}❌ Radon build failed or timed out${NC}"
    exit 1
}
echo -e "${GREEN}   ✅ Radon Games built successfully${NC}"
cd ..

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
sudo nginx -t

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Nginx configuration failed${NC}"
    exit 1
fi

sudo systemctl restart nginx

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
echo -e "${GREEN}🚀 Starting application...${NC}"
pm2 delete games-hub 2>/dev/null || true
pm2 start server.js --name "games-hub" --time --watch false --max-memory-restart 500M
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

##############################################
# Step 10/10: SSL certificate
##############################################
echo -e "${GREEN}🔐 Setting up SSL certificate...${NC}"
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect

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
echo -e "   • https://$DOMAIN/radon-g3mes - Radon Games (200+ games)"
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
