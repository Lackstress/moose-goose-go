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
sudo apt update
sudo DEBIAN_FRONTEND=noninteractive apt install -y nginx certbot python3-certbot-nginx curl git -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" || echo "⚠️  Some packages failed to install, continuing..."

# Install yt-dlp for media player
echo "📦 Installing yt-dlp for media player..."
if ! command -v yt-dlp &> /dev/null; then
    sudo apt install -y yt-dlp || sudo pip3 install yt-dlp || {
        echo "📥 Installing via direct download..."
        sudo curl -fsSL --connect-timeout 30 --max-time 60 https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
        sudo chmod a+rx /usr/local/bin/yt-dlp
    }
    echo "✅ yt-dlp installed"
else
    echo "✅ yt-dlp already installed"
fi

# Install Node.js 20.x (required for React 19)
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 18 ]; then
    echo "📦 Installing Node.js 20.x..."
    curl -fsSL --connect-timeout 30 --max-time 120 https://deb.nodesource.com/setup_20.x | sudo -E bash -
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
echo "🔄 Resetting and pulling latest changes..."
git reset --hard HEAD || true
timeout 120 git pull --ff-only || timeout 120 git pull --rebase || echo "⚠️  Git pull failed or timed out, using existing version..."

# Restore games.db after pull
if [ -f "database/games.db.backup" ]; then
    mv database/games.db.backup database/games.db
    echo "✅ Database restored"
fi

# DuckMath setup skipped - original repository no longer exists
# DuckMath will be served from existing installation on VM
echo "📦 DuckMath: Using existing installation (original repo unavailable)"

# Clone Lunaar
echo "🌙 Setting up Lunaar gaming hub..."
if [ ! -d "lunaar.org-main" ]; then
    echo "📥 Cloning Lunaar..."
    timeout 300 git clone --depth 1 https://github.com/parcoil/lunaar.org.git lunaar.org-main || echo "⚠️  Lunaar clone failed or timed out, continuing without Lunaar..."
else
    echo "🔄 Updating Lunaar..."
    (cd lunaar.org-main && timeout 120 git pull --ff-only 2>&1 </dev/null) || echo "⚠️  Lunaar update failed, using existing version..."
fi
if [ -d "lunaar.org-main" ]; then
    echo "✅ Lunaar ready"
fi

# Clone Seraph
echo "📦 Setting up Seraph gaming hub..."
if [ ! -d "seraph" ]; then
    echo "📥 Cloning Seraph (5.68 GiB - may take 5-10 minutes)..."
    timeout 900 git clone --depth 1 --progress https://github.com/Lackstress/seraph.git seraph || echo "⚠️  Seraph clone failed or timed out, continuing without Seraph..."
else
    echo "🔄 Updating Seraph..."
    (cd seraph && timeout 300 git pull --ff-only 2>&1 </dev/null) || echo "⚠️  Seraph update failed, using existing version..."
fi
if [ -d "seraph" ]; then
    echo "✅ Seraph ready"
fi

# Return to repo directory
cd "$REPO_DIR"

# Safeguard: never modify existing SQLite database (games.db)
if [ -f "database/games.db" ]; then
    echo "🛡  Preserving existing database: database/games.db"
fi

# Install dependencies for main Game Hub (includes secret media-player deps)
echo "📦 Installing Game Hub dependencies..."
timeout 300 npm install || {
    echo "❌ npm install failed or timed out"
    exit 1
}
sudo npm install -g pm2

# Stop existing process if running
echo "🛑 Stopping existing PM2 process (if any)..."
pm2 delete games-hub 2>/dev/null || true

# Start with PM2 and auto-restart on crash
echo "🚀 Starting Node.js server with PM2..."
pm2 start server.js --name games-hub --time --watch false --max-memory-restart 500M

# Verify PM2 started successfully
if ! pm2 list | grep -q "games-hub.*online"; then
    echo "❌ Failed to start server with PM2"
    echo "Check logs with: pm2 logs games-hub"
    exit 1
fi

# Save PM2 process list
pm2 save --force

# Setup PM2 to start on system boot
echo "🔧 Configuring PM2 to start on boot..."
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
pm2 save --force

echo "✅ PM2 configured to auto-start on boot and restart on crashes"

# Wait for server to be ready
echo "⏳ Waiting for server to start..."
sleep 3

