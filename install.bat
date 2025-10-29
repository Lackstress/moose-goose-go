@echo off
REM Gaming Hub Platform - Complete Installation Script (Windows)
REM This script installs all dependencies and sets up the gaming platform

setlocal enabledelayedexpansion

echo ==================================
echo 🎮 Gaming Hub Platform Setup
echo ==================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if errorlevel 1 (
    echo ❌ Node.js is not installed!
    echo Please install Node.js v14+ from https://nodejs.org/
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo ✅ Node.js version: %NODE_VERSION%

for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo ✅ npm version: %NPM_VERSION%
echo.

REM Install main dependencies
echo 📦 Installing main dependencies...
call npm install

if errorlevel 1 (
    echo ❌ npm install failed!
    exit /b 1
)

echo ✅ Main dependencies installed
echo.

REM Verify database setup
echo 🗄️ Initializing database...
if not exist "database\db.js" (
    echo ❌ database\db.js not found!
    exit /b 1
)
echo ✅ Database configuration ready
echo.

REM Verify all game files exist
echo 🎮 Verifying game files...

setlocal enabledelayedexpansion
set "MISSING_COUNT=0"

for %%G in (
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
) do (
    if exist "public\games\%%~G" (
        echo   ✅ %%~G
    ) else (
        echo   ⚠️ %%~G (not found)
        set /a MISSING_COUNT+=1
    )
)

if !MISSING_COUNT! gtr 0 (
    echo.
    echo ⚠️ Note: Some games are missing ((!MISSING_COUNT!)/16^)
)

echo.

REM Verify core files
echo 📋 Verifying core files...

for %%F in (
    "server.js"
    "multiplayer-manager.js"
    "public\index.html"
    "public\landing.html"
    "public\styles.css"
    "public\js\main.js"
    "routes\auth.js"
) do (
    if exist "%%F" (
        echo   ✅ %%F
    ) else (
        echo   ❌ %%F (missing!^)
        exit /b 1
    )
)

echo.
echo ==================================
echo ✅ Installation Complete!
echo ==================================
echo.
echo 📝 Next Steps:
echo   1. Start the server: npm start
echo   2. Open http://localhost:3000 in your browser
echo   3. Create an account or login as guest
echo.
echo 🌐 For domain setup, see README.md
echo.

endlocal
