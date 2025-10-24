#!/bin/bash
# Ultra-Simple One-Line Installer
# Usage: curl -sSL https://raw.githubusercontent.com/Lackstress/games/main/quick-deploy.sh | bash

set -e

echo "🎮 Games Hub - Quick Deploy"
read -p "Domain: " DOMAIN
read -p "Email: " EMAIL

# Install essentials
echo "📦 Installing system dependencies..."
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx curl

# Install Node.js 20.x (required for React 19)
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 18 ]; then
    echo "📦 Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "✅ Node.js already installed: $(node -v)"
fi

# Clone or update repo
if [ ! -d "games" ]; then
    git clone https://github.com/Lackstress/games.git && cd games
else
    cd games && git pull
fi

# Clone DuckMath in parent directory
echo "📦 Cloning DuckMath games..."
cd ..
if [ ! -d "duckmath" ]; then
    git clone https://github.com/duckmath/duckmath.github.io.git duckmath
else
    cd duckmath && git pull && cd ..
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

echo "� Applying configuration patches for /radon-g3mes path..."

# Patch vite.config.ts - add base path
if ! grep -q 'base: "/radon-g3mes/"' vite.config.ts; then
    sed -i '/export default defineConfig({/a\  base: "/radon-g3mes/",' vite.config.ts
    echo "  ✓ vite.config.ts patched"
fi

# Patch src/main.tsx - add basepath to router
if ! grep -q 'basepath: "/radon-g3mes"' src/main.tsx; then
    sed -i 's/const router = createRouter({ routeTree, defaultPreload: "viewport" });/const router = createRouter({ routeTree, defaultPreload: "viewport", basepath: "\/radon-g3mes" });/g' src/main.tsx
    echo "  ✓ src/main.tsx patched"
fi

# Patch src/routes/game/$gameid.tsx - change CDN path for game iframes
sed -i 's|src={`/cdn/|src={`/radon-g3mes/cdn/|g' 'src/routes/game/$gameid.tsx'
echo "  ✓ src/routes/game/\$gameid.tsx patched"

# Patch src/components/GameCard.tsx - change CDN path for images
sed -i 's|src={`/cdn/|src={`/radon-g3mes/cdn/|g' src/components/GameCard.tsx
echo "  ✓ src/components/GameCard.tsx patched"

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

cd games

# Install and start
npm install
sudo npm install -g pm2
pm2 delete games-hub 2>/dev/null || true
pm2 start server.js --name games-hub
pm2 save
pm2 startup | tail -n 1 | bash

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
