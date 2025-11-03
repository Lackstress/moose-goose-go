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

// Initialize Multiplayer Manager
const multiplayerManager = new MultiplayerManager(io);

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
  
  // Rewrite all root-relative links to include /duckmath prefix, but keep external URLs and anchor links
  // Match href="/" but skip: duckmath/ prefix, protocol-relative //, http/https, anchors #
  html = html.replace(/href="\/(?!duckmath\/|\/\/|https?:|#)/g, 'href="/duckmath/');
  html = html.replace(/src="\/(?!duckmath\/|\/\/|https?:|#)/g, 'src="/duckmath/');
  
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
  
  // Rewrite all root-relative links to include /duckmath prefix, but keep external URLs and anchor links
  // Match href="/" but skip: duckmath/ prefix, protocol-relative //, http/https, anchors #
  html = html.replace(/href="\/(?!duckmath\/|\/\/|https?:|#)/g, 'href="/duckmath/');
  html = html.replace(/src="\/(?!duckmath\/|\/\/|https?:|#)/g, 'src="/duckmath/');
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// DuckMath game page - serve with asset path rewriting (handles both with and without query params)
// Redirect individual game files to query parameter format
// E.g., /duckmath/g4m3s/slope.html -> /duckmath/g4m3s/?title=Slope
app.get('/duckmath/g4m3s/:gameFile', (req, res) => {
  const gameFile = req.params.gameFile;
  // Extract game name from filename (e.g., "slope.html" -> "Slope")
  const gameName = gameFile
    .replace(/\.html$/, '')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('-');
  
  res.redirect(`/duckmath/g4m3s/?title=${gameName}`);
});

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
  
  // Rewrite all root-relative links to include /duckmath prefix, but keep external URLs and anchor links
  // Match href="/" but skip: duckmath/ prefix, protocol-relative //, http/https, anchors #
  html = html.replace(/href="\/(?!duckmath\/|\/\/|https?:|#)/g, 'href="/duckmath/');
  html = html.replace(/src="\/(?!duckmath\/|\/\/|https?:|#)/g, 'src="/duckmath/');
  
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

// Redirect DuckMath HTML files that are accessed without the /duckmath prefix
app.get('/leaderboard.html', (req, res) => {
  res.redirect('/duckmath/leaderboard.html');
});

app.get('/about.html', (req, res) => {
  res.redirect('/duckmath/about.html');
});

// DuckMath JavaScript file rewriting - all JS files for better compatibility
app.get('/duckmath/assets/js/*.js', (req, res) => {
  const fs = require('fs');
  const jsFile = req.params[0];
  const filePath = path.join(__dirname, '..', 'duckmath', 'assets', 'js', `${jsFile}.js`);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('// File not found');
  }
  
  let js = fs.readFileSync(filePath, 'utf8');
  
  // Rewrite navigation links and paths to stay within /duckmath context
  js = js.replaceAll('href="/"', 'href="/duckmath"');
  js = js.replaceAll('href="/index.html"', 'href="/duckmath"');
  js = js.replaceAll('action="/"', 'action="/duckmath"');
  js = js.replaceAll('url("/', 'url("/duckmath/');
  js = js.replaceAll('src="/', 'src="/duckmath/');
  js = js.replaceAll("href='/'", "href='/duckmath'");
  js = js.replaceAll("src='/'", "src='/duckmath/'");
  js = js.replaceAll('window.location.href = "/"', 'window.location.href = "/duckmath"');
  js = js.replaceAll("window.location.href = '/'", "window.location.href = '/duckmath'");
  
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(js);
});

// DuckMath static assets with custom handler for HTML files
// This creates a custom handler that intercepts HTML files for rewriting
const duckmathDir = path.join(__dirname, '..', 'duckmath');
app.use('/duckmath', (req, res, next) => {
  const fs = require('fs');
  const filePath = path.join(__dirname, '..', 'duckmath', req.path);
  
  // Only handle .html files - let other files be served by static middleware
  if (filePath.endsWith('.html') && fs.existsSync(filePath)) {
    let html = fs.readFileSync(filePath, 'utf8');
    
    // Rewrite specific asset paths to include /duckmath prefix
    html = html.replaceAll('href="/assets/', 'href="/duckmath/assets/');
    html = html.replaceAll('src="/assets/', 'src="/duckmath/assets/');
    html = html.replaceAll('href="/g4m3s/', 'href="/duckmath/g4m3s/');
    html = html.replaceAll('src="/g4m3s/', 'src="/duckmath/g4m3s/');
    html = html.replaceAll('href="/more/', 'href="/duckmath/more/');
    html = html.replaceAll('src="/more/', 'src="/duckmath/more/');
    html = html.replaceAll('href="/blog/', 'href="/duckmath/blog/');
    html = html.replaceAll('src="/blog/', 'src="/duckmath/blog/');
    html = html.replaceAll('href="/leaderboard', 'href="/duckmath/leaderboard');
    html = html.replaceAll('href="/about', 'href="/duckmath/about');
    
    // Rewrite relative paths that don't start with / or protocol
    // Only match relative paths like: g4m3s/file, more/file, but NOT http://
    html = html.replace(/href="(?!(?:https?:|\/|#))([a-z\-\/\.]+)/gi, 'href="/duckmath/$1');
    html = html.replace(/src="(?!(?:https?:|\/|#))([a-z\-\/\.]+)/gi, 'src="/duckmath/$1');
    
    // Rewrite all root-relative links to include /duckmath prefix
    // Match href="/" but skip: duckmath/ prefix, protocol-relative //, http/https, anchors #
    html = html.replace(/href="\/(?!duckmath\/|\/\/|https?:|#)/g, 'href="/duckmath/');
    html = html.replace(/src="\/(?!duckmath\/|\/\/|https?:|#)/g, 'src="/duckmath/');
    
    // Inject client-side script to fix dynamically created links
    const fixDynamicLinksScript = `
    <script>
      (function() {
        const basePath = '/duckmath';
        
        // Function to fix all relative and root-relative links
        function fixAllLinks() {
          document.querySelectorAll('a[href], img[src], script[src], link[href]').forEach(el => {
            const attr = el.getAttribute('href') || el.getAttribute('src');
            if (attr && typeof attr === 'string') {
              // Fix relative paths like g4m3s/, more/, blog/
              if (!attr.startsWith('/') && !attr.startsWith('http') && !attr.startsWith('#')) {
                if (el.hasAttribute('href')) el.setAttribute('href', basePath + '/' + attr);
                else if (el.hasAttribute('src')) el.setAttribute('src', basePath + '/' + attr);
              }
              // Fix root-relative paths that don't have duckmath prefix
              else if (attr.startsWith('/') && !attr.startsWith(basePath) && !attr.startsWith('//') && !attr.startsWith('/http')) {
                if (el.hasAttribute('href')) el.setAttribute('href', basePath + attr);
                else if (el.hasAttribute('src')) el.setAttribute('src', basePath + attr);
              }
            }
          });
        }
        
        // Run on page load
        fixAllLinks();
        
        // Also run when DOM changes (for dynamically added content)
        const observer = new MutationObserver(fixAllLinks);
        observer.observe(document.body, { childList: true, subtree: true });
      })();
    </script>
    `;
    
    // Insert before closing body tag
    html = html.replace('</body>', fixDynamicLinksScript + '</body>');
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }
  
  // For non-HTML files or files that don't exist, use static middleware
  next();
});

// DuckMath static file serving
app.use('/duckmath', express.static(path.join(__dirname, '..', 'duckmath')));

// Helper function to inject Radon Games base path interceptor
function injectRadonInterceptor(html) {
  const interceptorScript = `
    <script>
      (function() {
        const basePath = '/radon-g3mes';
        
        // First, fix all existing href and src attributes on page load
        function fixAllLinks() {
          // Fix all anchor links
          document.querySelectorAll('a[href]').forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.startsWith('/') && !href.startsWith(basePath) && !href.startsWith('http') && !href.startsWith('//')) {
              link.setAttribute('href', basePath + href);
            }
          });
          
          // Fix all image sources
          document.querySelectorAll('img[src]').forEach(img => {
            const src = img.getAttribute('src');
            if (src && src.startsWith('/') && !src.startsWith(basePath) && !src.startsWith('http') && !src.startsWith('//')) {
              img.setAttribute('src', basePath + src);
            }
          });
          
          // Fix all iframe sources (CRITICAL FOR GAMES)
          document.querySelectorAll('iframe[src]').forEach(iframe => {
            const src = iframe.getAttribute('src');
            if (src && src.startsWith('/') && !src.startsWith(basePath) && !src.startsWith('http') && !src.startsWith('//')) {
              iframe.setAttribute('src', basePath + src);
            }
          });
          
          // Fix form actions
          document.querySelectorAll('form[action]').forEach(form => {
            const action = form.getAttribute('action');
            if (action && action.startsWith('/') && !action.startsWith(basePath) && !action.startsWith('http') && !action.startsWith('//')) {
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
          
          // Skip external links and already-prefixed links and anchor links
          if (href.startsWith('http') || href.startsWith('//') || href.startsWith(basePath) || href.startsWith('#')) {
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

// Radon Games main route - serve index.html
app.get('/radon-g3mes', (req, res) => {
  const fs = require('fs');
  const distPath = path.join(__dirname, '..', 'radon-games', 'dist', 'index.html');
  
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

// Radon Games search route - handle search functionality
app.get('/radon-g3mes/search', (req, res) => {
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
