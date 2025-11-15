#!/bin/bash

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

# Update system
echo -e "${GREEN}📦 Step 1/8: Updating system...${NC}"
sudo apt update && sudo apt upgrade -y

# Install Node.js if not installed
if ! command -v node &> /dev/null; then
    echo -e "${GREEN}📦 Step 2/8: Installing Node.js...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo -e "${GREEN}✅ Step 2/8: Node.js already installed${NC}"
fi

# Install Nginx
echo -e "${GREEN}📦 Step 3/8: Installing Nginx...${NC}"
sudo apt install -y nginx

# Install Certbot
echo -e "${GREEN}📦 Step 4/8: Installing Certbot...${NC}"
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

# Install PM2
echo -e "${GREEN}📦 Step 5/8: Installing PM2...${NC}"
sudo npm install -g pm2

# Clone DuckMath
echo -e "${GREEN}📦 Step 5.5/8: Cloning DuckMath games...${NC}"
cd ..
if [ ! -d "duckmath" ]; then
    git clone https://github.com/duckmath/duckmath.github.io.git duckmath
else
    cd duckmath && git pull && cd ..
fi

# Clone and build Radon Games
echo -e "${GREEN}⚡ Step 5.6/8: Cloning and building Radon Games...${NC}"
if [ ! -d "radon-games" ]; then
    # Install pnpm if not already installed
    if ! command -v pnpm &> /dev/null; then
        echo -e "${YELLOW}   Installing pnpm...${NC}"
        sudo npm install -g pnpm
    fi
    echo -e "${YELLOW}   Cloning Radon Games repository...${NC}"
    git clone https://github.com/Radon-Games/Radon-Games.git radon-games
    cd radon-games
    echo -e "${YELLOW}   Installing dependencies (this may take a few minutes)...${NC}"
    pnpm install
    echo -e "${YELLOW}   Building Radon Games...${NC}"
    pnpm run build
    cd ..
else
    echo -e "${YELLOW}   Updating existing Radon Games...${NC}"
    cd radon-games
    git pull
    if ! command -v pnpm &> /dev/null; then
        sudo npm install -g pnpm
    fi
    pnpm install
    pnpm run build
    cd ..
fi

cd $(basename "$PWD")

# Install project dependencies
echo -e "${GREEN}📦 Step 6/8: Installing project dependencies...${NC}"
npm install

# Create .env file
echo -e "${GREEN}📝 Step 7/8: Creating environment file...${NC}"
cat > .env << EOL
PORT=3000
NODE_ENV=production
EOL

# Create Nginx configuration
echo -e "${GREEN}⚙️  Step 8/8: Configuring Nginx...${NC}"
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

# Restart Nginx
sudo systemctl restart nginx

# Configure firewall
echo -e "${GREEN}🔒 Configuring firewall...${NC}"
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
echo "y" | sudo ufw enable

# Start application with PM2
echo -e "${GREEN}🚀 Starting application...${NC}"
pm2 delete games-hub 2>/dev/null || true
pm2 start server.js --name "games-hub"
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

# Get SSL certificate
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
