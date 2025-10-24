#!/bin/bash
# Setup Swap Space for Low-Memory VMs
# Run this BEFORE quick-deploy.sh if you have less than 2GB RAM

set -e

echo "🔧 Setting up swap space for Radon Games installation..."
echo ""

# Check if swap already exists
if swapon --show | grep -q '/swapfile'; then
    echo "✅ Swap already exists:"
    free -h
    echo ""
    echo "You can now run ./quick-deploy.sh"
    exit 0
fi

# Create 2GB swap file
echo "📦 Creating 2GB swap file..."
sudo fallocate -l 2G /swapfile

# Set permissions
echo "🔒 Setting permissions..."
sudo chmod 600 /swapfile

# Make swap
echo "⚙️  Formatting swap space..."
sudo mkswap /swapfile

# Enable swap
echo "✅ Enabling swap..."
sudo swapon /swapfile

# Make swap permanent
echo "💾 Making swap permanent..."
if ! grep -q '/swapfile' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

# Show memory status
echo ""
echo "================================"
echo "✅ Swap Setup Complete!"
echo "================================"
echo ""
free -h
echo ""
echo "🎮 Now run: ./quick-deploy.sh"
