# 🎮 Games Lobby - Reference Card

## 🚀 Quick Start (60 seconds)

```bash
# 1. Install dependencies
npm install

# 2. Start server
npm start

# 3. Open browser
http://localhost:3000
```

---

## 📖 Documentation Files

| File | Content |
|------|---------|
| **README.md** | Full documentation & features |
| **QUICKSTART.md** | 5-minute setup guide |
| **BUILD_SUMMARY.md** | What was built & tech stack |
| **GAMES_GUIDE.md** | All games & strategies |
| **DEVELOPMENT_PLAN.md** | Architecture & roadmap |
| **IMPLEMENTATION_CHECKLIST.md** | What's complete |

---

## 🎮 Games Available (8)

### 🤑 Gambling Games
1. **Blackjack 21** - Beat dealer, hit/stand/double
2. **Plinko** - Drop ball, catch multipliers
3. **Coin Flip** - 50/50 double or nothing
4. **Roulette** - Spin wheel, bet on colors/numbers
5. **Crossy Road** - Dodge cars, earn by distance

### 🧠 Brain Games  
1. **Snake** - Classic with 3 difficulty levels
2. **Memory** - Match pairs, different sizes

### 🤝 Multiplayer
1. **Tic Tac Toe** - Online vs players or vs AI

---

## 💰 Coin System

- **Start:** 1000 coins
- **Min Bet:** 10 coins
- **Max Bet:** Your balance
- **Reset Button:** Back to 1000 (⚠️ wipes progress)
- **Guest:** 1000 coins (not saved)

---

## 🔐 User Accounts

### Create Account
```
Username + Password → Saved to database
Coins persistent across sessions
```

### Guest Mode
```
No login required
Coins reset on reload
No progress saved
```

---

## 📁 File Structure

```
/workspaces/games/
├── server.js               ← Main server
├── package.json            ← Dependencies
├── database/
│   └── db.js              ← Database & schema
├── routes/
│   └── auth.js            ← User authentication
└── public/
    ├── index.html         ← Home page
    ├── styles.css         ← Styling
    ├── js/main.js         ← Core logic
    └── games/
        ├── snake.html
        ├── memory.html
        ├── tic-tac-toe.html
        ├── blackjack.html
        ├── plinko.html
        ├── coinflip.html
        ├── roulette.html
        └── crossy-road.html
```

---

## 🔧 Important Commands

| Command | Purpose |
|---------|---------|
| `npm start` | Start server (production) |
| `npm run dev` | Start with auto-reload |
| `PORT=3001 npm start` | Use different port |
| `rm games.db` | Delete database (fresh start) |

---

## 🎯 URLs

| URL | Purpose |
|-----|---------|
| `http://localhost:3000` | Home lobby |
| `http://localhost:3000/games/snake` | Snake game |
| `http://localhost:3000/games/blackjack` | Blackjack |
| `http://localhost:3000/games/tic-tac-toe` | Tic Tac Toe |
| (All other games similar) | ... |

---

## 📊 API Endpoints

### Authentication
```
POST   /api/auth/register       - Register user
POST   /api/auth/login          - Login user
POST   /api/auth/guest          - Guest login
GET    /api/auth/profile/:id    - Get user profile
POST   /api/auth/update-coins   - Update coins
POST   /api/auth/reset-coins    - Reset to 1000
```

---

## 💡 Code Snippets

### Add coins to player
```javascript
updateCoins(100, 'game-id', 'win');
updateCoins(-50, 'game-id', 'loss');
```

### Show notification
```javascript
showNotification('Won 100 coins!', 'success');
showNotification('Not enough coins', 'error');
showNotification('Normal message');
```

### Check if logged in
```javascript
if (!currentUser) {
  showNotification('Please login', 'error');
  return;
}
```

### Get current coins
```javascript
console.log(userCoins);  // Current balance
console.log(currentUser);  // User object
console.log(isGuest);  // Is guest mode?
```

---

## 🎨 Colors & Styling

```css
--primary: #667eea         (Purple)
--secondary: #764ba2       (Dark purple)
--success: #10b981         (Green)
--danger: #ef4444          (Red)
--warning: #f59e0b         (Orange)
```

---

## 🐛 Troubleshooting

### Server won't start
```bash
# Check port is free
lsof -i :3000

# Use different port
PORT=3001 npm start
```

### Database error
```bash
# Delete and recreate
rm games.db
npm start
```

### WebSocket not connecting
- Check browser console (F12)
- Verify Socket.io loaded
- Try: `http://127.0.0.1:3000`

### Lost coins/progress
- Check if logged in (not guest)
- Guest mode ≠ saved
- Use reset button to restore 1000

---

## 🌟 Features Highlight

✅ 8 playable games
✅ User accounts (register/login)
✅ Coin betting system
✅ Real-time multiplayer
✅ Mobile responsive
✅ SQLite database
✅ WebSocket support
✅ Professional UI
✅ Fully documented

---

## 📈 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Framework | Express.js |
| Real-time | Socket.io |
| Database | SQLite3 |
| Frontend | HTML5/CSS3/JS |
| Security | bcryptjs |

---

## 🎓 Learning Resources

### In-Code
- **Browser Console:** Press F12 to see logs
- **Server Terminal:** Shows connection info
- **Database:** `sqlite3 games.db` to inspect

### Documentation
- README.md - Complete guide
- QUICKSTART.md - Get started fast
- Each game has inline comments

---

## 🚀 Next Steps

### Immediate
1. Run `npm start`
2. Open http://localhost:3000
3. Create account or play as guest
4. Try all 8 games

### Short-term
- Reach 5000 coins
- Win Tic Tac Toe vs multiplayer
- Get 100% on Memory game

### Long-term
- Add more games (Go Fish, Uno, Poker)
- Add achievements/badges
- Add leaderboards
- Deploy to cloud hosting

---

## 📞 Need Help?

| Question | Answer |
|----------|--------|
| How to play? | See GAMES_GUIDE.md |
| How does it work? | See README.md |
| Quick setup? | See QUICKSTART.md |
| What's built? | See BUILD_SUMMARY.md |
| Architecture? | See DEVELOPMENT_PLAN.md |

---

## 🎉 Ready?

```bash
npm start
```

Then open: **http://localhost:3000**

**Happy gaming!** 🎮✨

---

## 📋 Checklist Before First Run

- ✅ Node.js installed? (`node --version`)
- ✅ In correct directory? (`cd /workspaces/games`)
- ✅ Dependencies installed? (`npm install` done)
- ✅ Port 3000 free? (or use different port)
- ✅ Ready to play? (`npm start`)

**All set? Let's go!** 🚀
