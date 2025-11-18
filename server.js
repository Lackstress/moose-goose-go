const express = require('express');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const MultiplayerManager = require('./multiplayer-manager');
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
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

// ---- YouTube info caching & yt-dlp wrapper (avoids 410 errors) ----
const ytInfoCache = new Map();
const YT_INFO_TTL_MS = 5 * 60 * 1000;

async function fetchYoutubeInfoStable(videoUrl) {
  const cached = ytInfoCache.get(videoUrl);
  const now = Date.now();
  if (cached && (now - cached.cachedAt) < YT_INFO_TTL_MS) {
    return cached.info;
  }
  try {
    const { stdout } = await execFileAsync('yt-dlp', [
      '--dump-json',
      '--no-playlist',
      '--skip-download',
      videoUrl
    ], { maxBuffer: 5 * 1024 * 1024 });
    const raw = JSON.parse(stdout);
    const info = {
      videoDetails: { title: raw.title || 'Video', videoId: raw.id },
      formats: (raw.formats || []).map(f => ({
        itag: f.format_id,
        qualityLabel: f.format_note || f.height ? `${f.height}p` : 'unknown',
        hasVideo: !!f.vcodec && f.vcodec !== 'none',
        hasAudio: !!f.acodec && f.acodec !== 'none',
        container: f.ext,
        url: f.url,
        bitrate: f.tbr ? f.tbr * 1000 : 0,
        mimeType: f.vcodec && f.acodec ? `video/${f.ext}` : f.vcodec ? `video/${f.ext}` : `audio/${f.ext}`
      }))
    };
    ytInfoCache.set(videoUrl, { info, cachedAt: Date.now() });
    return info;
  } catch (err) {
    throw new Error(`yt-dlp info fetch failed: ${err.message}`);
  }
}

// Initialize Multiplayer Manager
const multiplayerManager = new MultiplayerManager(io);

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json());

// ===== ROUTES =====

// Bare server proxy for Radon Games web proxy
// This implements a basic bare-mux protocol proxy
// Handler function to be reused for both root and /radon-g3mes paths
const handleBareProxy = async (req, res, pathPrefix) => {
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
    // Format: /~/sj/https://example.com/path or /radon-g3mes/~/sj/https://example.com/path
    const urlPath = req.path.replace(pathPrefix, '');
    
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
};

// Root level proxy route (legacy)
app.all('/~/sj/*', (req, res) => handleBareProxy(req, res, '/~/sj/'));

// Radon-prefixed proxy route (for /radon-g3mes base path)
app.all('/radon-g3mes/~/sj/*', (req, res) => handleBareProxy(req, res, '/radon-g3mes/~/sj/'));

