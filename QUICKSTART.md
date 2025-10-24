# 🎮 Quick Start Guide

## 5-Minute Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```

You should see:
```
🎮 Games Server running on http://localhost:3000
🌐 WebSocket ready for multiplayer games
```

### 3. Open in Browser
Navigate to: **http://localhost:3000**

---

## 🎯 First Steps

### Create Account
1. Click "**Register**"
2. Enter username & password
3. Start with **1000 coins** ✨

### Or Play as Guest
1. Click "**Play as Guest**"
2. Play any game (progress not saved)

---

## 🎮 Try These Games

### 🤑 Quick Money-Makers (Gambling)
- **Coin Flip** - 50/50 chance to double
- **Plinko** - Watch ball drop, get multipliers
- **Roulette** - Classic wheel spin

### 🧠 Brain Games
- **Memory Match** - Find matching pairs
- **Snake** - Classic with 3 difficulty levels

### 🤝 Multiplayer
- **Tic Tac Toe** - Play online vs real players

---

## 💡 Tips

### Coin System
- **Starting coins:** 1000
- **Minimum bet:** 10 coins
- **Reset button:** Go back to 1000 (wipes progress)
- **Guest mode:** No coins saved

### Playing Casino Games
1. Place a bet
2. Play the game
3. Win/lose coins based on outcome
4. Progress automatically saved to database

### Multiplayer Games
- Click "Find Online Opponent"
- Wait for another player to join
- Play in real-time
- Results saved

---

## 🔧 Troubleshooting

**Server won't start?**
```bash
# Check if port 3000 is free
lsof -i :3000

# Or use different port
PORT=3001 npm start
```

**Can't access from browser?**
- Try: http://127.0.0.1:3000
- Try: http://localhost:3000
- Check console (F12) for errors

**Lost coins/progress?**
- Check if you're logged in (top right)
- Guest mode doesn't save progress
- Database is in `games.db`

---

## 📂 File Structure

```
/workspaces/games/
├── server.js          ← Main server
├── package.json       ← Dependencies
├── public/
│   ├── index.html     ← Home page
│   ├── styles.css     ← Styling
│   ├── js/main.js     ← Auth & core logic
│   └── games/
│       ├── snake.html
│       ├── plinko.html
│       └── ...
├── database/
│   └── db.js          ← Database
└── routes/
    └── auth.js        ← User system
```

---

## 🚀 Development Mode

Want auto-reload on file changes?
```bash
npm run dev
```

---

## 📊 What's Already Built

✅ User authentication (register/login/guest)
✅ Account system with coins
✅ 8 games ready to play
✅ Multiplayer (Tic Tac Toe)
✅ Casino games with betting
✅ Database persistence
✅ WebSocket support

---

## 🎯 Next: Add More Games

To add a new game, create an HTML file in `public/games/` and add it to the home page grid!

---

**Happy Gaming! 🎮**
