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

// Bare server proxy for Radon Games web proxy (must be at root level)
// This implements a basic bare-mux protocol proxy
app.all('/~/sj/*', async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }

  try {
    // Extract the target URL from the path
    // Format: /~/sj/https://example.com/path
    const urlPath = req.path.replace('/~/sj/', '');
    
    if (!urlPath || !urlPath.startsWith('http')) {
      return res.status(400).json({ error: 'Invalid proxy URL' });
    }
    
    const targetUrl = decodeURIComponent(urlPath);
    const https = require('https');
    const http = require('http');
    const url = require('url');
    const parsedUrl = url.parse(targetUrl);
    
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.path,
      method: req.method,
      headers: {
        'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': req.headers['accept'] || '*/*',
        'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    };
    
    // Copy safe headers
    const safeHeaders = ['referer', 'origin', 'cookie', 'authorization', 'content-type', 'content-length'];
    safeHeaders.forEach(header => {
      if (req.headers[header]) {
        options.headers[header] = req.headers[header];
      }
    });
    
    const proxyReq = protocol.request(options, (proxyRes) => {
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Access-Control-Expose-Headers', '*');
      
      // Copy response headers except security blockers
      Object.keys(proxyRes.headers).forEach(key => {
        const lowerKey = key.toLowerCase();
        if (lowerKey !== 'x-frame-options' && 
            lowerKey !== 'content-security-policy' &&
            lowerKey !== 'content-security-policy-report-only' &&
            lowerKey !== 'strict-transport-security') {
          res.setHeader(key, proxyRes.headers[key]);
        }
      });
      
      res.status(proxyRes.statusCode);
      proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (err) => {
      console.error('Bare proxy error:', err.message);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Proxy request failed', message: err.message });
      }
    });
    
    // Forward request body if present
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
    
  } catch (err) {
    console.error('Bare proxy error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Proxy error', message: err.message });
    }
  }
});

// Landing page - root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// Games hub selection - choose game source
app.get('/games', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'hub.html'));
});

// GameHub - your games lobby
app.get('/ghub', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

// Helper function to inject Radon Games base path interceptor
function injectRadonInterceptor(html) {
  const interceptorScript = `
    <script>
      (function() {
        const basePath = '/radon-g3mes';
        
        // Store original location properties
        const originalLocation = window.location;
        const descriptor = Object.getOwnPropertyDescriptor(window, 'location');
        
        // Intercept all clicks on the page
        document.addEventListener('click', function(e) {
          const target = e.target.closest('a');
          if (!target) return;
          
          const href = target.getAttribute('href');
          if (!href) return;
          
          // Skip external links and already-prefixed links
          if (href.startsWith('http') || href.startsWith('//') || href.startsWith(basePath)) {
            return;
          }
          
          // If it's a root-relative link, prefix it
          if (href.startsWith('/')) {
            e.preventDefault();
            const newPath = basePath + href;
            window.history.pushState({}, '', newPath);
            // Trigger React Router navigation by dispatching popstate
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
        }, true);
        
        // Override pushState and replaceState to add base path
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function(state, title, url) {
          if (url && url.startsWith('/') && !url.startsWith(basePath)) {
            url = basePath + url;
          }
          return originalPushState.call(this, state, title, url);
        };
        
        history.replaceState = function(state, title, url) {
          if (url && url.startsWith('/') && !url.startsWith(basePath)) {
            url = basePath + url;
          }
          return originalReplaceState.call(this, state, title, url);
        };
      })();
    </script>
  `;
  
  return html.replace('</body>', interceptorScript + '</body>');
}

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
  // First handle /assets/ paths
  html = html.replaceAll('href="/assets/', 'href="/radon-g3mes/assets/');
  html = html.replaceAll('src="/assets/', 'src="/radon-g3mes/assets/');
  
  // Then handle other root paths, but exclude already-prefixed paths and external URLs
  html = html.replace(/href="\/(?!radon-g3mes|http|https|\/)/g, 'href="/radon-g3mes/');
  html = html.replace(/src="\/(?!radon-g3mes|http|https|\/)/g, 'src="/radon-g3mes/');
  
  // Inject interceptor script
  html = injectRadonInterceptor(html);
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Radon Games assets - serve from dist folder
app.use('/radon-g3mes', express.static(path.join(__dirname, '..', 'radon-games', 'dist')));

// Radon Games proxy dependencies - serve BEFORE catch-all route
app.use('/radon-g3mes/baremux', express.static(path.join(__dirname, '..', 'radon-games', 'dist', 'baremux')));
app.use('/radon-g3mes/libcurl', express.static(path.join(__dirname, '..', 'radon-games', 'dist', 'libcurl')));
app.use('/radon-g3mes/epoxy', express.static(path.join(__dirname, '..', 'radon-games', 'dist', 'epoxy')));
app.use('/radon-g3mes/scram', express.static(path.join(__dirname, '..', 'radon-games', 'dist', 'scram')));

// Radon Games CDN proxy - proxy game files from radon.games
app.get('/radon-g3mes/cdn/*', async (req, res) => {
  const cdnPath = req.path.replace('/radon-g3mes/cdn/', '');
  const cdnUrl = `https://radon.games/cdn/${cdnPath}`;
  
  try {
    const https = require('https');
    const url = require('url');
    const parsedUrl = url.parse(cdnUrl);
    
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };
    
    https.get(options, (cdnRes) => {
      // Remove X-Frame-Options and other security headers that block iframe embedding
      res.setHeader('Content-Type', cdnRes.headers['content-type'] || 'text/html');
      if (cdnRes.headers['cache-control']) {
        res.setHeader('Cache-Control', cdnRes.headers['cache-control']);
      }
      
      cdnRes.pipe(res);
    }).on('error', (err) => {
      console.error(`CDN proxy error: ${err.message}`);
      res.status(502).send('Failed to load game content');
    });
  } catch (err) {
    console.error(`CDN proxy error: ${err.message}`);
    res.status(500).send('Server error');
  }
});

// Radon Games catch-all for client-side routing (must be after static files)
app.get('/radon-g3mes/*', (req, res) => {
  const fs = require('fs');
  const distPath = path.join(__dirname, '..', 'radon-games', 'dist', 'index.html');
  
  if (!fs.existsSync(distPath)) {
    return res.status(404).send('Radon Games not available');
  }
  
  let html = fs.readFileSync(distPath, 'utf8');
  
  // Rewrite asset paths
  html = html.replaceAll('href="/assets/', 'href="/radon-g3mes/assets/');
  html = html.replaceAll('src="/assets/', 'src="/radon-g3mes/assets/');
  html = html.replace(/href="\/(?!radon-g3mes|http|https|\/)/g, 'href="/radon-g3mes/');
  html = html.replace(/src="\/(?!radon-g3mes|http|https|\/)/g, 'src="/radon-g3mes/');
  
  // Inject interceptor script
  html = injectRadonInterceptor(html);
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

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
