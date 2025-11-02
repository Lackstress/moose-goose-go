#!/bin/bash

# Safe Update Script - Preserves Game Data
# Use this to pull updates without losing your game data

echo "🎮 Gaming Hub - Safe Update"
echo "============================"

# Backup game data before update
echo "📦 Backing up game data..."

# Create backup directory
BACKUP_DIR="./backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup database
if [ -f "database/games.db" ]; then
    echo "✅ Backing up database..."
    cp database/games.db "$BACKUP_DIR/games.db"
fi

# Backup any user data files
if [ -d "database" ]; then
    echo "✅ Backing up database directory..."
    cp -r database "$BACKUP_DIR/"
fi

# Backup any custom configurations
if [ -f ".env" ]; then
    echo "✅ Backing up environment file..."
    cp .env "$BACKUP_DIR/"
fi

# Stash any local changes
echo "🔄 Stashing local changes..."
git stash push -m "Auto-stash before update - $(date)"

# Pull latest changes
echo "⬇️ Pulling latest changes..."
git pull origin main

# Restore game data
echo "📂 Restoring game data..."

# Restore database
if [ -f "$BACKUP_DIR/games.db" ]; then
    echo "✅ Restoring database..."
    cp "$BACKUP_DIR/games.db" database/games.db
fi

# Restore database directory
if [ -d "$BACKUP_DIR/database" ]; then
    echo "✅ Restoring database directory..."
    cp -r "$BACKUP_DIR/database/"* database/ 2>/dev/null || true
fi

# Restore environment file
if [ -f "$BACKUP_DIR/.env" ]; then
    echo "✅ Restoring environment file..."
    cp "$BACKUP_DIR/.env" .env
fi

# Update dependencies if needed
echo "📦 Checking for dependency updates..."
if [ -f "package.json" ] && [ "package.json" -nt "node_modules" ]; then
    echo "🔄 Installing new dependencies..."
    npm install
fi

# Update external repositories if they exist
echo "🔄 Checking external repositories..."

# Update Radon Games if it exists
if [ -d "../radon-games" ]; then
    echo "📥 Updating Radon Games..."
    cd ../radon-games
    git pull origin main
    npm install
    npm run build
    cd ../moose-goose-go
fi

# Update DuckMath if it exists
if [ -d "../duckmath" ]; then
    echo "📥 Updating DuckMath..."
    cd ../duckmath
    git pull origin main
    cd ../moose-goose-go
fi

# Clean up backup (keep last 3)
echo "🧹 Cleaning up old backups..."
ls -1t ./backup-* | tail -n +4 | xargs rm -rf 2>/dev/null || true

echo ""
echo "✅ Update completed successfully!"
echo "📁 Backup saved to: $BACKUP_DIR"
echo ""
echo "🚀 Starting server..."
npm start
