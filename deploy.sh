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
sudo apt update && sudo apt upgrade -y

##############################################
# Step 2/10: Install Node.js 20.x if missing
##############################################
if ! command -v node &> /dev/null; then
    echo -e "${GREEN}📦 Step 2/10: Installing Node.js 20.x...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
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

# Install yt-dlp for media player
echo -e "${GREEN}📦 Step 4.5/8: Installing yt-dlp for media player...${NC}"
if ! command -v yt-dlp &> /dev/null; then
    sudo apt install -y yt-dlp || sudo pip3 install yt-dlp || {
        echo -e "${YELLOW}   Installing via direct download...${NC}"
        sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
        sudo chmod a+rx /usr/local/bin/yt-dlp
    }
else
    echo -e "${GREEN}   ✅ yt-dlp already installed${NC}"
fi

##############################################
# Step 4.5/10: Install yt-dlp (media player)
##############################################
echo -e "${GREEN}📦 Step 4.5/10: Installing yt-dlp for media player...${NC}"
if ! command -v yt-dlp &> /dev/null; then
    sudo apt install -y yt-dlp || sudo pip3 install yt-dlp || {
        echo -e "${YELLOW}   Installing via direct download...${NC}"
        sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
        sudo chmod a+rx /usr/local/bin/yt-dlp
    }
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
    git clone https://github.com/duckmath/duckmath.github.io.git duckmath || true
else
    (cd duckmath && git pull --ff-only || true)
fi

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
    echo -e "${YELLOW}   Cloning Radon Games repository...${NC}"
    git clone https://github.com/Radon-Games/Radon-Games.git radon-games
fi

cd radon-games
echo -e "${YELLOW}   Updating Radon Games...${NC}"
git reset --hard HEAD || true
git pull --ff-only || true

echo -e "${YELLOW}   Applying configuration patches for /radon-g3mes path...${NC}"
# Patch vite.config.ts - add base path if missing
if ! grep -q 'base: "/radon-g3mes/"' vite.config.ts 2>/dev/null; then
    sed -i '/export default defineConfig({/a\  base: "/radon-g3mes/",' vite.config.ts || true
    echo "  ✓ vite.config.ts patched"
fi

# Patch src/main.tsx - add basepath to router
if [ -f src/main.tsx ] && ! grep -q 'basepath: "/radon-g3mes"' src/main.tsx; then
    sed -i 's/const router = createRouter({ routeTree, defaultPreload: "viewport" });/const router = createRouter({ routeTree, defaultPreload: "viewport", basepath: "\/radon-g3mes" });/g' src/main.tsx || true
    echo "  ✓ src/main.tsx patched"
fi

# Patch CDN paths used in game pages and cards
if [ -f 'src/routes/game/$gameid.tsx' ]; then
  sed -i 's|src={`/cdn/|src={`/radon-g3mes/cdn/|g' 'src/routes/game/$gameid.tsx' || true
  echo "  ✓ src/routes/game/$gameid.tsx patched"
fi
if [ -f 'src/components/GameCard.tsx' ]; then
  sed -i 's|src={`/cdn/|src={`/radon-g3mes/cdn/|g' 'src/components/GameCard.tsx' || true
  echo "  ✓ src/components/GameCard.tsx patched"
fi

echo -e "${YELLOW}   Installing Radon dependencies (this may take a few minutes)...${NC}"
NODE_OPTIONS="--max-old-space-size=1024" pnpm install --no-frozen-lockfile --network-concurrency=1

echo -e "${YELLOW}   Building Radon Games...${NC}"
NODE_OPTIONS="--max-old-space-size=1024" pnpm run build
cd ..

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

git pull --ff-only || true

# Restore games.db after pull
if [ -f "database/games.db.backup" ]; then
    mv database/games.db.backup database/games.db
    echo -e "${GREEN}   ✓ Database restored${NC}"
fi

echo -e "${GREEN}📦 Installing project dependencies...${NC}"
npm install

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
echo -e "${GREEN}=================================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "==================================================${NC}"
echo ""
echo -e "${YELLOW}📋 Your site is now live at:${NC}"
echo -e "   🌐 https://$DOMAIN"
echo -e "   🌐 https://www.$DOMAIN"
echo ""
echo -e "${YELLOW}📋 Useful Commands:${NC}"
echo "   View logs:     pm2 logs games-hub"
echo "   Restart app:   pm2 restart games-hub"
echo "   App status:    pm2 status"
echo "   Nginx status:  sudo systemctl status nginx"
echo ""
echo -e "${YELLOW}📋 DNS Configuration (if not done):${NC}"
echo "   Go to Namecheap → Advanced DNS"
echo "   Add A Record: @ → $(curl -s ifconfig.me)"
echo "   Add A Record: www → $(curl -s ifconfig.me)"
echo ""
echo -e "${GREEN}🎮 Happy Gaming!${NC}"
