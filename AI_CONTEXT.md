# 🤖 AI Context Guide - Gaming Hub Platform

> **Last Updated:** October 27, 2025  
> **Commit:** c26334a  
> **Purpose:** This document provides comprehensive context for AI assistants working on this codebase.

---

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture & Tech Stack](#architecture--tech-stack)
3. [Directory Structure](#directory-structure)
4. [Core Systems](#core-systems)
5. [Routing & URL Structure](#routing--url-structure)
6. [Database Schema](#database-schema)
7. [Key Files Reference](#key-files-reference)
8. [Integration Points](#integration-points)
9. [Development Workflow](#development-workflow)
10. [Common Tasks](#common-tasks)

---

## 🎯 Project Overview

**Name:** Gaming Hub Platform  
**Type:** Full-stack multiplayer gaming website  
**Primary Purpose:** Host multiple game collections with user accounts, coin system, and real-time multiplayer

### Key Features
- ✅ **14 Built-in Games** (Casino, Classic, Multiplayer)
- ✅ **4 Game Platforms** (GameHub + DuckMath + Radon + Seraph)
- ✅ **User Authentication** (Register/Login/Guest)
- ✅ **Virtual Coin System** (1000 starting balance)
- ✅ **Real-time Multiplayer** (WebSocket-based)
- ✅ **Database Persistence** (SQLite)
- ✅ **Advanced Matchmaking** (Room system, spectator mode)

### User Flow
```
Landing Page (/) 
  ↓
Choose Platform: 
  → GameHub (/ghub) - 14 custom games
  → DuckMath (/duckmath) - Educational games
  → Radon Games (/radon-g3mes) - React-based portal
  → Seraph Games (/seraph) - Advanced game platform
  ↓
Play Games → Track Coins → Multiplayer Matches → Compete
```

---

## 🏗️ Architecture & Tech Stack

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js (v4.18.2)
- **WebSocket:** Socket.io (v4.5.4)
- **Database:** SQLite3 (v5.1.6)
- **Auth:** bcryptjs (password hashing)
- **Middleware:** cors, compression, dotenv

### Frontend
- **Vanilla JavaScript** (no framework)
- **CSS3** (custom styling, animations)
- **HTML5 Canvas** (game rendering)
- **Socket.io Client** (multiplayer)

### Deployment
- **Docker** support (Dockerfile, docker-compose.yml)
- **Shell Scripts:** quick-deploy.sh, deploy.sh, setup-swap.sh
- **Nginx:** Reverse proxy configuration (nginx.conf)
- **Port:** 3000 (default, configurable via PORT env)

---

## 📁 Directory Structure

```
/workspaces/games/
│
├── server.js                    # Main Express server with all routes
├── multiplayer-manager.js       # WebSocket room/matchmaking logic
├── package.json                 # Dependencies
│
├── database/
│   ├── db.js                   # SQLite initialization & schema
│   ├── games.db                # User data (auto-created)
│   └── gamedata.db             # Game state (auto-created)
│
├── routes/
│   └── auth.js                 # Auth API endpoints (/api/auth/*)
│
├── public/                     # Static frontend files
│   ├── landing.html           # Root landing page (/)
│   ├── index.html             # GameHub main page (/ghub)
│   ├── 404.html               # Custom 404 page
│   ├── styles.css             # Global styles
│   ├── script.js              # Global scripts
│   │
│   ├── js/
│   │   └── main.js            # Auth, coin system, shared utilities
│   │
│   └── games/                 # 14 Individual game HTML files
│       ├── snake.html         # Classic snake game
│       ├── memory.html        # Memory match game
│       ├── tic-tac-toe.html   # Multiplayer tic-tac-toe
│       ├── blackjack.html     # Casino blackjack with betting
│       ├── plinko.html        # Plinko dropping game
│       ├── coinflip.html      # Coin flip gambling
│       ├── roulette.html      # Roulette wheel
│       ├── crossy-road.html   # Crossy road clone
│       ├── flappy-bird.html   # Flappy bird game
│       ├── 2048.html          # 2048 puzzle game
│       ├── go-fish.html       # Multiplayer go fish
│       ├── uno.html           # Multiplayer UNO
│       ├── poker.html         # Poker card game
│       └── mines.html         # Mines clearing game
│
├── deploy-docker.sh           # Docker deployment script
├── deploy.sh                  # Direct deployment script
├── quick-deploy.sh            # Fast deploy (PM2, no Docker)
├── setup-swap.sh              # Memory swap configuration
├── Dockerfile                 # Docker container definition
├── docker-compose.yml         # Multi-container orchestration
├── nginx.conf                 # Nginx reverse proxy config
│
└── README.md                  # Project documentation
```

---

## 🔧 Core Systems

### 1. Authentication System (`/routes/auth.js` + `/public/js/main.js`)

#### Endpoints
```javascript
POST /api/auth/register
Body: { username, password }
Returns: { success, userId, username, coins: 1000 }

POST /api/auth/login
Body: { username, password }
Returns: { success, userId, username, coins }

POST /api/auth/guest
Returns: { success, userId: "guest-{uuid}", username: "Guest", coins: 1000 }

POST /api/auth/update-coins
Body: { userId, amount, gameId, type }
Returns: { success, newBalance }

POST /api/auth/reset-coins
Body: { userId }
Returns: { success, newBalance: 1000 }
```

#### Session Storage
```javascript
// Client-side (localStorage)
currentUser = {
  userId: "uuid",
  username: "PlayerName",
  coins: 1000,
  isGuest: false
}
```

### 2. Coin System

**Flow:**
1. User places bet → `updateCoins(-betAmount, gameId, "bet")`
2. Game ends → Calculate result
3. Win: `updateCoins(+winAmount, gameId, "win")`
4. Loss: No action (already deducted)

**Example:**
```javascript
// Place 100 coin bet
await updateCoins(-100, 'blackjack', 'bet');

// Win (2x multiplier)
await updateCoins(200, 'blackjack', 'win');
// Net: -100 + 200 = +100 profit
```

### 3. Multiplayer System (`multiplayer-manager.js` + Socket.io)

#### Legacy Lobby System (Simple)
```javascript
// Join lobby
socket.emit('join-lobby', { gameId, userId, username });

// Wait for match
socket.on('lobby-update', ({ players, count }) => {});

// Game starts when 2 players join
socket.on('match-start', ({ matchId, player1, player2 }) => {});

// Make moves
socket.emit('game-move', { matchId, move, playerId });
socket.on('move-received', ({ matchId, move, playerId }) => {});

// End game
socket.emit('game-end', { matchId, winner, score });
socket.on('game-finished', ({ winner, score }) => {});
```

#### Enhanced Room System (Advanced)
```javascript
// Matchmaking
socket.emit('find-match', { gameType, playerData });
socket.on('match-found', (room) => {});

// Private rooms
socket.emit('create-room', { gameType, playerData, settings });
socket.emit('join-room', { roomId, playerData });
socket.on('room-joined', (room) => {});

// Gameplay
socket.emit('make-move', { move });
socket.on('game-update', (gameState) => {});

// Chat
socket.emit('chat-send', { message });
socket.on('chat-received', ({ username, message }) => {});

// Spectating
socket.emit('spectate-room', { roomId });
```

### 4. Database Schema

#### Users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,           -- UUID
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,        -- bcrypt hash
  pin TEXT,                      -- Optional recovery PIN
  coins INTEGER DEFAULT 1000,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  total_games_played INTEGER DEFAULT 0,
  total_winnings INTEGER DEFAULT 0
);
```

#### Transactions Table
```sql
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  game_id TEXT NOT NULL,        -- e.g., 'blackjack', 'plinko'
  amount INTEGER NOT NULL,       -- Positive or negative
  type TEXT NOT NULL,            -- 'bet', 'win', 'loss', 'refund'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 🌐 Routing & URL Structure

### Main Routes (server.js)

| URL | Handler | Purpose |
|-----|---------|---------|
| `/` | `landing.html` | **Landing page** - Choose platform |
| `/ghub` | `index.html` | **GameHub** - 14 custom games |
| `/games/:gameId` | `games/{gameId}.html` | Individual game pages |
| `/duckmath` | Dynamic HTML rewrite | **DuckMath platform** |
| `/duckmath/*` | Static + path rewriting | DuckMath assets |
| `/radon-g3mes` | Dynamic HTML rewrite | **Radon Games platform** |
| `/radon-g3mes/*` | Static + CDN proxy | Radon Games assets |
| `/seraph` | Dynamic HTML rewrite | **Seraph Games platform** |
| `/seraph/*` | Static serving | Seraph Games assets |
| `/~/sj/*` | Bare server proxy | **Proxy for Radon** web unblocker |

### Special Behaviors

#### 1. `/games` Route - Intentional Block
**Why:** The `/games` path is blocked by school/corporate filters.  
**Solution:** Returns pretty 404 with redirect to landing page.

#### 2. DuckMath Path Rewriting
**Problem:** DuckMath expects to run at root (`/`)  
**Solution:** Dynamically rewrite all asset paths to include `/duckmath/` prefix
```javascript
html = html.replaceAll('href="/assets/', 'href="/duckmath/assets/');
html = html.replaceAll('src="/assets/', 'src="/duckmath/assets/');
```

#### 3. Radon Games Interceptor
**Problem:** React Router needs base path awareness  
**Solution:** Inject JavaScript to intercept clicks, forms, fetch, XHR
```javascript
// Prefix all root-relative URLs with /radon-g3mes
if (href.startsWith('/') && !href.startsWith('/radon-g3mes')) {
  href = '/radon-g3mes' + href;
}
```

#### 4. Bare Server Proxy (`/~/sj/*`)
**Purpose:** CORS proxy for Radon Games to bypass website restrictions  
**Format:** `/~/sj/https://example.com/resource`  
**Features:** Strips security headers, allows iframe embedding

#### 5. Seraph Games Integration
**Purpose:** Advanced game platform providing additional games
**Status:** Integrated in latest commit  
**Route:** `/seraph` and `/seraph/*`  
**Features:** Static serving with path handling

---

## 🎮 Key Files Reference

### 1. server.js (Main Server)
**Lines of Code:** ~800  
**Key Sections:**
- Lines 1-25: Imports & initialization
- Lines 27-120: Bare server proxy handler
- Lines 122-150: Landing page & GameHub routes
- Lines 152-195: /games intentional block
- Lines 197-350: DuckMath integration & path rewriting
- Lines 352-500: Radon Games integration & interceptor
- Lines 502-600: Multiplayer Socket.io handlers (legacy)
- Lines 602-750: Enhanced multiplayer handlers
- Lines 752-800: Static files & 404 handler

### 2. multiplayer-manager.js (Multiplayer Logic)
**Lines of Code:** ~450  
**Key Classes/Methods:**
```javascript
class MultiplayerManager {
  createRoom(gameType, hostSocketId, options)
  addPlayerToRoom(roomId, socketId, playerData)
  removePlayerFromRoom(socketId)
  findMatch(gameType, socketId, playerData)
  handleMove(socketId, moveData)
  startGame(roomId)
  endGame(roomId, results)
  sendChatMessage(socketId, message)
  addSpectator(roomId, socketId)
}
```

### 3. database/db.js (Database Setup)
**Purpose:** Initialize SQLite database with schema  
**Tables:** users, transactions  
**Auto-creates:** On first run if `games.db` doesn't exist

### 4. routes/auth.js (Auth Endpoints)
**Exports:** Express router with 5 endpoints  
**Dependencies:** bcryptjs (password hashing), uuid (user IDs)

### 5. public/js/main.js (Frontend Core)
**Key Functions:**
```javascript
async function register(username, password)
async function login(username, password)
async function loginAsGuest()
async function logout()
async function updateCoins(amount, gameId, type)
async function resetCoins()
function saveUserSession(user)
function getUserSession()
```

### 6. public/landing.html (Landing Page)
**Structure:**
- Header (title, subtitle)
- Platform cards (GameHub, DuckMath, Radon)
- Feature lists for each platform
- Call-to-action buttons

### 7. Individual Game Files
**Location:** `/public/games/[game-name].html`  
**Common Structure:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Game Name</title>
  <style>/* Game-specific styles */</style>
</head>
<body>
  <div id="game-container">
    <!-- Game UI -->
  </div>
  
  <script src="/js/main.js"></script>
  <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
  <script>
    // Game logic
    const user = getUserSession();
    const socket = io();
    
    // Coin betting system
    async function placeBet(amount) {
      await updateCoins(-amount, 'game-id', 'bet');
    }
    
    async function handleWin(amount) {
      await updateCoins(amount, 'game-id', 'win');
    }
  </script>
</body>
</html>
```

---

## 🔗 Integration Points

### External Systems

#### 1. DuckMath
- **Location:** `/duckmath` (sibling to games repo)
- **Type:** Static game collection
- **Integration:** Path rewriting + static file serving
- **Assets:** `/duckmath/assets/`, `/duckmath/g4m3s/`

#### 3. Radon Games
- **Location:** `/radon-games/dist` (sibling to games repo)
- **Type:** React-based game portal
- **Integration:** Asset rewriting + JavaScript interceptor + CDN proxy
- **CDN:** `https://radon.games/cdn/` → `/radon-g3mes/cdn/`

#### 4. Seraph Games
- **Location:** `/seraph` or sibling directory
- **Type:** Advanced game platform
- **Integration:** Static file serving with path handling
- **Status:** Recently integrated (commit a0eaacc)

#### 5. Socket.io CDN
- **URL:** `https://cdn.socket.io/4.5.4/socket.io.min.js`
- **Purpose:** Real-time multiplayer communication
- **Used In:** All multiplayer games

---

## 🛠️ Development Workflow

### Starting the Server

```bash
# Development (auto-reload on file changes)
npm run dev

# Production
npm start

# With custom port
PORT=3001 npm start
```

### Database Management

```bash
# View database
sqlite3 database/games.db

# Check users
SELECT * FROM users;

# Check transactions
SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10;

# Reset database
rm database/games.db
npm start  # Auto-recreates
```

### Adding a New Game

1. **Create HTML file:** `public/games/new-game.html`
2. **Include dependencies:**
   ```html
   <script src="/js/main.js"></script>
   <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
   ```
3. **Use coin system:**
   ```javascript
   const user = getUserSession();
   if (!user) {
     alert('Please login to play!');
     window.location.href = '/ghub';
     return;
   }
   
   // Betting
   await updateCoins(-betAmount, 'new-game', 'bet');
   
   // Winning
   await updateCoins(winAmount, 'new-game', 'win');
   ```
4. **Add to GameHub:** Edit `public/index.html` to add game card
5. **Test:** Visit `/games/new-game`

### Deploying

```bash
# Quick deploy (PM2)
./quick-deploy.sh

# Docker deploy
./deploy-docker.sh

# Manual Docker
docker-compose up -d
```

---

## 📝 Common Tasks

### Task: Fix Asset Loading Issues
**Symptoms:** CSS/JS/images not loading on subpath  
**Solution:** Check base path handling in HTML files
```html
<!-- Bad -->
<link rel="stylesheet" href="/styles.css">

<!-- Good for subpath hosting -->
<link rel="stylesheet" href="/platform-name/styles.css">
```

### Task: Add New Multiplayer Feature
1. Update `multiplayer-manager.js` with new handler
2. Add Socket.io event in `server.js`
3. Implement client-side in game HTML
4. Test with 2 browser tabs

### Task: Debug Coin System
1. Check browser console for errors
2. Verify `currentUser` is set: `console.log(getUserSession())`
3. Check database: `SELECT * FROM transactions WHERE user_id='[userId]'`
4. Ensure `/api/auth/update-coins` returns success

### Task: Add External Game Platform
1. Clone repo to parent directory (sibling to `/games`)
2. Add static route in `server.js`:
   ```javascript
   app.use('/platform-name', express.static(path.join(__dirname, '..', 'platform-name')));
   ```
3. Add path rewriting if needed (see DuckMath/Radon examples)
4. Update `landing.html` with new platform card

### Task: Troubleshoot Multiplayer
1. Check server logs for Socket.io connection
2. Verify client connects: `socket.connected` should be `true`
3. Test event emission: `socket.emit('test', {data: 'hello'})`
4. Check room state: `multiplayerManager.rooms` (server-side)

---

## 🎯 Important Notes for AI Assistants

### When User Asks to:

**"Add a game"**
→ Create HTML file in `/public/games/`, include main.js, implement coin system

**"Fix multiplayer"**
→ Check `multiplayer-manager.js` and Socket.io handlers in `server.js`

**"Deploy the site"**
→ Use `quick-deploy.sh` or `deploy-docker.sh`

**"Reset database"**
→ Delete `database/games.db` and restart server

**"Add external games"**
→ Follow DuckMath/Radon/Seraph integration pattern (path rewriting + static serving)

**"Update landing page"**
→ Edit `public/landing.html`

**"Add authentication"**
→ Already implemented - use `getUserSession()` and check `currentUser`

**"Integrate a new platform"**
→ Add route in `server.js`, update `landing.html`, handle path rewriting if needed

### Critical Paths
- **Never remove** external platform routes (DuckMath, Radon, Seraph)
- **Always prefix** external platforms to avoid path conflicts
- **Test multiplayer** with 2 browser instances
- **Verify coin transactions** update database correctly
- **Check sibling directories** for external platforms before adding routes
- **Update landing.html** when integrating new platforms

---

## 📊 File Priority Matrix

**When debugging, check in this order:**

1. **Frontend Issues:** `public/js/main.js` → game HTML → browser console
2. **Backend Issues:** `server.js` → route handlers → logs
3. **Database Issues:** `database/db.js` → `routes/auth.js` → SQL queries
4. **Multiplayer Issues:** `multiplayer-manager.js` → Socket.io handlers → client socket
5. **Deployment Issues:** `quick-deploy.sh` → `docker-compose.yml` → logs

---

## 🚀 Quick Reference Commands

```bash
# Start server
npm start

# Check database
sqlite3 database/games.db "SELECT * FROM users;"

# View logs (if using PM2)
pm2 logs games-server

# Restart server (PM2)
pm2 restart games-server

# Check port usage
lsof -i :3000

# Kill process on port
kill -9 $(lsof -t -i:3000)

# Deploy
./quick-deploy.sh

# Check Git status
git status
git log --oneline -10
```

---

## ✅ Health Check Checklist

Before considering the system "working":

- [ ] Server starts without errors
- [ ] Landing page loads at `/`
- [ ] GameHub loads at `/ghub`
- [ ] Can register new user
- [ ] Can login existing user
- [ ] Guest mode works
- [ ] At least one game loads
- [ ] Coin system updates database
- [ ] Multiplayer lobby connects (2 tabs)
- [ ] WebSocket events fire correctly
- [ ] Database writes persist after restart
- [ ] 404 page shows for invalid routes
- [ ] `/games` shows intentional block message

---

**End of Context Guide**

*This document should be provided to AI assistants for comprehensive understanding of the Gaming Hub platform architecture, routing, and development patterns.*
