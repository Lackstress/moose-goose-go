#!/bin/bash

# One-command deployment with Docker Compose
# This is the FASTEST method

echo "🚀 Games Hub - Ultra-Fast Docker Deployment"
echo "=============================================="

read -p "Enter your domain (e.g., mygames.com): " DOMAIN
read -p "Enter your email: " EMAIL

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "❌ Domain and email are required"
    exit 1
fi

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

# Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Create .env for Docker
cat > .env << EOL
DOMAIN=$DOMAIN
EMAIL=$EMAIL
NODE_ENV=production
EOL

# Start everything
echo "🚀 Starting containers..."
docker-compose up -d

# Wait for services to start
sleep 5

# Get SSL certificate
echo "🔐 Getting SSL certificate..."
docker-compose exec -T certbot certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect

echo ""
echo "✅ DONE! Your site is live at https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "  docker-compose logs -f          # View logs"
echo "  docker-compose restart          # Restart all"
echo "  docker-compose down             # Stop all"
echo "  docker-compose up -d --build    # Rebuild and restart"
