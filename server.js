const express = require('express');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const compression = require('compression');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json());

// ===== ROUTES =====

// Landing page - root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// Games lobby - your games listing
app.get('/games', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// GameHub - your games
app.get('/ghub', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'hub.html'));
});

// DuckMath - serve from duckmath folder with asset path rewriting
app.get('/duckmath', (req, res) => {
  const fs = require('fs');
  const filePath = path.join(__dirname, '..', 'duckmath', 'index.html');
  
  // Check if duckmath exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).send(`
      <html>
        <head><title>DuckMath Not Installed</title></head>
        <body style="font-family: Arial; padding: 50px; text-align: center;">
          <h1>🦆 DuckMath Not Available</h1>
          <p>DuckMath games are not installed on this server.</p>
          <p><a href="/ghub">← Back to Game Hub</a></p>
        </body>
      </html>
    `);
  }
  
  let html = fs.readFileSync(filePath, 'utf8');
  
  // Rewrite specific asset paths to include /duckmath prefix
  // Use replaceAll to ensure we get all occurrences
  html = html.replaceAll('href="/assets/', 'href="/duckmath/assets/');
  html = html.replaceAll('src="/assets/', 'src="/duckmath/assets/');
  html = html.replaceAll('href="/g4m3s/', 'href="/duckmath/g4m3s/');
  html = html.replaceAll('src="/g4m3s/', 'src="/duckmath/g4m3s/');
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

app.get('/duckmath/', (req, res) => {
  const fs = require('fs');
  const filePath = path.join(__dirname, '..', 'duckmath', 'index.html');
  
  // Check if duckmath exists
  if (!fs.existsSync(filePath)) {
    return res.redirect('/duckmath');
  }
  
  let html = fs.readFileSync(filePath, 'utf8');
  
  // Rewrite specific asset paths to include /duckmath prefix
  // Use replaceAll to ensure we get all occurrences
  html = html.replaceAll('href="/assets/', 'href="/duckmath/assets/');
  html = html.replaceAll('src="/assets/', 'src="/duckmath/assets/');
  html = html.replaceAll('href="/g4m3s/', 'href="/duckmath/g4m3s/');
  html = html.replaceAll('src="/g4m3s/', 'src="/duckmath/g4m3s/');
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// DuckMath game page - serve with asset path rewriting (handles both with and without query params)
app.get('/duckmath/g4m3s', (req, res) => {
  const fs = require('fs');
  const filePath = path.join(__dirname, '..', 'duckmath', 'g4m3s', 'index.html');
  
  // Check if duckmath exists
  if (!fs.existsSync(filePath)) {
    return res.redirect('/duckmath');
  }
  
  let html = fs.readFileSync(filePath, 'utf8');
  
  // Rewrite specific asset paths to include /duckmath prefix
  html = html.replaceAll('href="/assets/', 'href="/duckmath/assets/');
  html = html.replaceAll('src="/assets/', 'src="/duckmath/assets/');
  html = html.replaceAll('href="/g4m3s/', 'href="/duckmath/g4m3s/');
  html = html.replaceAll('src="/g4m3s/', 'src="/duckmath/g4m3s/');
  html = html.replaceAll('src="/loading.html"', 'src="/duckmath/loading.html"');
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Redirect /g4m3s/* to /duckmath/g4m3s/* (for DuckMath game links)
app.get('/g4m3s/*', (req, res) => {
  res.redirect('/duckmath' + req.originalUrl);
});

// Redirect other DuckMath paths that might be missing the prefix
app.get('/more/*', (req, res) => {
  res.redirect('/duckmath' + req.originalUrl);
});

app.get('/blog/*', (req, res) => {
  res.redirect('/duckmath' + req.originalUrl);
});

// DuckMath JavaScript file rewriting for navigation links
app.get('/duckmath/assets/js/index.js', (req, res) => {
  const fs = require('fs');
  const filePath = path.join(__dirname, '..', 'duckmath', 'assets', 'js', 'index.js');
  
  // Check if duckmath exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('// DuckMath not installed');
  }
  
  let js = fs.readFileSync(filePath, 'utf8');
  
  // Rewrite navigation links to stay within /duckmath context
  js = js.replaceAll('href="/"', 'href="/duckmath"');
  js = js.replaceAll('href="/index.html"', 'href="/duckmath"');
  
  res.setHeader('Content-Type', 'application/javascript');
  res.send(js);
});

// DuckMath assets and other files
app.use('/duckmath', express.static(path.join(__dirname, '..', 'duckmath')));

// Radon Games - serve from radon-games/dist folder
app.get('/radon-g3mes', (req, res) => {
  const fs = require('fs');
  const distPath = path.join(__dirname, '..', 'radon-games', 'dist', 'index.html');
  
  // Check if radon-games is built
  if (!fs.existsSync(distPath)) {
    return res.status(404).send(`
      <html>
        <head><title>Radon Games Not Installed</title></head>
        <body style="font-family: Arial; padding: 50px; text-align: center;">
          <h1>🎮 Radon Games Not Available</h1>
          <p>Radon Games are not installed on this server.</p>
          <p><a href="/ghub">← Back to Game Hub</a></p>
        </body>
      </html>
    `);
  }
  
  let html = fs.readFileSync(distPath, 'utf8');
  
  // Rewrite asset paths to include /radon-g3mes prefix
  html = html.replaceAll('href="/assets/', 'href="/radon-g3mes/assets/');
  html = html.replaceAll('src="/assets/', 'src="/radon-g3mes/assets/');
  html = html.replaceAll('href="/', 'href="/radon-g3mes/');
  html = html.replaceAll('src="/', 'src="/radon-g3mes/');
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Radon Games assets - serve from dist folder
app.use('/radon-g3mes', express.static(path.join(__dirname, '..', 'radon-games', 'dist')));

// Static files for games
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Multiplayer game lobbies
const lobbies = {};
const activePlayers = {};

// WebSocket connections
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Join game lobby
  socket.on('join-lobby', (data) => {
    const { gameId, userId, username } = data;
    const lobbyId = `${gameId}-lobby`;

    if (!lobbies[lobbyId]) {
      lobbies[lobbyId] = [];
    }

    lobbies[lobbyId].push({
      socketId: socket.id,
      userId,
      username,
    });

    activePlayers[socket.id] = { gameId, userId, username };

    socket.join(lobbyId);

    // Notify players in lobby
    io.to(lobbyId).emit('lobby-update', {
      players: lobbies[lobbyId],
      count: lobbies[lobbyId].length,
    });

    // If 2 players, start match
    if (lobbies[lobbyId].length === 2) {
      const [player1, player2] = lobbies[lobbyId];
      const matchId = `match-${Date.now()}`;

      io.to(lobbyId).emit('match-start', {
        matchId,
        player1,
        player2,
        gameId,
      });

      lobbies[lobbyId] = [];
    }
  });

  // Leave lobby
  socket.on('leave-lobby', (data) => {
    const { gameId } = data;
    const lobbyId = `${gameId}-lobby`;

    if (lobbies[lobbyId]) {
      lobbies[lobbyId] = lobbies[lobbyId].filter(p => p.socketId !== socket.id);
      io.to(lobbyId).emit('lobby-update', {
        players: lobbies[lobbyId],
        count: lobbies[lobbyId].length,
      });
    }

    delete activePlayers[socket.id];
    socket.leave(lobbyId);
  });

  // Game move (for turn-based games)
  socket.on('game-move', (data) => {
    const { matchId, move, playerId } = data;
    io.emit('move-received', { matchId, move, playerId });
  });

  // Game end
  socket.on('game-end', (data) => {
    const { matchId, winner, score } = data;
    io.emit('game-finished', { matchId, winner, score });
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete activePlayers[socket.id];
  });
});

// Basic routes
app.get('/games/:gameId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'games', `${req.params.gameId}.html`));
});

// 404 handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

server.listen(PORT, () => {
  console.log(`🎮 Games Server running on http://localhost:${PORT}`);
  console.log(`🌐 WebSocket ready for multiplayer games`);
  console.log(`🦆 DuckMath available at http://localhost:${PORT}/duckmath`);
});
