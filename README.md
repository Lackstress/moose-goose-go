## 🚀 Easy Deployment

### 1. 🏁 Windows (Personal PC)
Best for local play or a Windows-based server.
```powershell
# In PowerShell, run this first:
.\setup-windows.ps1

# Then start the hub:
npm start
```

### 2. 🐧 Linux / Universal (Cloud VPS/Server)
Best for any Ubuntu, Debian, or other Linux server.
```bash
# Automated install for Nginx, SSL, and Hub:
bash deploy.sh
```

### 3. 🖥️ Console-Only VM (Quickly Setup .env)
If you are on a terminal-only server and need to quickly create your config file:
```bash
# Copy the template and edit with nano:
cp .env.example .env && nano .env

# OR use this one-liner to fill it directly:
cat > .env << EOL
PORT=3000
NODE_ENV=production
SPOTIFY_CLIENT_ID=your_id
SPOTIFY_CLIENT_SECRET=your_secret
EOL
```

Access at: **http://localhost:3000** (or your domain if on a server).

---

## 🎮 Included Game Hubs

### 1. **GameHub** (Our Custom Games)
**Route:** `/ghub`

**Features:**
- 16 custom-built games
- Casino games (Blackjack, Roulette, Slots)
- Classic arcade (Snake, Pong)
- Multiplayer games (Chess, Tic-Tac-Toe)
- Coin betting & rewards system
- User accounts & leaderboards

---

### 2. **DuckMath Hub**
**Route:** `/duckmath`

---

### 3. **Seraph Games**
**Route:** `/seraph`

---

## 📝 Configuration

- **Port:** Default is 3000. Change it in your `.env` file.
- **Secrets:** Keep your Spotify and session keys in `.env`. These are never served to the web.
- **Database:** Local SQLite database is stored in `database/games.db`.

---

**Enjoy gaming! 🎉**