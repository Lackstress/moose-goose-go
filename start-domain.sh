#!/bin/bash
# Simple Domain Starter - Only configures YOUR domain
# Does NOT touch duckmath, seraph, radon, or any git repos

set -euo pipefail

echo "🌐 Domain Starter - Quick Setup"
echo "================================"
echo ""
echo "This script ONLY:"
echo "  ✅ Configures Nginx for your domain"
echo "  ✅ Sets up SSL certificate"
echo "  ✅ Starts/restarts the server"
echo ""
echo "This script does NOT:"
echo "  ❌ Clone or update any git repos"
echo "  ❌ Touch duckmath, seraph, or radon"
echo "  ❌ Ask for GitHub credentials"
echo ""

read -p "Enter your NEW domain name (e.g., mygames.com): " DOMAIN
read -p "Enter your email for SSL certificate: " EMAIL

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "❌ Domain and email are required"
    exit 1
fi

echo ""
echo "📋 Configuration:"
echo "   Domain: $DOMAIN"
echo "   Email: $EMAIL"
read -p "Continue? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Get current directory
REPO_DIR="$(pwd)"

# Check we're in the right directory
if [ ! -f "server.js" ]; then
    echo "❌ Error: Must run from moose-goose-go directory (server.js not found)"
    exit 1
fi

##############################################
# Step 1: Install/update dependencies (local only)
##############################################
echo ""
echo "📦 Step 1/5: Installing local dependencies..."
npm install --prefer-offline || npm install
echo "✅ Dependencies ready"

##############################################
# Step 2: Start/restart PM2
##############################################
echo ""
echo "🚀 Step 2/5: Starting server with PM2..."

# Install PM2 if needed
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

# Stop existing if running
pm2 delete games-hub 2>/dev/null || true

# Start fresh
pm2 start server.js --name games-hub --time --watch false --max-memory-restart 500M

# Verify
if ! pm2 list | grep -q "games-hub.*online"; then
    echo "❌ Failed to start server"
    echo "Check logs: pm2 logs games-hub"
    exit 1
fi

pm2 save --force
echo "✅ Server running"

##############################################
# Step 3: Configure Nginx for new domain
##############################################
echo ""
echo "⚙️  Step 3/5: Configuring Nginx for $DOMAIN..."

# Remove old site configs (optional - keeps things clean)
# sudo rm -f /etc/nginx/sites-enabled/*

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

# Test config
if ! sudo nginx -t; then
    echo "❌ Nginx config error"
    exit 1
fi

sudo systemctl restart nginx
sudo systemctl enable nginx
echo "✅ Nginx configured for $DOMAIN"

##############################################
# Step 4: Get SSL certificate
##############################################
echo ""
echo "🔐 Step 4/5: Setting up SSL for $DOMAIN..."

# Wait for server
sleep 2

sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect || {
    echo ""
    echo "⚠️  SSL setup failed. Try manually later:"
    echo "   sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
}

##############################################
# Step 5: Configure auto-start
##############################################
echo ""
echo "🔧 Step 5/5: Configuring auto-start..."
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME 2>/dev/null || true
pm2 save --force
echo "✅ Auto-start configured"

##############################################
# Done!
##############################################
echo ""
echo "================================================================"
echo "✅ Domain Setup Complete!"
echo "================================================================"
echo ""
echo "🌐 Your site: https://$DOMAIN"
echo ""
echo "📍 Routes available:"
echo "   • https://$DOMAIN/ - Landing page"
echo "   • https://$DOMAIN/ghub - GameHub"
echo "   • https://$DOMAIN/duckmath - DuckMath (if exists)"
echo "   • https://$DOMAIN/radon-g3mes - Radon (if exists)"
echo "   • https://$DOMAIN/seraph - Seraph (if exists)"
echo ""
echo "⚙️  Quick commands:"
echo "   pm2 status              # Check status"
echo "   pm2 logs games-hub      # View logs"
echo "   pm2 restart games-hub   # Restart"
echo ""
echo "🔧 If domain not working, check DNS:"
echo "   Add A record: @ → YOUR_SERVER_IP"
echo "   Add A record: www → YOUR_SERVER_IP"
echo ""
