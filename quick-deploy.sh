#!/bin/bash
# Ultra-Simple One-Line Installer
# Usage: curl -sSL https://raw.githubusercontent.com/Lackstress/games/main/quick-deploy.sh | bash

set -e

echo "🎮 Games Hub - Quick Deploy"
read -p "Domain: " DOMAIN
read -p "Email: " EMAIL

# Install essentials
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx nodejs npm

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

echo "✅ Live at https://$DOMAIN"
