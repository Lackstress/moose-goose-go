# 🎮 Gaming Hub Platform - Full-Featured Gaming Portal

A complete multiplayer gaming platform with **14+ built-in games**, **3 external game platforms**, **user authentication**, and a **virtual coin system** for betting and progression tracking.

## 🚀 Features

### ✨ Account System
- **Username + Password Registration/Login**
- **Optional PIN Recovery** (for password reset)
- **Guest Mode** (play without saving)
- **Virtual Coin System** (1000 starting coins, resettable)
- **Progress Persistence** (SQLite database)

### 🎮 Game Categories

#### Classic Games
- 🐍 **Snake** - Classic snake game with difficulty levels
- 🕹️ **Memory Match** - Test your memory with pairs
- 🐦 **Flappy Bird** - Dodge pipes and rack up points
- 🎮 **2048** - Merge tiles to reach 2048

#### Multiplayer Card Games
- 🎯 **Tic Tac Toe** - Online multiplayer vs real players
- 🎴 **Go Fish** - Multiplayer card collection game
- 🃏 **UNO** - Play UNO with other players
- 🎰 **Poker** - 5-card poker multiplayer

#### Casino/Gambling Games (Bet & Win!)
- 🎰 **Plinko** - Drop the ball and catch multipliers
- 🪙 **Coin Flip** - Double or nothing
- 🎡 **Roulette** - Spin the wheel (Red/Black/Even/Odd)
- 🃏 **Blackjack 21** - Beat the dealer
- 🏎️ **Crossy Road** - Dodge traffic for coins
- ⛏️ **Mines** - Click carefully to win big

### 🌐 Multi-Platform Support
- **GameHub** (`/ghub`) - 14 custom in-house games
- **DuckMath** (`/duckmath`) - External educational game collection
- **Radon Games** (`/radon-g3mes`) - React-based game portal
- **Seraph Games** (`/seraph`) - Advanced game platform

### 🌐 Multiplayer Features
- Real-time WebSocket connections (Socket.io)
- Online lobbies for 2+ player games
- Enhanced matchmaking system
- Room creation and management
- Chat functionality in multiplayer games
- Spectator mode for viewing live games

### 💾 Data Persistence
- User profiles with stats
- Coin transactions logged
- Game saves and high scores
- Achievement tracking

---

## 📋 Installation & Setup

### Prerequisites
- Node.js (v14+)
- npm

### Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   ```
   http://localhost:3000
   ```

**Server will start on port 3000** with support for:
- 🎮 GameHub with 14 games
- 🦆 DuckMath platform
- 🎮 Radon Games portal  
- 🎪 Seraph Games platform

---

## 🎯 How to Use

### Creating an Account
1. Click "Register" on the home page
2. Enter username and password (min 6 chars)
3. Start with 1000 coins!

### Choosing a Platform
1. Visit the landing page at `/`
2. Select from:
   - **GameHub** - Play 14 official games
   - **DuckMath** - Educational games
   - **Radon Games** - React-based portal
   - **Seraph Games** - Advanced games

### Playing Games
1. Select any game from your chosen platform
2. For **classic games**: Play locally, track your high score
3. For **casino games**: Place a bet, play, win/lose coins
4. For **multiplayer games**: Find an opponent online or play locally vs AI

### Coin System
- **Start:** 1000 coins per new account
- **Betting:** Place coins to play casino games
- **Winning:** Earn coins based on game multipliers
- **Reset:** Click "Reset" button to go back to 1000 coins (progress wipes)
- **Guest Mode:** Play without saving, no coin persistence

---

## 📁 Project Structure

```
/workspaces/games/
├── server.js                 # Main Express server with all routes
├── multiplayer-manager.js    # WebSocket room/matchmaking system
├── package.json              # Dependencies & scripts
│
├── database/
│   ├── db.js                # SQLite initialization & schema
│   ├── games.db             # User data (auto-created)
│   └── gamedata.db          # Game state (auto-created)
│
├── routes/
│   └── auth.js              # User authentication API
│
├── public/
│   ├── landing.html         # Main landing page (/)
│   ├── index.html           # GameHub main page (/ghub)
│   ├── styles.css           # Global styling
│   ├── script.js            # Global scripts
│   ├── js/
│   │   └── main.js          # Auth, UI, coin system, shared logic
│   └── games/               # Individual game files (14 games)
│       ├── snake.html
│       ├── memory.html
│       ├── tic-tac-toe.html
│       ├── blackjack.html
│       ├── plinko.html
│       ├── coinflip.html
│       ├── roulette.html
│       ├── crossy-road.html
│       ├── flappy-bird.html
│       ├── 2048.html
│       ├── go-fish.html
│       ├── uno.html
│       ├── poker.html
│       └── mines.html
│
├── nginx.conf               # Nginx reverse proxy configuration
├── Dockerfile               # Docker container definition
├── docker-compose.yml       # Docker compose orchestration
├── deploy-docker.sh         # Docker deployment script
├── deploy.sh                # Direct deployment script
├── quick-deploy.sh          # Fast deploy (PM2, no Docker)
├── setup-swap.sh            # Memory swap configuration
│
└── README.md                # This file
```

---

## 🔐 Authentication

### User Registration
```javascript
POST /api/auth/register
{
  "username": "player123",
  "password": "secure123"
}
```

### User Login
```javascript
POST /api/auth/login
{
  "username": "player123",
  "password": "secure123"
}
```

### Guest Mode
```javascript
POST /api/auth/guest
// Returns guest user with 1000 coins (not saved)
```

### Update Coins
```javascript
POST /api/auth/update-coins
{
  "userId": "user-id",
  "amount": 100,        // positive or negative
  "gameId": "plinko",
  "type": "win"         // "win", "loss", "bet", "refund"
}
```

### Reset Coins
```javascript
POST /api/auth/reset-coins
{
  "userId": "user-id"
}
// Resets to 1000 coins
```

---

## 🎮 Game Implementation

### Classic Games Template
```html
<!-- Simple single-player games -->
- Track high scores locally
- No betting required
- Canvas-based or DOM-based
```

### Casino Games Template
```html
<!-- Betting system example -->
1. Place bet (deduct from coins)
2. Play game
3. Calculate result
4. Add/subtract coins based on outcome
5. Update database
```

### Multiplayer Games Template
```javascript
// Socket.io event flow
socket.emit('join-lobby', { gameId, userId, username })
socket.on('lobby-update', (players) => {...})
socket.on('match-start', (matchData) => {...})
socket.emit('game-move', { move, playerId })
socket.on('game-finished', (result) => {...})
```

---

## 🚀 Deploying Locally

### Option 1: Direct Terminal
```bash
cd /workspaces/games
npm start
```

### Option 2: Using VSCode Tasks
1. Press `Ctrl+Shift+B` or go to Terminal → Run Task
2. Select "npm: start"

### Option 3: Development Mode (auto-reload)
```bash
npm run dev
```

---

## 📊 Database Schema

### Users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  password TEXT,
  pin TEXT,
  coins INTEGER,
  created_at DATETIME,
  last_login DATETIME,
  total_games_played INTEGER,
  total_winnings INTEGER
)
```

### Transactions Table
```sql
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY,
  user_id TEXT,
  game_id TEXT,
  amount INTEGER,
  type TEXT,     -- "win", "loss", "bet", "refund"
  created_at DATETIME
)
```

---

## 🎯 Next Steps to Complete

### Games to Add
- [ ] More casino variants
- [ ] Leaderboard integration
- [ ] Achievement system
- [ ] Daily challenges

### Features to Implement
- [ ] Achievements & Badges
- [ ] Daily challenges with rewards
- [ ] Global/weekly/daily leaderboards
- [ ] Sound effects & notifications
- [ ] Game statistics & analytics
- [ ] Seasonal events & tournaments
- [ ] Referral system
- [ ] Premium/VIP features
- [ ] Replay/replay sharing
- [ ] Tournament brackets

### Optimization
- [ ] Lazy-load games
- [ ] Service Worker for offline support
- [ ] Game state compression
- [ ] Database indexing
- [ ] CDN caching

---

## 🛠️ Development Notes

### Adding a New Game

1. **Create game file** in `public/games/game-name.html`
2. **Include shared scripts:**
   ```html
   <script src="/js/main.js"></script>
   <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
   ```
3. **Use global variables:**
   - `currentUser` - logged-in user object
   - `userCoins` - current coin balance
   - `isGuest` - if guest mode
4. **Update coins:**
   ```javascript
   updateCoins(amount, 'gameId', 'type')
   ```
5. **Add to home page** - Update `public/index.html` with game card

### Multiplayer Implementation

Use Socket.io for real-time communication:
```javascript
socket.emit('join-lobby', data)
socket.emit('game-move', data)
socket.emit('leave-lobby', data)
socket.on('match-start', (data) => {...})
```

---

## 🐛 Troubleshooting

**Port 3000 already in use?**
```bash
export PORT=3001
npm start
```

**Database corruption?**
```bash
rm games.db
npm start  # New database will be created
```

**WebSocket not connecting?**
- Check browser console for errors
- Ensure Socket.io is loaded: `<script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>`
- Verify server is running: Check terminal output

---

## 📝 License

MIT - Free to use and modify

---

## 🎉 Have Fun!

Start playing now at `http://localhost:3000`

Questions or issues? Check the browser console (F12) for errors!