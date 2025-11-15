#!/bin/bash
# Ultra-Simple One-Line Installer
# Usage: bash quick-deploy.sh

set -euo pipefail

echo "🎮 Games Hub - Quick Deploy"

# Check we're in the right directory
if [ ! -f "server.js" ] || [ ! -f "package.json" ]; then
    echo "❌ Error: Must run this script from the repository root directory"
    echo "   (looking for server.js and package.json)"
    exit 1
fi

read -p "Domain: " DOMAIN
read -p "Email: " EMAIL

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "❌ Domain and email are required"
    exit 1
fi

# Get current directory name
REPO_DIR="$(pwd)"

# Install essentials
echo "📦 Installing system dependencies..."
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx curl git

# Install yt-dlp for media player
echo "📦 Installing yt-dlp for media player..."
if ! command -v yt-dlp &> /dev/null; then
    sudo apt install -y yt-dlp || sudo pip3 install yt-dlp || {
        echo "📥 Installing via direct download..."
        sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
        sudo chmod a+rx /usr/local/bin/yt-dlp
    }
    echo "✅ yt-dlp installed"
else
    echo "✅ yt-dlp already installed"
fi

# Install Node.js 20.x (required for React 19)
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 18 ]; then
    echo "📦 Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "✅ Node.js already installed: $(node -v)"
fi

# We're already in the repo directory, just need to pull updates
echo "📦 Updating repository..."

# One-time: Remove games.db from git tracking if it's tracked
if git ls-files --error-unmatch database/games.db &>/dev/null 2>&1; then
    echo "🔧 Removing games.db from git tracking (one-time)..."
    if [ -f "database/games.db" ]; then
        cp database/games.db database/games.db.permanent_backup
    fi
    git rm --cached database/games.db 2>/dev/null || true
    if [ -f "database/games.db.permanent_backup" ]; then
        mv database/games.db.permanent_backup database/games.db
    fi
    echo "✅ Database will no longer conflict with git"
fi

# Preserve games.db before pulling
echo "🛡️  Preserving database before git pull..."
if [ -f "database/games.db" ]; then
    cp database/games.db database/games.db.backup
fi

# Reset any local changes (except database which we backed up)
git reset --hard HEAD || true
git pull --ff-only || git pull --rebase || true

# Restore games.db after pull
if [ -f "database/games.db.backup" ]; then
    mv database/games.db.backup database/games.db
    echo "✅ Database restored"
fi

# Clone DuckMath in parent directory
echo "📦 Cloning DuckMath games..."
cd ..
if [ ! -d "duckmath" ]; then
    git clone https://github.com/duckmath/duckmath.github.io.git duckmath || echo "⚠️  DuckMath clone failed, continuing..."
else
    (cd duckmath && git pull --ff-only) || echo "⚠️  DuckMath update failed, continuing..."
fi

# Install DuckMath dependencies only if it is a Node project
if [ -f "duckmath/package.json" ]; then
    echo "📦 Installing DuckMath dependencies..."
    (cd duckmath && npm install) || echo "⚠️  DuckMath npm install failed, continuing..."
fi

# Clone and build Radon Games
echo "⚡ Cloning and building Radon Games..."

# Install pnpm if not already installed
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    sudo npm install -g pnpm
fi

if [ ! -d "radon-games" ]; then
    echo "📥 Cloning Radon Games repository..."
    git clone https://github.com/Radon-Games/Radon-Games.git radon-games
else
    echo "🔄 Updating Radon Games..."
    cd radon-games
    git reset --hard HEAD
    git pull
    cd ..
fi

cd radon-games

echo "🔧 Applying configuration patches for /radon-g3mes path..."

# Always reset files to ensure clean patching
git checkout vite.config.ts src/main.tsx 'src/routes/game/$gameid.tsx' src/components/GameCard.tsx 2>/dev/null || true