// Landing page - root (shows all 3 hubs to choose from)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// GameHub - THE ACTUAL 13 GAMES HUB
app.get('/ghub', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// /games route - intentionally shows "lost" message
app.get('/games', (req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Lost?</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          color: #fff;
        }
        .container {
          text-align: center;
          padding: 40px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 20px;
          backdrop-filter: blur(10px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          max-width: 600px;
        }
        h1 {
          font-size: 4rem;
          margin-bottom: 20px;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        }
        p {
          font-size: 1.5rem;
          margin-bottom: 30px;
          opacity: 0.9;
        }
        .btn {
          display: inline-block;
          padding: 15px 40px;
          font-size: 1.2rem;
          color: #fff;
          background: rgba(255, 255, 255, 0.2);
          border: 2px solid #fff;
          border-radius: 50px;
          text-decoration: none;
          transition: all 0.3s ease;
          cursor: pointer;
        }
        .btn:hover {
          background: #fff;
          color: #667eea;
          transform: translateY(-2px);
          box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎮 Oops!</h1>
        <p>Seems like you got lost.</p>
        <p>Would you like to return to the landing page?</p>
        <a href="/" class="btn">← Back to Home</a>
      </div>
    </body>
    </html>
  `);
});

// ===== DUCK MATH ROUTES =====
// Note: deploy.sh clones DuckMath to the parent directory of this repo
// so we intentionally resolve to '../duckmath' here. For local dev, we also
// support a fallback './duckmath' inside this repository if present.
let duckmathPath = path.join(__dirname, '..', 'duckmath');
try {
  const fs = require('fs');
  if (!fs.existsSync(duckmathPath)) {
    const fallback = path.join(__dirname, 'duckmath');
    if (fs.existsSync(fallback)) {
      duckmathPath = fallback;
    }
  }
} catch {}
const serveDuckmathIndex = (req, res) => {
  const fs = require('fs');
  const indexPath = path.join(duckmathPath, 'index.html');

  if (!fs.existsSync(indexPath)) {
    return res.status(404).send('DuckMath is not installed.');
  }

  try {
    let html = fs.readFileSync(indexPath, 'utf8');

    // Inject a <base> tag so client-side routing & absolute assets work under /duckmath
    // Use a robust regex to match <head> with optional attributes/whitespace
    html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n  <base href="/duckmath/">`);

    // Rewrite absolute asset and link paths to live under /duckmath
    // Avoid touching fully-qualified URLs (http/https) or protocol-relative (//)
    html = html.replace(/href="\/(?!duckmath|http|https|\/)/g, 'href="/duckmath/');

      // Inject small runtime interceptor to fix dynamically added root-relative links
      const interceptor = `
        <script>
          (function(){
            var basePath = '/duckmath';
            function fixLinks(){
              try {
                document.querySelectorAll('a[href]').forEach(function(a){
                  var href = a.getAttribute('href');
                  if (!href) return;
                  // prefix root-relative links that are not already under /duckmath and not protocol-relative
                  if (href.startsWith('/') && !href.startsWith(basePath) && !href.startsWith('//')) {
                    a.setAttribute('href', basePath + href);
                  }
                });
              } catch(_) {}
            }
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', fixLinks);
            } else {
              fixLinks();
            }
            // Intercept clicks as a safety net for links mutated after load
            document.addEventListener('click', function(e){
              var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
              if (!a) return;
              var href = a.getAttribute('href');
              if (!href) return;
              if (href.startsWith('/') && !href.startsWith(basePath) && !href.startsWith('//')) {
                e.preventDefault();
                window.location.href = basePath + href;
              }
            }, true);
            // Observe DOM mutations for dynamically inserted content
            try {
              var mo = new MutationObserver(function(){ fixLinks(); });
              mo.observe(document.documentElement || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
            } catch(_) {}
            // Re-run periodically as a fallback to catch any missed changes
            setInterval(fixLinks, 300);
          })();
        </script>
      `;
      html = html.replace('</body>', interceptor + '</body>');
    html = html.replace(/src="\/(?!duckmath|http|https|\/)/g, 'src="/duckmath/');

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (e) {
    console.error('Failed to serve DuckMath index:', e);
    return res.status(500).send('DuckMath failed to load.');
  }
};

// Handle DuckMath SPA routes FIRST (before static serving)
// This ensures we can inject base tag and rewrite paths
app.get('/duckmath', serveDuckmathIndex);
app.get('/duckmath/', serveDuckmathIndex);
app.get('/duckmath/index.html', serveDuckmathIndex);
// Serve static assets (excluding index.html which we handle above)
app.use('/duckmath', express.static(duckmathPath, { index: false }));
// Catch-all for DuckMath subdirectories that need index.html (like /duckmath/g4m3s/)
app.get('/duckmath/*', (req, res, next) => {
  const fs = require('fs');
  const requestedPath = req.path.replace('/duckmath/', '');
  const fullPath = path.join(duckmathPath, requestedPath);
  
  // If this is a directory request, serve its index.html with base tag injection
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    const indexPath = path.join(fullPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      try {
        let html = fs.readFileSync(indexPath, 'utf8');
        html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n  <base href="/duckmath/">`);
        html = html.replace(/href="\/(?!duckmath|http|https|\/)/g, 'href="/duckmath/');
        html = html.replace(/src="\/(?!duckmath|http|https|\/)/g, 'src="/duckmath/');
        res.setHeader('Content-Type', 'text/html');
        return res.send(html);
      } catch (e) {
        console.error('Failed to serve DuckMath subdirectory index:', e);
      }
    }
  }
  
  // Otherwise continue to static file serving or 404
  next();
});

// ============================================================================
// RADON GAMES HUB
// ============================================================================

// Helper function to prepare Radon Games HTML with base tag and asset rewrites
function prepareRadonHtml(html) {
  // Add base tag for React Router to help with routing
  html = html.replace('<head>', '<head>\n  <base href="/radon-g3mes/">');
  
  // Rewrite asset paths
  html = html.replaceAll('href="/assets/', 'href="/radon-g3mes/assets/');
  html = html.replaceAll('src="/assets/', 'src="/radon-g3mes/assets/');
  // Exclude proxy paths (/~/) from rewriting
  html = html.replace(/href="\/(?!radon-g3mes|http|https|\/|~)/g, 'href="/radon-g3mes/');
  html = html.replace(/src="\/(?!radon-g3mes|http|https|\/|~)/g, 'src="/radon-g3mes/');
  
  // Inject interceptor script
  return injectRadonInterceptor(html);
}

// Helper function to inject Radon Games base path interceptor
function injectRadonInterceptor(html) {
  const interceptorScript = `
    <script>
      (function() {
        const basePath = '/radon-g3mes';
        
        // Helper to check if a path should be excluded from rewriting
        function shouldExclude(path) {
          if (!path || !path.startsWith('/')) return true;
          if (path.startsWith('http') || path.startsWith('//')) return true;
          if (path.startsWith(basePath)) return true;
          if (path.startsWith('/~/')) return true; // EXCLUDE PROXY PATHS
          return false;
        }
        
        // First, fix all existing href and src attributes on page load
        function fixAllLinks() {
          // Fix all anchor links
          document.querySelectorAll('a[href]').forEach(link => {
            const href = link.getAttribute('href');
            if (!shouldExclude(href)) {
              link.setAttribute('href', basePath + href);
            }
          });
          
          // Fix all image sources
          document.querySelectorAll('img[src]').forEach(img => {
            const src = img.getAttribute('src');
            if (!shouldExclude(src)) {
              img.setAttribute('src', basePath + src);
            }
          });
          
          // Fix all iframe sources (CRITICAL FOR GAMES)
          document.querySelectorAll('iframe[src]').forEach(iframe => {
            const src = iframe.getAttribute('src');
            if (!shouldExclude(src)) {
              iframe.setAttribute('src', basePath + src);
            }
          });
          
          // Fix form actions
          document.querySelectorAll('form[action]').forEach(form => {
            const action = form.getAttribute('action');
            if (!shouldExclude(action)) {
              form.setAttribute('action', basePath + action);
            }
          });
        }
        
        // Run on initial load
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', fixAllLinks);
        } else {
          fixAllLinks();
        }
        
        // Also run periodically to catch dynamically added content
        setInterval(fixAllLinks, 1000);
        
        // Intercept all clicks on the page
        document.addEventListener('click', function(e) {
          const target = e.target.closest('a');
          if (!target) return;
          
          const href = target.getAttribute('href');
          if (!href) return;
          
          // Skip external links, already-prefixed links, anchor links, and proxy paths
          if (href.startsWith('http') || href.startsWith('//') || href.startsWith(basePath) || href.startsWith('#') || href.startsWith('/~/')) {
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
        
        // Intercept form submissions
        document.addEventListener('submit', function(e) {
          const form = e.target;
          const action = form.getAttribute('action');
          if (action && action.startsWith('/') && !action.startsWith(basePath) && !action.startsWith('http') && !action.startsWith('//')) {
            form.setAttribute('action', basePath + action);
          }
        }, true);
        
        // Override pushState and replaceState to add base path
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function(state, title, url) {
          if (url && url.startsWith('/') && !url.startsWith(basePath) && !url.startsWith('http') && !url.startsWith('//')) {
            url = basePath + url;
          }
          return originalPushState.call(this, state, title, url);
        };
        
        history.replaceState = function(state, title, url) {
          if (url && url.startsWith('/') && !url.startsWith(basePath) && !url.startsWith('http') && !url.startsWith('//')) {
            url = basePath + url;
          }
          return originalReplaceState.call(this, state, title, url);
        };
        
        // Intercept fetch requests to fix proxy and API calls
        const originalFetch = window.fetch;
        window.fetch = function(url, options) {
          if (typeof url === 'string') {
            // Fix root-relative paths for APIs, search, and other endpoints
            if (url.startsWith('/') && !url.startsWith(basePath) && !url.startsWith('/api') && !url.startsWith('/search') && !url.startsWith('http') && !url.startsWith('//')) {
              url = basePath + url;
            }
            // Handle special case for search and API endpoints
            if ((url.startsWith('/api') || url.startsWith('/search')) && !url.startsWith(basePath)) {
              // Only prefix if not already prefixed and not http
              if (!url.startsWith('http') && !url.startsWith('//') && url.startsWith('/')) {
                url = basePath + url;
              }
            }
          }
          return originalFetch.call(this, url, options);
        };
        
        // Fix XMLHttpRequest for legacy AJAX
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
          if (typeof url === 'string') {
            if (url.startsWith('/') && !url.startsWith(basePath) && !url.startsWith('http') && !url.startsWith('//')) {
              url = basePath + url;
            }
          }
          return originalOpen.call(this, method, url, ...args);
        };

        // Fix URL redirects for search
        if (window.location.pathname.includes('/search')) {
          console.log('[Radon] Search path detected:', window.location.pathname);
        }

        // Patch service worker registration so it scopes to /radon-g3mes instead of the domain root
        try {
          if (navigator.serviceWorker && typeof navigator.serviceWorker.register === 'function') {
            const originalRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
            navigator.serviceWorker.register = function(scriptURL, options) {
              try {
                if (typeof scriptURL === 'string') {
                  if (scriptURL.startsWith('/') && !scriptURL.startsWith(basePath) && !scriptURL.startsWith('//')) {
                    scriptURL = basePath + scriptURL;
                  }
                }
                // Ensure scope stays within /radon-g3mes
                if (!options) {
                  options = { scope: basePath + '/' };
                } else if (typeof options.scope === 'string') {
                  const s = options.scope;
                  if (s.startsWith('/') && !s.startsWith(basePath) && !s.startsWith('//')) {
                    options = Object.assign({}, options, { scope: basePath + s });
                  }
                }
              } catch(_) {}
              return originalRegister(scriptURL, options);
            };
          }
        } catch(_) {}
      })();
    </script>
  `;
  
  return html.replace('</body>', interceptorScript + '</body>');
}

// Radon Games CDN proxy - MUST BE FIRST to intercept CDN requests
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

// Radon Games proxy dependencies - serve BEFORE catch-all route
app.use('/radon-g3mes/baremux', express.static(path.join(__dirname, '..', 'radon-games', 'dist', 'baremux')));
app.use('/radon-g3mes/libcurl', express.static(path.join(__dirname, '..', 'radon-games', 'dist', 'libcurl')));
app.use('/radon-g3mes/epoxy', express.static(path.join(__dirname, '..', 'radon-games', 'dist', 'epoxy')));
app.use('/radon-g3mes/scram', express.static(path.join(__dirname, '..', 'radon-games', 'dist', 'scram')));

// Radon Games assets - serve ONLY /assets/ folder, not everything
app.use('/radon-g3mes/assets', express.static(path.join(__dirname, '..', 'radon-games', 'dist', 'assets')));

// ----- Radon fallback helpers -----
function generateGameList() {
  const fs = require('fs');
  const gamesDir = path.join(__dirname, 'public', 'games');
  if (!fs.existsSync(gamesDir)) return [];
  return fs.readdirSync(gamesDir)
    .filter(f => f.endsWith('.html'))
    .map(f => {
      const id = f.replace(/\.html$/,'');
      const title = id.replace(/-/g,' ') // Replace dashes with spaces
        .replace(/\b\w/g, c => c.toUpperCase()); // Capitalize words
      return { id, title };
    });
}

// Radon Games static files - serve JSON, JS, and other static files BEFORE catch-all
app.get('/radon-g3mes/games.json', (req, res) => {
  const filePath = path.join(__dirname, '..', 'radon-games', 'dist', 'games.json');
  const fs = require('fs');
  if (!fs.existsSync(filePath)) {
    // Return an array to mimic original games.json expectations
    const list = generateGameList().map(g => ({
      id: g.id,
      title: g.title,
      category: 'fallback',
      thumbnail: `/radon-g3mes/assets/placeholder.png`,
      source: 'fallback'
    }));
    return res.json(list);
  }
  res.sendFile(filePath);
});

app.get('/radon-g3mes/sw.js', (req, res) => {
  const filePath = path.join(__dirname, '..', 'radon-games', 'dist', 'sw.js');
  const fs = require('fs');
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('// Service worker not found');
  }
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(filePath);
});

app.get('/radon-g3mes/check.svg', (req, res) => {
  const filePath = path.join(__dirname, '..', 'radon-games', 'dist', 'check.svg');
  const fs = require('fs');
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('<!-- SVG not found -->');
  }
  res.sendFile(filePath);
});

app.get('/radon-g3mes/favicon.ico', (req, res) => {
  const filePath = path.join(__dirname, '..', 'radon-games', 'dist', 'favicon.ico');
  const fs = require('fs');
  if (!fs.existsSync(filePath)) {
    return res.status(404).end();
  }
  res.sendFile(filePath);
});

// Radon supplemental API (must be BEFORE catch-all)
app.get('/radon-g3mes/api/games', (req, res) => {
  try {
    const fs = require('fs');
    const radonGamesJson = path.join(__dirname, '..', 'radon-games', 'dist', 'games.json');
    if (fs.existsSync(radonGamesJson)) {
      const raw = fs.readFileSync(radonGamesJson, 'utf8');
      const arr = JSON.parse(raw);
      const games = Array.isArray(arr)
        ? arr.map(x => ({ id: x.id, title: x.title || x.id }))
        : [];
      return res.json({ source: 'radon-dist', count: games.length, games });
    }
  } catch (e) {
    console.warn('Failed reading radon games.json:', e.message);
  }
  const fallback = generateGameList();
  res.json({ source: 'fallback-local', count: fallback.length, games: fallback });
});
app.get('/radon-g3mes/api/search', (req, res) => {
  const q = (req.query.q || '').toString().toLowerCase();
  let games = [];
  try {
    const fs = require('fs');
    const radonGamesJson = path.join(__dirname, '..', 'radon-games', 'dist', 'games.json');
    if (fs.existsSync(radonGamesJson)) {
      const raw = fs.readFileSync(radonGamesJson, 'utf8');
      const arr = JSON.parse(raw);
      games = Array.isArray(arr)
        ? arr.map(x => ({ id: x.id, title: x.title || x.id }))
        : [];
    } else {
      games = generateGameList();
    }
  } catch (e) {
    console.warn('Search using fallback due to error:', e.message);
    games = generateGameList();
  }
  const filtered = q
    ? games.filter(g => (g.title || '').toLowerCase().includes(q) || (g.id || '').toLowerCase().includes(q))
    : games;
  res.json({ query: q, count: filtered.length, games: filtered });
});

// Radon Games main route - serve index.html
app.get('/radon-g3mes', (req, res) => {
  const fs = require('fs');
  const distPath = path.join(__dirname, '..', 'radon-games', 'dist', 'index.html');
  
  if (!fs.existsSync(distPath)) {
    const games = generateGameList();
    return res.status(200).send(`<!DOCTYPE html>
    <html lang=\"en\">
    <head>
      <meta charset=\"UTF-8\" />
      <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\" />
      <title>Radon Portal (Fallback)</title>
      <style>
        body {font-family: system-ui, Arial; margin:0; background:#111; color:#eee;}
        header {padding:20px; background:#222; display:flex; justify-content:space-between; align-items:center;}
        h1 {margin:0; font-size:1.2rem;}
        a {color:#6cf; text-decoration:none;}
        .layout {display:grid; grid-template-columns:300px 1fr; gap:20px; padding:20px;}
        .panel {background:#1d1d1d; border:1px solid #2e2e2e; border-radius:8px; padding:15px; height:calc(100vh - 100px); overflow:auto;}
        input[type=text]{width:100%; padding:8px 10px; border-radius:6px; border:1px solid #333; background:#111; color:#eee;}
        ul {list-style:none; padding:0; margin:10px 0 0;}
        li {padding:8px 10px; margin:4px 0; background:#242424; border-radius:6px; cursor:pointer; transition:.15s; font-size:.9rem;}
        li:hover {background:#333;}
        li.active {background:#6c3; color:#000; font-weight:600;}
        iframe {width:100%; height:100%; border:0; background:#000;}
        .empty {opacity:.6; font-size:.9rem; margin-top:10px;}
        footer {text-align:center; padding:10px; font-size:.7rem; opacity:.5;}
      </style>
    </head>
    <body>
      <header>
        <h1>⚡ Radon Portal <small style=\"opacity:.6; font-weight:400;\">Fallback Mode</small></h1>
        <nav><a href=\"/\">Home</a> · <a href=\"/ghub\">GameHub</a></nav>
      </header>
      <div class=\"layout\">
        <div class=\"panel\">
          <input type=\"text\" id=\"searchInput\" placeholder=\"Search games... (${games.length})\" />
          <ul id=\"gameList\"></ul>
          <div class=\"empty\" id=\"emptyMsg\" style=\"display:none;\">No games match your search.</div>
        </div>
        <div class=\"panel\">
          <iframe id=\"gameFrame\" title=\"Game Frame\" src=\"\" allowfullscreen></iframe>
        </div>
      </div>
      <footer>Radon Portal fallback – original SPA assets missing.</footer>
      <script src=\"/js/radon-search.js\"></script>
    </body>
    </html>`);
  }
  
  let html = fs.readFileSync(distPath, 'utf8');
  html = prepareRadonHtml(html);
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Radon Games proxy route - web proxy functionality  
app.get('/radon-g3mes/proxy', (req, res) => {
  const fs = require('fs');
  const distPath = path.join(__dirname, '..', 'radon-games', 'dist', 'index.html');
  
  if (!fs.existsSync(distPath)) {
    return res.redirect('/radon-g3mes');
  }
  
  let html = fs.readFileSync(distPath, 'utf8');
  html = prepareRadonHtml(html);
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Radon Games search route - handle search functionality
app.get('/radon-g3mes/search', (req, res) => {
  const fs = require('fs');
  const distPath = path.join(__dirname, '..', 'radon-games', 'dist', 'index.html');
  
  if (!fs.existsSync(distPath)) {
    return res.redirect('/radon-g3mes');
  }
  
  let html = fs.readFileSync(distPath, 'utf8');
  html = prepareRadonHtml(html);
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Radon Games game route - specific game pages
app.get('/radon-g3mes/game/:gameid', (req, res) => {
  const fs = require('fs');
  const distPath = path.join(__dirname, '..', 'radon-games', 'dist', 'index.html');
  
  if (!fs.existsSync(distPath)) {
    return res.redirect('/radon-g3mes');
  }
  
  let html = fs.readFileSync(distPath, 'utf8');
  html = prepareRadonHtml(html);
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Radon Games catch-all for client-side routing (MUST be LAST after all specific routes)
app.get('/radon-g3mes/*', (req, res) => {
  const fs = require('fs');
  const distPath = path.join(__dirname, '..', 'radon-games', 'dist', 'index.html');
  
  if (!fs.existsSync(distPath)) {
    return res.status(404).send('Radon Games not available');
  }
  
  let html = fs.readFileSync(distPath, 'utf8');
  html = prepareRadonHtml(html);
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// ===== Secret Media Player =====
app.get('/media-player', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'media-player.html'));
});
// Stream YouTube video (ad-free)
app.get('/media-player/stream', async (req, res) => {
  try {
    const raw = req.query.url;
    const itag = req.query.itag;
    if (!raw) return res.status(400).json({ error: 'Missing url parameter' });
    const videoUrl = decodeURIComponent(raw);
    const isYoutube = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(videoUrl);
    if (!isYoutube) return res.status(400).json({ error: 'Only YouTube URLs supported' });
    
    const info = await fetchYoutubeInfoStable(videoUrl);

    function pickBest(formats) {
      let candidates = formats.filter(f => f.hasVideo && f.hasAudio && (f.container === 'mp4' || /mp4/.test(f.mimeType||'')));
      if (!candidates.length) candidates = formats.filter(f => f.hasVideo && f.hasAudio);
      if (!candidates.length) candidates = formats.filter(f => f.hasVideo);
      candidates.sort((a,b)=>( (b.height||0)-(a.height||0) ) || ((b.bitrate||0)-(a.bitrate||0)) );
      return candidates[0];
    }

    let format;
    if (itag) {
      format = info.formats.find(f => String(f.itag) === String(itag));
    }
    if (!format) {
      format = pickBest(info.formats);
    }
    if (!format) {
      // Final fallback to itag 18 (baseline mp4 360p)
      format = info.formats.find(f => f.itag == 18);
    }
    if (!format) return res.status(500).json({ error: 'No suitable format found' });

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Selected-Itag', format.itag || 'unknown');
    res.setHeader('X-Selected-Quality', format.qualityLabel || 'unknown');

    // Stream via yt-dlp direct URL (no 410 issues)
    const https = require('https');
    const http = require('http');
    const formatUrl = format.url;
    if (!formatUrl) return res.status(500).json({ error: 'Format URL not available' });
    const protocol = formatUrl.startsWith('https') ? https : http;
    protocol.get(formatUrl, proxyRes => {
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'video/mp4');
      if (proxyRes.headers['content-length']) res.setHeader('Content-Length', proxyRes.headers['content-length']);
      proxyRes.pipe(res);
    }).on('error', err => {
      console.error('Stream proxy error:', err.message);
      if (!res.headersSent) res.status(500).json({ error: 'Stream failed', details: err.message });
    });
  } catch (err) {
    console.error('Media stream error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to stream video', message: err.message });
  }
});
// Download YouTube video
app.get('/media-player/download', async (req, res) => {
  try {
    const raw = req.query.url;
    if (!raw) return res.status(400).json({ error: 'Missing url parameter' });
    const url = decodeURIComponent(raw);
    const isYoutube = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(url);
    if (!isYoutube) return res.status(400).json({ error: 'Only YouTube URLs supported' });
    const info = await fetchYoutubeInfoStable(url);
    const titleSafe = info.videoDetails.title.replace(/[^a-z0-9\-_ ]/gi,'').slice(0,80) || 'video';
    res.setHeader('Content-Disposition', `attachment; filename="${titleSafe}.mp4"`);
    res.setHeader('Content-Type', 'video/mp4');
    const combined = info.formats.filter(f => f.hasVideo && f.hasAudio).sort((a,b)=>b.bitrate-a.bitrate)[0];
    const format = combined || info.formats.find(f => f.itag == '18');
    if (!format || !format.url) return res.status(500).json({ error: 'No downloadable format' });
    const https = require('https');
    const http = require('http');
    const protocol = format.url.startsWith('https') ? https : http;
    protocol.get(format.url, proxyRes => {
      if (proxyRes.headers['content-length']) res.setHeader('Content-Length', proxyRes.headers['content-length']);
      proxyRes.pipe(res);
    }).on('error', e => {
      console.error('Download error:', e.message);
      if (!res.headersSent) res.status(500).end();
    });
  } catch (err) {
    console.error('Media download error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to download video', message: err.message });
  }
});

// Expose format info for debugging / quality selection
app.get('/media-player/info', async (req, res) => {
  try {
    const raw = req.query.url;
    if (!raw) return res.status(400).json({ error: 'Missing url parameter' });
    const videoUrl = decodeURIComponent(raw);
    const isYoutube = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(videoUrl);
    if (!isYoutube) return res.status(400).json({ error: 'Only YouTube URLs supported' });
    const info = await fetchYoutubeInfoStable(videoUrl);
    const formats = info.formats
      .filter(f => f.hasVideo)
      .map(f => ({
        itag: f.itag,
        qualityLabel: f.qualityLabel,
        container: f.container,
        hasAudio: !!f.hasAudio,
        hasVideo: !!f.hasVideo,
        bitrate: f.bitrate,
        mimeType: f.mimeType,
        approxDurationMs: f.approxDurationMs
      }))
      .sort((a,b)=>{
        const hA = parseInt(a.qualityLabel) || 0; const hB = parseInt(b.qualityLabel) || 0;
        return hB - hA;
      });
    res.json({ title: info.videoDetails.title, formats });
  } catch (err) {
    console.error('Info fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch info', message: err.message });
  }
});

// Static files for games
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Start server
server.listen(PORT, () => {
  console.log(`🎮 GameHub server running on port ${PORT}`);
  console.log(`🌐 Landing page: http://localhost:${PORT}/`);
  console.log(`🎰 GameHub: http://localhost:${PORT}/ghub`);
  console.log(`🦆 DuckMath: http://localhost:${PORT}/duckmath`);
  console.log(`⚡ Radon Portal: http://localhost:${PORT}/radon-g3mes`);
});
      // Basic routes
app.get('/games/:gameId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'games', `${req.params.gameId}.html`));
});

// 404 handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});
