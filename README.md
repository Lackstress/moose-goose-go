# 🎮 Gaming Hub Platform

A complete multiplayer gaming platform with 14+ games, user authentication, and virtual coin system.

## 📋 Quick Setup

### Prerequisites
- Node.js (v14+)
- npm
- Git (for cloning external game repositories)

### Installation

**Option 1: Automated Setup (Recommended)**

Run the universal installer (works on Windows, Linux, and macOS):

```bash
# On Windows (PowerShell or Command Prompt)
node install.js
# or
install.cmd
# or
npm run install-all

# On Linux/macOS
node install.js
# or
./install
# or
npm run install-all
```

This will:
- ✅ Install all npm dependencies
- ✅ Verify all core files
- ✅ Verify all 16 built-in games
- ✅ Clone DuckMath games repository
- ✅ Clone Radon Games repository (200+ games)

**Option 2: Manual Setup**

1. **Navigate to project:**
   ```bash
   cd moose-goose-go
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Access locally:**
   ```
   http://localhost:3000
   ```

---

## � Domain Setup (Production)

### Configure Your Domain

1. **Point DNS to your server:**
   - Set A record to your server's IP address
   - Optional: Set CNAME `www` → your main domain

2. **Setup Nginx Reverse Proxy:**
   ```bash
   # Edit nginx.conf with your domain
   server {
       listen 80;
       server_name yourdomain.com www.yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }
   }
   ```

3. **Enable SSL/TLS (HTTPS):**
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

4. **Restart Nginx:**
   ```bash
   sudo systemctl restart nginx
   ```

### Custom Ports

If port 3000 is unavailable, specify a different port:

```bash
PORT=8080 npm start
```

Update Nginx `proxy_pass` to match the new port.

---

## 🎮 Features

- 14+ games across multiple categories
- Real-time multiplayer (Socket.io)
- User accounts with coin system
- SQLite database for persistence
- Responsive dark theme UI

---

## 📞 Troubleshooting

**Port already in use?**
```bash
PORT=3001 npm start
```

**WebSocket connection issues?**
- Check browser console for errors (F12)
- Verify server is running

**Database needs reset?**
```bash
rm games.db
npm start
```

---

Enjoy! 🎉