# Patch vite.config.ts - add base path
sed -i '/export default defineConfig({/a\  base: "/radon-g3mes/",' vite.config.ts
echo "  ✓ vite.config.ts patched (base: '/radon-g3mes/')"

# Patch src/main.tsx - add basepath to router
# Original: const router = createRouter({ routeTree, defaultPreload: "viewport" });
# Target:   const router = createRouter({ routeTree, defaultPreload: "viewport", basepath: "/radon-g3mes" });
sed -i 's/const router = createRouter({ routeTree, defaultPreload: "viewport" });/const router = createRouter({ routeTree, defaultPreload: "viewport", basepath: "\/radon-g3mes" });/' src/main.tsx
echo "  ✓ src/main.tsx patched (basepath: '/radon-g3mes')"

# Patch src/routes/game/$gameid.tsx - change CDN path for game iframes
sed -i 's|src={`/cdn/|src={`/radon-g3mes/cdn/|g' 'src/routes/game/$gameid.tsx'
echo "  ✓ src/routes/game/\$gameid.tsx patched (CDN paths)"

# Patch src/components/GameCard.tsx - change CDN path for images
sed -i 's|src={`/cdn/|src={`/radon-g3mes/cdn/|g' src/components/GameCard.tsx
echo "  ✓ src/components/GameCard.tsx patched (CDN paths)"

echo "📦 Installing Radon Games dependencies (this may take a few minutes)..."
# Limit memory usage and network concurrency for low-memory VMs
NODE_OPTIONS="--max-old-space-size=1024" pnpm install --no-frozen-lockfile --network-concurrency=1

echo "🔨 Building Radon Games..."
# Limit memory usage during build
NODE_OPTIONS="--max-old-space-size=1024" pnpm run build

echo "✅ Radon Games built successfully"
cd ..

# Verify Radon Games build
if [ ! -d "radon-games/dist" ]; then
    echo "❌ Error: Radon Games build failed - dist folder not found"
    exit 1
fi
echo "✅ Radon Games dist folder verified"

# Return to repo directory
cd "$REPO_DIR"

# Safeguard: never modify existing SQLite database (games.db)
if [ -f "database/games.db" ]; then
    echo "🛡  Preserving existing database: database/games.db"
fi

# Install dependencies for main Game Hub (includes secret media-player deps)
echo "📦 Installing Game Hub dependencies..."
npm install
sudo npm install -g pm2

# Stop existing process if running
pm2 delete games-hub 2>/dev/null || true

# Start with PM2 and auto-restart on crash
pm2 start server.js --name games-hub --time --watch false --max-memory-restart 500M

# Save PM2 process list
pm2 save --force

# Setup PM2 to start on system boot
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
pm2 save --force

echo "✅ PM2 configured to auto-start on boot and restart on crashes"

# Configure Nginx
sudo tee /etc/nginx/sites-available/$DOMAIN << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# Get SSL
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect

# Firewall
sudo ufw allow 'Nginx Full' && sudo ufw allow OpenSSH && yes | sudo ufw enable

echo ""
echo "================================"
echo "✅ Deployment Complete!"
echo "================================"
echo ""
echo "🌐 Your site is live at: https://$DOMAIN"
echo ""
echo "📍 Available Routes:"
echo "  • https://$DOMAIN/ - Landing page"
echo "  • https://$DOMAIN/ghub - Game Hub"
echo "  • https://$DOMAIN/duckmath - DuckMath games"
echo "  • https://$DOMAIN/radon-g3mes - Radon Games (200+ games)"
echo ""
echo "🔧 Useful Commands:"
echo "  • pm2 status - Check server status"
echo "  • pm2 logs games-hub - View logs"
echo "  • pm2 restart games-hub - Restart server"
echo ""
echo "🎮 Radon Games Features:"
echo "  • 200+ HTML5 and Unity games"
echo "  • Web proxy at /radon-g3mes/proxy"
echo "  • CDN proxy for game files"
echo ""
