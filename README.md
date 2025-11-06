# 🎮 Gaming Hub Platform

A unified gaming platform hosting three major game hubs with 200+ games total.

## 📊 Current Status

> **Note:** After setup, check [SETUP-STATUS.md](./SETUP-STATUS.md) for detailed status of all components.

| Component | Status | Details |
|-----------|--------|---------|
| **GameHub** | ✅ **FULLY WORKING** | All 16 custom games functional |
| **Radon Portal** | ⚠️ Partial | Main site loads, routing needs fix |
| **DuckMath** | ❌ Not Available | Repository not accessible |

**Quick Summary:**
- ✅ **16 custom games ready to play** at `/ghub`
- ⚠️ Radon Games cloned but has routing issues
- ❌ DuckMath repository not found (gracefully handled)

## 🚀 Quick Start (Localhost)

### Prerequisites
- **Node.js** (v14+)
- **npm**
- **Git**

### Setup & Start

Run the universal setup script (works on Windows & Linux):

```bash
# Automated setup with all repositories
node setup-localhost.js --start

# Or setup without auto-start
node setup-localhost.js
```

This will:
- ✅ Install all dependencies
- ✅ Clone and setup Radon Games (if not already present)
- ⚠️ Attempt to clone DuckMath (may fail - repo not accessible)
- ✅ Build all required projects
- ✅ Start the server on http://localhost:3000

### Manual Start

If you've already run setup:

```bash
npm start
```

Access at: **http://localhost:3000**

---

## 🎮 Included Game Hubs

### 1. **GameHub** (Our Custom Games)
**Route:** `/ghub`

**Features:**
- 16 custom-built games
- Casino games (Blackjack, Roulette, Slots)
- Classic arcade (Snake, Pong, Breakout)
- Multiplayer games (Chess, Tic-Tac-Toe)
- Coin betting & rewards system
- User accounts & leaderboards
- Real-time multiplayer lobbies

**Credits:** Original development by Lackstress

---

### 2. **DuckMath Hub**
**Route:** `/duckmath`

**Features:**
- 100+ Flash & HTML5 games
- Action, puzzle, sports & more
- Popular titles: Slope, Retro Bowl, Cookie Clicker
- Tower defense & strategy games
- No login required

**Credits:** [DuckMath Games](https://github.com/DuckMathGames/duckmath)

---

### 3. **Radon Portal**
**Route:** `/radon-g3mes`

**Features:**
- Flash games collection
- Built-in web proxy
- Tab cloaking & privacy tools
- Search functionality
- Modern dark UI
- No ads or tracking

**Credits:** [Radon Games](https://github.com/Radon-Games/Radon-Games)

---

## 🌐 Production Deployment

For domain deployment, use the existing script:

```bash
./quick-deploy.sh
```

This handles:
- Nginx configuration
- SSL/TLS setup
- Domain routing
- Production optimizations

---

## 📝 Notes

- **Localhost only:** Use `setup-localhost.js` for local development
- **Production:** Use `quick-deploy.sh` for domain deployment
- **Port:** Default is 3000, change with `PORT=8080 npm start`

---

**Enjoy gaming! 🎉**