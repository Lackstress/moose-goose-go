# 🎮 Single Port Architecture - All Routes on Port 3000

## ✅ Complete Setup

Everything now runs on **ONE PORT (3000)** with clean URL structure:

| URL | Purpose | Content |
|-----|---------|---------|
| `localhost:3000/` | Landing page | Choose platform |
| `localhost:3000/ghub` | GameHub | Your 13 games + betting |
| `localhost:3000/duckmath` | DuckMath | 100+ unblocked games |

---

## 🚀 How to Start

```bash
bash /workspaces/start.sh
```

That's it! Everything runs on port 3000.

---

## 📁 What's Running

```
Port 3000 (Single Server)
├── /                    → Landing page (landing.html)
├── /ghub                → GameHub (hub.html + login)
├── /duckmath            → DuckMath games (100+)
├── /api/auth            → Authentication endpoints
├── /games/              → Individual game files
└── /assets/             → Static files, CSS, JS
```

---

## 🔄 How It Works

### Folder Structure
```
/workspaces/
├── games/              (Your games server)
│   ├── server.js       ← Serves all routes
│   ├── public/
│   │   ├── landing.html
│   │   ├── hub.html
│   │   ├── games/      (13 games)
│   │   └── styles/
│   └── routes/
│
└── duckmath/           (Cloned DuckMath repo)
    ├── index.html
    ├── g4m3s/
    ├── assets/
    └── more/
```

### Server Routing
```
Express Server (Port 3000)
├── GET / 
│   └─ Serves: public/landing.html
├── GET /ghub
│   └─ Serves: public/hub.html
├── GET /duckmath
│   └─ Serves: ../duckmath/* (static files)
├── POST /api/auth/*
│   └─ Authentication routes
└── Static: public/* (games, CSS, JS)
```

---

## 🌐 For Your Domain

When you deploy to `hbutrees.io`:

```
https://hbutrees.io/              → Landing page
https://hbutrees.io/ghub          → GameHub
https://hbutrees.io/duckmath      → DuckMath
```

Same URL structure, works on any domain! ✨

---

## ✨ No More Multiple Ports!

| Before | After |
|--------|-------|
| localhost:3000 → Games | localhost:3000/ → Landing |
| localhost:3001 → DuckMath | localhost:3000/ghub → Games |
| | localhost:3000/duckmath → DuckMath |

---

## 🔧 Server Configuration

**server.js now handles:**

1. **Landing Page Route** - Choose platform
2. **GameHub Route** - Your games with authentication
3. **DuckMath Route** - Serves from `/workspaces/duckmath`
4. **Static Files** - All public assets
5. **API Routes** - Authentication & game logic

---

## 📱 Everything Works

✅ Landing page
✅ GameHub (with login/register)
✅ Guest login option
✅ All 13 games
✅ DuckMath 100+ games
✅ Multiplayer
✅ Responsive design
✅ Single port

---

## 🎯 User Experience

```
User visits: hbutrees.io (or localhost:3000)
     ↓
  Sees landing page with 2 choices
     ↓
  Chooses GameHub OR DuckMath
     ↓
  GameHub: Login required
  DuckMath: Direct access
     ↓
  Play games!
```

---

## 🔐 Fixed Issues

✅ No more port confusion
✅ Clean URLs (no port numbers)
✅ One server to manage
✅ One startup command
✅ Better for deployment
✅ Works on any domain structure

---

## 📊 Server Stats

```
Backend: Node.js + Express
Port: 3000 (single)
Routes: 3 main paths + API
Static Files: GameHub + DuckMath combined
Database: SQLite (games only)
WebSocket: Socket.io (multiplayer)
```

---

## 🚀 Performance

- Single server = less overhead
- Static serving = fast
- No port redirects = instant
- All routes on one port = simple deployment

---

## 📝 Quick Reference

```bash
# Start server
bash /workspaces/start.sh

# Or manually
cd /workspaces/games && npm start

# Visit
http://localhost:3000              # Landing
http://localhost:3000/ghub         # Your games
http://localhost:3000/duckmath     # DuckMath
```

---

## ✨ Summary

Your gaming platform is now:
- ✅ Running on single port (3000)
- ✅ Clean URL structure (no ports in paths)
- ✅ Easy to deploy
- ✅ Works on any domain
- ✅ Professional setup
- ✅ Production ready

---

**You're all set! Just run `bash /workspaces/start.sh` to start everything.** 🎉