# Configure Nginx
echo "⚙️  Configuring Nginx..."
sudo tee /etc/nginx/sites-available/$DOMAIN > /dev/null << EOF
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
EOF

sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

echo "🧪 Testing Nginx configuration..."
if ! sudo nginx -t; then
    echo "❌ Nginx configuration test failed!"
    exit 1
fi

echo "🔄 Restarting Nginx..."
sudo systemctl restart nginx
sudo systemctl enable nginx
echo "✅ Nginx configured and enabled"

# Verify server is responding
echo "🔍 Verifying server is running..."
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "⚠️  Warning: Server may not be responding on port 3000"
    echo "   Check with: pm2 logs games-hub"
fi

# Get SSL
echo "🔐 Setting up SSL certificate..."
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect

if [ $? -ne 0 ]; then
    echo "⚠️  SSL certificate setup failed. You can try again later with:"
    echo "   sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
else
    echo "✅ SSL certificate installed successfully"
fi

# Firewall
echo "🔒 Configuring firewall..."
sudo ufw allow 'Nginx Full' && sudo ufw allow OpenSSH && yes | sudo ufw enable

echo ""
echo "================================================================"
echo "✅ Deployment Complete!"
echo "================================================================"
echo ""
echo "🌐 Your site should be live at: https://$DOMAIN"
echo ""
echo "📍 Available Routes:"
echo "  • https://$DOMAIN/ - Landing page (hub selector)"
echo "  • https://$DOMAIN/ghub - Custom GameHub"
echo "  • https://$DOMAIN/duckmath - DuckMath educational games"
if [ -d "../lunaar.org-main" ]; then
    echo "  • https://$DOMAIN/lunaar - Lunaar (350+ games + proxy)"
fi
if [ -d "../seraph" ]; then
    echo "  • https://$DOMAIN/seraph - Seraph (350+ games)"
fi
echo ""
echo "⚙️  SERVER MANAGEMENT COMMANDS:"
echo ""
echo "Start/Stop/Restart:"
echo "  pm2 start games-hub          # Start the server"
echo "  pm2 stop games-hub           # Stop the server"
echo "  pm2 restart games-hub        # Restart the server"
echo "  pm2 reload games-hub         # Reload with zero-downtime"
echo "  pm2 delete games-hub         # Remove from PM2"
echo ""
echo "Monitoring:"
echo "  pm2 status                   # View all PM2 processes"
echo "  pm2 logs games-hub           # View live logs (Ctrl+C to exit)"
echo "  pm2 logs games-hub --lines 50  # View last 50 log lines"
echo "  pm2 logs games-hub --err     # View only error logs"
echo "  pm2 monit                    # Interactive monitoring dashboard"
echo ""
echo "Nginx Commands:"
echo "  sudo systemctl status nginx  # Check Nginx status"
echo "  sudo systemctl restart nginx # Restart Nginx"
echo "  sudo nginx -t                # Test Nginx configuration"
echo "  sudo systemctl reload nginx  # Reload config without downtime"
echo ""
echo "SSL Certificate:"
echo "  sudo certbot renew --dry-run # Test certificate renewal"
echo "  sudo certbot certificates    # List all certificates"
echo "  sudo certbot renew           # Manually renew certificates"
echo ""
echo "🔧 TROUBLESHOOTING:"
echo ""
echo "If site isn't accessible:"
echo "  1. Check server is running:  pm2 status"
echo "  2. Check logs for errors:    pm2 logs games-hub --err"
echo "  3. Check Nginx status:       sudo systemctl status nginx"
echo "  4. Check firewall:           sudo ufw status"
echo "  5. Verify DNS propagation:   nslookup $DOMAIN"
echo ""
echo "DNS Configuration (if not done):"
echo "  Go to Namecheap → Advanced DNS and add:"
echo "  • A Record: @   → $(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP')"
echo "  • A Record: www → $(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP')"
echo ""
echo "  ⚠️  DNS propagation can take 5-30 minutes after adding records"
echo "  ⚠️  Check propagation: https://dnschecker.org/#A/$DOMAIN"
echo ""
echo "Quick Deployment Updates:"
echo "  cd $REPO_DIR                 # Navigate to repo"
echo "  git pull                     # Pull latest changes"
echo "  npm install                  # Update dependencies"
echo "  pm2 restart games-hub        # Restart server"
echo ""
echo "🎮 Happy Gaming! If you need help, check PM2 logs first."
echo ""
