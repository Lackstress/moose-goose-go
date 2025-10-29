#!/bin/bash

# Gaming Hub Platform - Complete Installation Script
# This script installs all dependencies and sets up the gaming platform

set -e  # Exit on any error

echo "=================================="
echo "🎮 Gaming Hub Platform Setup"
echo "=================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js v14+ from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo "✅ npm version: $(npm -v)"
echo ""

# Install main dependencies
echo "📦 Installing main dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ npm install failed!"
    exit 1
fi

echo "✅ Main dependencies installed"
echo ""

# Verify database setup
echo "🗄️  Initializing database..."
if [ ! -f "database/db.js" ]; then
    echo "❌ database/db.js not found!"
    exit 1
fi
echo "✅ Database configuration ready"
echo ""

# Verify all game files exist
echo "🎮 Verifying game files..."

GAMES=(
    "2048.html"
    "blackjack.html"
    "coinflip.html"
    "crossy-road.html"
    "flappy-bird.html"
    "go-fish.html"
    "memory.html"
    "mines.html"
    "plinko.html"
    "poker.html"
    "rocket.html"
    "roulette.html"
    "slots.html"
    "snake.html"
    "tic-tac-toe.html"
    "uno.html"
)

MISSING_GAMES=()

for game in "${GAMES[@]}"; do
    if [ -f "public/games/$game" ]; then
        echo "  ✅ $game"
    else
        echo "  ⚠️  $game (not found)"
        MISSING_GAMES+=("$game")
    fi
done

if [ ${#MISSING_GAMES[@]} -gt 0 ]; then
    echo ""
    echo "⚠️  Note: Some games are missing (${#MISSING_GAMES[@]}/16)"
fi

echo ""

# Verify core files
echo "📋 Verifying core files..."
CORE_FILES=(
    "server.js"
    "multiplayer-manager.js"
    "public/index.html"
    "public/landing.html"
    "public/styles.css"
    "public/js/main.js"
    "routes/auth.js"
)

for file in "${CORE_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file (missing!)"
        exit 1
    fi
done

echo ""
echo "=================================="
echo "✅ Installation Complete!"
echo "=================================="
echo ""
echo "📝 Next Steps:"
echo "  1. Start the server: npm start"
echo "  2. Open http://localhost:3000 in your browser"
echo "  3. Create an account or login as guest"
echo ""
echo "🌐 For domain setup, see README.md"
echo ""
