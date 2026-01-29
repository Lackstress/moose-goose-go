const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const socketIO = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const ytsearch = require('yt-search');
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

// Helper function for making HTTPS requests with redirect support
function httpsGet(url, options = {}, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: options.headers || {}
    };
    
    https.get(requestOptions, (res) => {
      // Handle redirects (302, 301, etc.)
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303 || res.statusCode === 307) && res.headers.location) {
        if (redirectCount >= 5) {
          return reject(new Error('Too many redirects'));
        }
        
        const redirectUrl = new URL(res.headers.location, url);
        console.log(`Following redirect (${res.statusCode}) to: ${redirectUrl.pathname.substring(0, 50)}...`);
        
        // Follow redirect
        return httpsGet(redirectUrl.toString(), options, redirectCount + 1)
          .then(resolve)
          .catch(reject);
      }
      
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          statusCode: res.statusCode,
          text: () => Promise.resolve(data),
          json: () => {
            try {
              return Promise.resolve(JSON.parse(data));
            } catch (e) {
              return Promise.reject(e);
            }
          }
        });
      });
    }).on('error', (err) => {
      console.error('HTTPS request error:', err.message);
      reject(err);
    });
  });
}

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

    // Rewrite absolute asset and link paths to live under /duckmath (handle both double and single quotes)
    // Avoid touching fully-qualified URLs (http/https) or protocol-relative (//)
    html = html.replace(/href=(["'])\/(?!duckmath|http|https|\/)/g, 'href=$1/duckmath/');
    
    // Rewrite relative paths (../) - handle both quote types
    html = html.replace(/href=(["'])\.\.\/([^"']+)\1/g, (match, quote, capture) => {
      const upOneLevelPath = '/duckmath/';
      return `href=${quote}${upOneLevelPath}${capture}${quote}`;
    });
    
    // Rewrite CSS url() paths in inline styles (e.g., url('../images/...') or url(/images/...))
    html = html.replace(/url\(['"]?\.\.\/([^'")]+)['"]?\)/g, 'url("/duckmath/$1")');
    html = html.replace(/url\(['"]?\/(?!duckmath|http|https|\/)([^'")]+)['"]?\)/g, 'url("/duckmath/$1")');

    // Inject comprehensive runtime interceptor IMMEDIATELY after base tag (before any scripts run)
    // This ensures path fixing happens before JavaScript executes
      const interceptor = `
        <script>
          (function(){
            var basePath = '/duckmath';
            
            function shouldExclude(path) {
              if (!path || !path.startsWith('/')) return true;
              if (path.startsWith('http') || path.startsWith('//')) return true;
              if (path.startsWith(basePath)) return true;
              return false;
            }
            
            function fixAllAssets(){
              try {
                // Fix all anchor links
                document.querySelectorAll('a[href]').forEach(function(a){
                  var href = a.getAttribute('href');
                  if (href && !shouldExclude(href)) {
                    a.setAttribute('href', basePath + href);
                  }
                });
                
                // Fix all image sources
                document.querySelectorAll('img[src]').forEach(function(img){
                  var src = img.getAttribute('src');
                  if (src && !shouldExclude(src)) {
                    img.setAttribute('src', basePath + src);
                  }
                });
                
                // Fix all script sources
                document.querySelectorAll('script[src]').forEach(function(script){
                  var src = script.getAttribute('src');
                  if (src && !shouldExclude(src)) {
                    script.setAttribute('src', basePath + src);
                  }
                });
                
                // Fix all link stylesheet hrefs
                document.querySelectorAll('link[href]').forEach(function(link){
                  var href = link.getAttribute('href');
                  if (href && !shouldExclude(href)) {
                    link.setAttribute('href', basePath + href);
                  }
                });
                
                // Fix all iframe sources (CRITICAL FOR GAMES)
                document.querySelectorAll('iframe[src]').forEach(function(iframe){
                  var src = iframe.getAttribute('src');
                  if (src && !shouldExclude(src)) {
                    iframe.setAttribute('src', basePath + src);
                  }
                });
                
                // Fix all source elements (audio/video)
                document.querySelectorAll('source[src]').forEach(function(source){
                  var src = source.getAttribute('src');
                  if (src && !shouldExclude(src)) {
                    source.setAttribute('src', basePath + src);
                  }
                });
                
                // Fix form actions
                document.querySelectorAll('form[action]').forEach(function(form){
                  var action = form.getAttribute('action');
                  if (action && !shouldExclude(action)) {
                    form.setAttribute('action', basePath + action);
                  }
                });
              } catch(_) {}
            }
            
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', fixAllAssets);
            } else {
              fixAllAssets();
            }
            
            // Intercept clicks as a safety net for links mutated after load
            document.addEventListener('click', function(e){
              var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
              if (!a) return;
              var href = a.getAttribute('href');
              if (!href) return;
              if (href.startsWith('/') && !shouldExclude(href)) {
                e.preventDefault();
                window.location.href = basePath + href;
              }
            }, true);
            
            // Observe DOM mutations for dynamically inserted content
            try {
              var mo = new MutationObserver(function(){ fixAllAssets(); });
              mo.observe(document.documentElement || document.body, { 
                childList: true, 
                subtree: true, 
                attributes: true, 
                attributeFilter: ['href', 'src', 'action'] 
              });
            } catch(_) {}
            
            // Re-run periodically as a fallback to catch any missed changes
            setInterval(fixAllAssets, 500);
            
            // Intercept fetch requests to fix API calls and asset loading
            var originalFetch = window.fetch;
            window.fetch = function(url, options) {
              if (typeof url === 'string' && url.startsWith('/') && !shouldExclude(url)) {
                url = basePath + url;
              }
              return originalFetch.call(this, url, options);
            };
            
            // Fix XMLHttpRequest for legacy AJAX
            var originalOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url, ...args) {
              if (typeof url === 'string' && url.startsWith('/') && !shouldExclude(url)) {
                url = basePath + url;
              }
              return originalOpen.call(this, method, url, ...args);
            };
            
            // Intercept fetch requests to fix API calls and asset loading
            var originalFetch = window.fetch;
            window.fetch = function(url, options) {
              if (typeof url === 'string' && url.startsWith('/') && !shouldExclude(url)) {
                url = basePath + url;
              }
              return originalFetch.call(this, url, options);
            };
            
            // Fix XMLHttpRequest for legacy AJAX
            var originalOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url, ...args) {
              if (typeof url === 'string' && url.startsWith('/') && !shouldExclude(url)) {
                url = basePath + url;
              }
              return originalOpen.call(this, method, url, ...args);
            };
          })();
        </script>
      `;
      // Inject interceptor right after base tag in head, or before closing head tag
      if (html.includes('</head>')) {
        html = html.replace('</head>', interceptor + '</head>');
      } else {
        html = html.replace('</body>', interceptor + '</body>');
      }
    html = html.replace(/src=(["'])\/(?!duckmath|http|https|\/)/g, 'src=$1/duckmath/');
    
    // Rewrite relative paths for src attributes
    html = html.replace(/src=(["'])\.\.\/([^"']+)\1/g, (match, quote, capture) => {
      const upOneLevelPath = '/duckmath/';
      return `src=${quote}${upOneLevelPath}${capture}${quote}`;
    });

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
// Intercept CSS files to rewrite absolute URL paths for DuckMath (must be BEFORE static middleware)
app.get(/^\/duckmath\/.*\.css$/i, async (req, res, next) => {
  try {
    const fs = require('fs');
    const relativePath = req.path.replace(/^\/duckmath\//, '');
    const cssPath = path.join(duckmathPath, relativePath);
    if (fs.existsSync(cssPath) && fs.statSync(cssPath).isFile()) {
      let css = await fs.promises.readFile(cssPath, 'utf-8');
      
      // Get the directory of the CSS file relative to duckmath root
      const cssDir = path.dirname(relativePath).replace(/\\/g, '/');
      
      // Rewrite absolute url() paths in CSS to include /duckmath/ prefix
      css = css.replace(/url\(['"]?\/(?!duckmath|http|https|\/)([^'")]+)['"]?\)/g, 'url("/duckmath/$1")');
      
      // Rewrite relative url() paths in CSS - properly resolve relative to CSS file location
      css = css.replace(/url\(['"]?\.\.\/([^'")]+)['"]?\)/g, (match, urlPath) => {
        // Calculate the actual path: go up one level from CSS dir, then append the url path
        const parts = cssDir.split('/').filter(p => p);
        if (parts.length > 0) parts.pop(); // Go up one directory
        const resolvedPath = parts.length > 0 ? parts.join('/') + '/' + urlPath : urlPath;
        return `url("/duckmath/${resolvedPath}")`;
      });
      
      // Rewrite relative paths without ../ (relative to CSS file's directory)
      css = css.replace(/url\(['"]?([^'"/"\.\.][^'")]*?)['"]?\)/g, (match, urlPath) => {
        // Only process if it's not already absolute, http, or starts with ../
        if (urlPath.startsWith('/') || urlPath.startsWith('http') || urlPath.startsWith('data:') || urlPath.startsWith('../')) {
          return match; // Leave as-is
        }
        // Make it relative to the CSS file's directory
        const cssDirForRel = cssDir || '';
        const fullPath = cssDirForRel ? cssDirForRel + '/' + urlPath : urlPath;
        return `url("/duckmath/${fullPath}")`;
      });
      
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      return res.send(css);
    }
  } catch (e) {
    console.error('Failed to serve DuckMath CSS file:', e);
  }
  next();
});

// Intercept JavaScript files to rewrite absolute paths in JS code (must be BEFORE static middleware)
app.get(/^\/duckmath\/.*\.js$/i, async (req, res, next) => {
  try {
    const fs = require('fs');
    const jsPath = path.join(duckmathPath, req.path.replace(/^\/duckmath\//, ''));
    if (fs.existsSync(jsPath) && fs.statSync(jsPath).isFile()) {
      let js = await fs.promises.readFile(jsPath, 'utf-8');
      
      // Rewrite absolute paths in string literals (e.g., fetch('/api/...') or '/images/...')
      // Be careful not to break code - only match common patterns
      js = js.replace(/(['"])\/(?!duckmath|http|https|\/)([^'"]+)\1/g, (match, quote, path) => {
        // Skip if it looks like a regex pattern, comment, or special case
        if (path.includes('*') || path.includes('+') || path.includes('?') || path.includes('\\')) {
          return match;
        }
        return quote + '/duckmath/' + path + quote;
      });
      
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      return res.send(js);
    }
  } catch (e) {
    console.error('Failed to serve DuckMath JS file:', e);
  }
  next();
});

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
        
        // Rewrite absolute paths (handle both double and single quotes)
        html = html.replace(/href=(["'])\/(?!duckmath|http|https|\/)/g, 'href=$1/duckmath/');
        html = html.replace(/src=(["'])\/(?!duckmath|http|https|\/)/g, 'src=$1/duckmath/');
        
        // Rewrite relative paths (../) - handle both quote types
        html = html.replace(/href=(["'])\.\.\/([^"']+)\1/g, (match, quote, capture) => {
          const upOneLevelPath = '/duckmath/';
          return `href=${quote}${upOneLevelPath}${capture}${quote}`;
        });
        html = html.replace(/src=(["'])\.\.\/([^"']+)\1/g, (match, quote, capture) => {
          const upOneLevelPath = '/duckmath/';
          return `src=${quote}${upOneLevelPath}${capture}${quote}`;
        });
        
        // Rewrite CSS url() paths in inline styles
        html = html.replace(/url\(['"]?\.\.\/([^'")]+)['"]?\)/g, 'url("/duckmath/$1")');
        html = html.replace(/url\(['"]?\/(?!duckmath|http|https|\/)([^'")]+)['"]?\)/g, 'url("/duckmath/$1")');
        
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
  // Add base tag for React Router to help with routing - use robust regex to match <head> with optional attributes/whitespace
  html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n  <base href="/radon-g3mes/">`);
  
  // Rewrite asset paths - absolute paths (handle both double and single quotes)
  html = html.replace(/href=(["'])\/(?!radon-g3mes|http|https|\/|~)/g, 'href=$1/radon-g3mes/');
  html = html.replace(/src=(["'])\/(?!radon-g3mes|http|https|\/|~)/g, 'src=$1/radon-g3mes/');
  
  // Rewrite relative paths (../) - handle both quote types
  html = html.replace(/href=(["'])\.\.\/([^"']+)\1/g, (match, quote, capture) => {
    const upOneLevelPath = '/radon-g3mes/';
    return `href=${quote}${upOneLevelPath}${capture}${quote}`;
  });
  html = html.replace(/src=(["'])\.\.\/([^"']+)\1/g, (match, quote, capture) => {
    const upOneLevelPath = '/radon-g3mes/';
    return `src=${quote}${upOneLevelPath}${capture}${quote}`;
  });
  
  // Rewrite CSS url() paths in inline styles (e.g., url('../images/...') or url(/images/...))
  html = html.replace(/url\(['"]?\.\.\/([^'")]+)['"]?\)/g, 'url("/radon-g3mes/$1")');
  html = html.replace(/url\(['"]?\/(?!radon-g3mes|http|https|\/|~)([^'")]+)['"]?\)/g, 'url("/radon-g3mes/$1")');
  
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

// Fix Games link to redirect to working double-prefixed URL
app.get('/radon-g3mes/games', (req, res) => {
  res.redirect(301, '/radon-g3mes/radon-g3mes/games');
});

// Fix Proxy link to redirect to working double-prefixed URL
app.get('/radon-g3mes/proxy', (req, res) => {
  res.redirect(301, '/radon-g3mes/radon-g3mes/proxy');
});


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

// Intercept CSS files to rewrite absolute URL paths for Radon (must be BEFORE static middleware)
app.get(/^\/radon-g3mes\/.*\.css$/i, async (req, res, next) => {
  try {
    const fs = require('fs');
    const relativePath = req.path.replace(/^\/radon-g3mes\//, '');
    const cssPath = path.join(__dirname, '..', 'radon-games', 'dist', relativePath);
    if (fs.existsSync(cssPath) && fs.statSync(cssPath).isFile()) {
      let css = await fs.promises.readFile(cssPath, 'utf-8');
      
      // Get the directory of the CSS file relative to dist root (e.g., "assets/css")
      const cssDir = path.dirname(relativePath).replace(/\\/g, '/');
      
      // Rewrite absolute url() paths in CSS to include /radon-g3mes/ prefix
      css = css.replace(/url\(['"]?\/(?!radon-g3mes|http|https|\/|~)([^'")]+)['"]?\)/g, 'url("/radon-g3mes/$1")');
      
      // Rewrite relative url() paths with ../ - properly resolve relative to CSS file location
      css = css.replace(/url\(['"]?\.\.\/([^'")]+)['"]?\)/g, (match, urlPath) => {
        // Calculate the actual path: go up one level from CSS dir, then append the url path
        const parts = cssDir.split('/').filter(p => p);
        if (parts.length > 0) parts.pop(); // Go up one directory
        const resolvedPath = parts.length > 0 ? parts.join('/') + '/' + urlPath : urlPath;
        return `url("/radon-g3mes/${resolvedPath}")`;
      });
      
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      return res.send(css);
    }
  } catch (e) {
    console.error('Failed to serve Radon CSS file:', e);
  }
  next();
});

// Intercept JavaScript files to rewrite absolute paths in JS code for Radon (must be BEFORE static middleware)
app.get(/^\/radon-g3mes\/.*\.js$/i, async (req, res, next) => {
  try {
    const fs = require('fs');
    const jsPath = path.join(__dirname, '..', 'radon-games', 'dist', req.path.replace(/^\/radon-g3mes\//, ''));
    if (fs.existsSync(jsPath) && fs.statSync(jsPath).isFile()) {
      let js = await fs.promises.readFile(jsPath, 'utf-8');
      
      // Rewrite absolute paths in string literals (e.g., fetch('/api/...') or '/images/...')
      // Be careful not to break code - only match common patterns
      js = js.replace(/(['"])\/(?!radon-g3mes|http|https|\/|~)([^'"]+)\1/g, (match, quote, path) => {
        // Skip if it looks like a regex pattern, comment, or special case
        if (path.includes('*') || path.includes('+') || path.includes('?') || path.includes('\\')) {
          return match;
        }
        return quote + '/radon-g3mes/' + path + quote;
      });
      
      res.type('js').send(js);
      return;
    }
  } catch (error) {
    console.error('Error processing JS file:', error);
  }
  next();
});

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

// ===== Simple YouTube Media Player =====
app.get('/media-player', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'media-player.html'));
});

// ===== Spotify to YouTube Converter =====
app.get('/media-player/spotify-to-youtube', async (req, res) => {
  try {
    const { spotifyUrl } = req.query;
    
    if (!spotifyUrl) {
      return res.status(400).json({ error: 'Missing Spotify URL' });
    }

    // Extract Spotify ID and type
    const patterns = {
      track: /(?:https?:\/\/)?(?:open\.)?spotify\.com\/track\/([a-zA-Z0-9]{22})/,
      playlist: /(?:https?:\/\/)?(?:open\.)?spotify\.com\/playlist\/([a-zA-Z0-9]{22})/,
      album: /(?:https?:\/\/)?(?:open\.)?spotify\.com\/album\/([a-zA-Z0-9]{22})/,
      artist: /(?:https?:\/\/)?(?:open\.)?spotify\.com\/artist\/([a-zA-Z0-9]{22})/
    };

    let spotifyData = null;
    for (const [type, pattern] of Object.entries(patterns)) {
      const match = spotifyUrl.match(pattern);
      if (match) {
        spotifyData = { type, id: match[1] };
        console.log('Detected Spotify content:', { type: spotifyData.type, id: spotifyData.id, url: spotifyUrl });
        break;
      }
    }

    if (!spotifyData) {
      console.log('Failed to detect Spotify content type for URL:', spotifyUrl);
      return res.status(400).json({ error: 'Invalid Spotify URL' });
    }

    // Strategy: 
    // - Playlists and albums: Extract all tracks and convert to YouTube playlist
    // - Individual tracks: Convert to YouTube (since Spotify only gives 30-second preview)
    
    if (spotifyData.type === 'playlist' || spotifyData.type === 'album') {
      console.log(`\n🎵 PLAYLIST/ALBUM DETECTED - Using Spotify Web API to extract tracks`);
      
      try {
        // Step 1: Get Spotify access token using Client Credentials flow
        const clientId = process.env.SPOTIFY_CLIENT_ID;
        const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
        
        if (!clientId || !clientSecret) {
          console.log('❌ Spotify API credentials not found in .env file');
          throw new Error('Spotify API credentials not configured');
        }
        
        console.log('Getting Spotify access token...');
        
        // Get access token
        const tokenData = `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`;
        const tokenResponse = await new Promise((resolve, reject) => {
          const req = https.request({
            hostname: 'accounts.spotify.com',
            path: '/api/token',
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': tokenData.length
            }
          }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
              resolve({
                ok: res.statusCode >= 200 && res.statusCode < 300,
                statusCode: res.statusCode,
                json: () => Promise.resolve(JSON.parse(data))
              });
            });
          });
          req.on('error', reject);
          req.write(tokenData);
          req.end();
        });
        
        if (!tokenResponse.ok) {
          console.log(`❌ Token request failed with status ${tokenResponse.statusCode}`);
          throw new Error('Failed to get Spotify access token');
        }
        
        const tokenJson = await tokenResponse.json();
        const accessToken = tokenJson.access_token;
        console.log('✅ Got access token!');
        
        // Step 2: Fetch playlist/album data
        const apiPath = `/v1/${spotifyData.type}s/${spotifyData.id}`;
        console.log(`Fetching ${spotifyData.type} data from Spotify API...`);
        
        const playlistResponse = await httpsGet(`https://api.spotify.com${apiPath}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        if (!playlistResponse.ok) {
          console.log(`❌ API request failed with status ${playlistResponse.statusCode}`);
          throw new Error('Failed to fetch playlist data');
        }
        
        const playlistData = await playlistResponse.json();
        
        // Step 3: Extract ALL tracks with pagination support
        const tracks = [];
        let tracksData = playlistData?.tracks;
        
        // Process first page
        if (tracksData?.items) {
          for (const item of tracksData.items) {
            const track = item?.track || item;
            if (track?.name && track?.artists?.[0]?.name) {
              tracks.push({
                name: track.name,
                artist: track.artists[0].name,
                searchQuery: `${track.artists[0].name} ${track.name}`
              });
              console.log(`  ✓ ${track.artists[0].name} - ${track.name}`);
            }
          }
        }
        
        // Fetch remaining pages if playlist has more tracks
        while (tracksData?.next) {
          console.log(`Fetching next page... (${tracks.length} tracks so far)`);
          
          const nextResponse = await httpsGet(tracksData.next, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });
          
          if (nextResponse.ok) {
            tracksData = await nextResponse.json();
            
            for (const item of tracksData.items || []) {
              const track = item?.track || item;
              if (track?.name && track?.artists?.[0]?.name) {
                tracks.push({
                  name: track.name,
                  artist: track.artists[0].name,
                  searchQuery: `${track.artists[0].name} ${track.name}`
                });
                console.log(`  ✓ ${track.artists[0].name} - ${track.name}`);
              }
            }
          } else {
            console.log(`Failed to fetch next page, stopping pagination`);
            break;
          }
        }
        
        console.log(`\n✅ SUCCESS! Extracted ${tracks.length} tracks in total from Spotify ${spotifyData.type}`);
        
        if (tracks.length > 0) {
          console.log(`🎵 Sending ALL ${tracks.length} tracks to frontend for YouTube conversion\n`);
          
          return res.json({
            type: 'youtube_playlist_conversion',
            tracks: tracks, // Send ALL tracks (no limit!)
            originalUrl: spotifyUrl,
            spotifyData: spotifyData,
            message: `✅ Found ${tracks.length} tracks! Converting to YouTube queue...`
          });
        }
        
      } catch (apiError) {
        console.log('Spotify API error:', apiError.message);
      }
      
      // Fallback: Get playlist name and search YouTube for a PLAYLIST (not just the name)
      console.log(`Using fallback: searching YouTube for ${spotifyData.type} as a playlist...`);
      try {
        const oEmbedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`;
        const oEmbedResponse = await httpsGet(oEmbedUrl);
        
        if (oEmbedResponse.ok) {
          const oEmbedData = await oEmbedResponse.json();
          const title = oEmbedData.title || '';
          
          if (title) {
            console.log(`✅ Got ${spotifyData.type} name: "${title}"\n`);
            // Return a special type that tells frontend to search for YouTube playlist
            return res.json({
              type: 'youtube_playlist_search',
              query: title,
              originalSpotifyUrl: spotifyUrl,
              spotifyData: spotifyData,
              playlistSearch: true,
              message: `🔄 Searching YouTube for playlist: "${title}"`
            });
          }
        }
      } catch (oEmbedError) {
        console.log('oEmbed fallback failed:', oEmbedError.message);
      }
      
      console.log(`❌ All methods failed\n`);
      return res.json({
        type: 'conversion_failed',
        originalUrl: spotifyUrl,
        spotifyData: spotifyData,
        message: `Could not extract track list. Please check your Spotify API credentials.`
      });
    }
    
    // For tracks and artists, try to convert to YouTube
    console.log(`Converting ${spotifyData.type} to YouTube for full playback`);
    
    try {
      // Fetch metadata from Spotify using oEmbed API to get track name
      let searchQuery = '';
      
      try {
        // Use Spotify oEmbed API (no auth required) to get title
        const oEmbedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`;
        const oEmbedResponse = await httpsGet(oEmbedUrl);
        
        if (oEmbedResponse.ok) {
          const oEmbedData = await oEmbedResponse.json();
          const title = oEmbedData.title || '';
          
          if (title) {
            // Use the title as search query for YouTube
            searchQuery = title;
            console.log(`Extracted title from Spotify: ${title}`);
          }
        }
      } catch (oEmbedError) {
        console.log('oEmbed fetch failed, will use generic search:', oEmbedError.message);
      }
      
      // If we couldn't get the title, create a generic search query
      if (!searchQuery) {
        searchQuery = `spotify ${spotifyData.type} ${spotifyData.id}`;
      }
      
      return res.json({
        type: 'youtube_search',
        query: searchQuery,
        originalSpotifyUrl: spotifyUrl,
        spotifyData: spotifyData,
        message: `🔄 Converting ${spotifyData.type} to YouTube for full playback...`
      });
      
    } catch (error) {
      console.error('Conversion error:', error);
      // Fallback: still try YouTube search
      return res.json({
        type: 'youtube_search',
        query: `spotify ${spotifyData.type} ${spotifyData.id}`,
        originalSpotifyUrl: spotifyUrl,
        spotifyData: spotifyData,
        message: `🔄 Converting ${spotifyData.type} to YouTube for full playback...`
      });
    }

  } catch (error) {
    console.error('Spotify conversion error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Failed to process Spotify link', details: error.message });
  }
});

// ===== YouTube Search API (using yt-search with retry logic) =====
app.get('/media-player/youtube-search', async (req, res) => {
  try {
    const { query, type } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Missing search query' });
    }

    const isPlaylistSearch = type === 'playlist';
    console.log(`🔍 Searching YouTube for ${isPlaylistSearch ? 'playlist' : 'video'}: "${query}"`);
    
    // Retry logic with exponential backoff
    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Add delay between retries to avoid rate limiting
        if (attempt > 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 1s, 2s, 4s max
          console.log(`  Retry ${attempt}/${maxRetries} after ${delay}ms delay...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        // Use yt-search package with timeout
        const searchPromise = ytsearch(query);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Search timeout')), 10000)
        );
        
        const searchResults = await Promise.race([searchPromise, timeoutPromise]);
        
        // If searching for playlists, check playlists first
        if (isPlaylistSearch) {
          const playlists = searchResults?.playlists;
          
          if (playlists && playlists.length > 0) {
            const playlist = playlists[0];
            console.log(`✓ Found playlist: ${playlist.listId} - "${playlist.title}"`);
            
            return res.json({
              type: 'youtube_playlist',
              playlistId: playlist.listId,
              title: playlist.title,
              query: query,
              videoCount: playlist.videoCount,
              message: '✅ Found playlist on YouTube'
            });
          }
          
          // No playlists found, try to find a video that might be a full mix/compilation
          console.log(`  No playlists found, searching for video compilations...`);
        }
        
        // Get first video result
        const videos = searchResults?.videos;
        
        if (videos && videos.length > 0) {
          const video = videos[0];
          console.log(`✓ Found: ${video.videoId} - "${video.title}"`);
          
          return res.json({
            type: 'youtube_video',
            videoId: video.videoId,
            title: video.title,
            query: query,
            duration: video.timestamp,
            message: '✅ Found video on YouTube'
          });
        }
        
        // No videos found but search succeeded
        console.log(`✗ No results found for "${query}"`);
        return res.json({
          type: 'youtube_search_results',
          searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
          query: query,
          message: 'No results found'
        });
        
      } catch (searchError) {
        lastError = searchError;
        const errorMsg = searchError?.message || searchError?.toString() || 'Unknown error';
        console.error(`✗ Search attempt ${attempt}/${maxRetries} failed for "${query}": ${errorMsg}`);
        
        // If this was the last attempt, fall through to error handling
        if (attempt === maxRetries) {
          break;
        }
        // Otherwise, continue to next retry
      }
    }
    
    // All retries failed
    console.error(`✗ All ${maxRetries} attempts failed for "${query}"`);
    return res.json({
      type: 'youtube_search_results',
      searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      query: query,
      message: 'Search failed after retries',
      error: lastError?.message || 'Unknown error'
    });

  } catch (error) {
    console.error('YouTube search error:', error);
    res.status(500).json({ 
      error: 'Failed to search YouTube',
      message: error?.message || 'Unknown error'
    });
  }
});

// YouTube Search Results endpoint (returns multiple videos)
app.get('/media-player/youtube-search-results', async (req, res) => {
  try {
    const { query, maxResults = 12 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Missing search query' });
    }

    console.log(`🔍 Searching YouTube for multiple results: "${query}" (max: ${maxResults})`);
    
    try {
      // Use yt-search package with timeout
      const searchPromise = ytsearch(query);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Search timeout')), 15000)
      );
      
      const searchResults = await Promise.race([searchPromise, timeoutPromise]);
      
      // Get video results
      const videos = searchResults?.videos || [];
      
      if (videos.length > 0) {
        // Limit to maxResults
        const limitedVideos = videos.slice(0, parseInt(maxResults));
        
        // Format results
        const formattedResults = limitedVideos.map(video => ({
          videoId: video.videoId,
          title: video.title,
          thumbnail: video.thumbnail || `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`,
          channel: video.author?.name || video.author || 'Unknown Channel',
          duration: video.timestamp || '',
          views: video.views || 0,
          url: video.url || `https://www.youtube.com/watch?v=${video.videoId}`
        }));
        
        console.log(`✓ Found ${formattedResults.length} results for "${query}"`);
        
        return res.json({
          success: true,
          query: query,
          results: formattedResults,
          totalResults: formattedResults.length
        });
      }
      
      // No videos found
      console.log(`✗ No results found for "${query}"`);
      return res.json({
        success: false,
        query: query,
        results: [],
        totalResults: 0,
        message: 'No results found'
      });
      
    } catch (searchError) {
      console.error(`✗ Search failed for "${query}":`, searchError.message);
      return res.status(500).json({
        success: false,
        error: 'Search failed',
        message: searchError?.message || 'Unknown error',
        query: query,
        results: []
      });
    }

  } catch (error) {
    console.error('YouTube search results error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to search YouTube',
      message: error?.message || 'Unknown error',
      results: []
    });
  }
});

// Static files for games
// SERAPH GAMING HUB WITH DARK THEME
// ============================================================================

let seraphPath = path.join(__dirname, '..', 'seraph');
try {
  const fs = require('fs');
  if (!fs.existsSync(seraphPath)) {
    const fallback = path.join(__dirname, 'seraph');
    if (fs.existsSync(fallback)) {
      seraphPath = fallback;
    }
  }
} catch {}

const serveSeraphIndex = (req, res) => {
  const fs = require('fs');
  const indexPath = path.join(seraphPath, 'index.html');

  if (!fs.existsSync(indexPath)) {
    return res.status(404).send('Seraph is not installed.');
  }

  try {
    let html = fs.readFileSync(indexPath, 'utf8');

    // Inject base tag for proper routing
    html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n  <base href="/seraph/">`);

    // Rewrite asset paths
    html = html.replace(/href="\/(?!seraph|http|https|\/)/g, 'href="/seraph/');
    html = html.replace(/src="\/(?!seraph|http|https|\/)/g, 'src="/seraph/');
    
    // Rewrite CSS url() paths in style attributes (e.g., url('../images/...'))
    html = html.replace(/url\(['"]?\.\.\/([^'")]+)['"]?\)/g, 'url("/seraph/$1")');

    // Runtime interceptor for dynamic links
    const interceptor = `
      <script>
        (function(){
          var basePath = '/seraph';
          function fixLinks(){
            try {
              document.querySelectorAll('a[href]').forEach(function(a){
                var href = a.getAttribute('href');
                if (!href) return;
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
          try {
            var mo = new MutationObserver(function(){ fixLinks(); });
            mo.observe(document.documentElement || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
          } catch(_) {}
          setInterval(fixLinks, 300);
        })();
      </script>
    `;
    html = html.replace('</body>', interceptor + '</body>');

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (e) {
    console.error('Failed to serve Seraph index:', e);
    return res.status(500).send('Seraph failed to load.');
  }
};

// Seraph routes
app.get('/seraph', serveSeraphIndex);
app.get('/seraph/', serveSeraphIndex);
app.get('/seraph/index.html', serveSeraphIndex);
// Handle all HTML files in seraph BEFORE static middleware
app.get('/seraph/*', (req, res, next) => {
  const fs = require('fs');
  const requestedPath = req.path.replace('/seraph/', '');
  const fullPath = path.join(seraphPath, requestedPath);
  
  // Handle HTML files (both index.html and other .html files)
  let htmlPath;
  if (req.path.endsWith('.html')) {
    // Direct request to any .html file
    htmlPath = fullPath;
  } else if (req.path.endsWith('/index.html')) {
    // Explicit index.html request
    htmlPath = fullPath;
  } else if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    // Directory request - look for index.html inside
    htmlPath = path.join(fullPath, 'index.html');
  }
  
  if (htmlPath && fs.existsSync(htmlPath)) {
    try {
      let html = fs.readFileSync(htmlPath, 'utf8');
      
      // Determine base path based on the actual directory structure
      // Extract the directory path from the request URL
      let basePath = '/seraph/';
      const pathParts = req.path.split('/').filter(p => p);
      
      // If the path contains .html file, remove it to get the directory
      if (pathParts[pathParts.length - 1].endsWith('.html')) {
        pathParts.pop();
      }
      
      // If path ends without trailing slash and isn't just /seraph, add the folder
      if (pathParts.length > 1) {
        basePath = '/' + pathParts.join('/') + '/';
      }
      
      // Inject base tag for proper routing
      html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n  <base href="${basePath}">`);
      
      // Rewrite asset paths - absolute paths (handle both double and single quotes)
      html = html.replace(/href=(["'])\/(?!seraph|http|https|\/)/g, 'href=$1/seraph/');
      html = html.replace(/src=(["'])\/(?!seraph|http|https|\/)/g, 'src=$1/seraph/');
      
      // Rewrite relative paths (../) - handle both quote types
      // For games index, ../ paths should stay within /seraph/games/
      // For other pages, ../ means go up one directory level
      html = html.replace(/href=(["'])\.\.\/([^"']+)\1/g, (match, quote, capture) => {
        if (basePath === '/seraph/games/') {
          return `href=${quote}${capture}${quote}`;  // Relative to /seraph/games/
        } else {
          const upOneLevelPath = basePath.split('/').slice(0, -2).join('/') + '/';
          return `href=${quote}${upOneLevelPath}${capture}${quote}`;
        }
      });
      html = html.replace(/src=(["'])\.\.\/([^"']+)\1/g, (match, quote, capture) => {
        if (basePath === '/seraph/games/') {
          return `src=${quote}${capture}${quote}`;
        } else {
          const upOneLevelPath = basePath.split('/').slice(0, -2).join('/') + '/';
          return `src=${quote}${upOneLevelPath}${capture}${quote}`;
        }
      });
      
      // Rewrite CSS url() paths in inline styles (e.g., url('../images/...') or url(/images/...))
      html = html.replace(/url\(['"]?\.\.\/([^'")]+)['"]?\)/g, 'url("/seraph/$1")');
      html = html.replace(/url\(['"]?\/(?!seraph|http|https)([^'")]+)['"]?\)/g, 'url("/seraph/$1")');
      
      // Runtime interceptor for dynamic links - same as main index route
      const interceptor = `
        <script>
          (function(){
            var basePath = '/seraph';
            function fixLinks(){
              try {
                document.querySelectorAll('a[href]').forEach(function(a){
                  var href = a.getAttribute('href');
                  if (!href) return;
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
            try {
              var mo = new MutationObserver(function(){ fixLinks(); });
              mo.observe(document.documentElement || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
            } catch(_) {}
            setInterval(fixLinks, 300);
          })();
        </script>
      `;
      html = html.replace('</body>', interceptor + '</body>');
      
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    } catch (e) {
      console.error('Failed to serve Seraph subdirectory index:', e);
    }
  }
  next();
});

// Intercept CSS files to rewrite absolute URL paths
app.get('/seraph/**/*.css', async (req, res, next) => {
  try {
    const cssPath = path.join(seraphPath, req.path.replace('/seraph/', ''));
    if (fs.existsSync(cssPath)) {
      let css = await fs.promises.readFile(cssPath, 'utf-8');
      
      // Rewrite absolute url() paths in CSS to include /seraph/ prefix
      css = css.replace(/url\(['"]?\/(?!seraph|http|https)([^'")]+)['"]?\)/g, 'url("/seraph/$1")');
      
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      return res.send(css);
    }
  } catch (e) {
    console.error('Failed to serve Seraph CSS file:', e);
  }
  next();
});

// Serve static Seraph files for non-index.html requests
app.use('/seraph', express.static(seraphPath, { index: false }));

app.use(express.static(path.join(__dirname, 'public')));

// API Routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Spotify Playlist Search API
app.get('/media-player/spotify-search', async (req, res) => {
  const query = req.query.q || req.query.query;
  const type = req.query.type || 'playlist';
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  
  if (!query) {
    return res.status(400).json({ error: 'Missing search query' });
  }
  
  console.log(`🔍 Searching Spotify for ${type}: "${query}"`);
  
  // Note: Playlist search often returns null items due to Spotify API limitations with Client Credentials flow
  // Tracks and albums work reliably
  
  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: 'Spotify API credentials not configured' });
    }
    
    // Get access token
    const tokenData = `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`;
    const tokenResponse = await new Promise((resolve, reject) => {
      const tokenReq = https.request({
        hostname: 'accounts.spotify.com',
        path: '/api/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': tokenData.length
        }
      }, (tokenRes) => {
        let data = '';
        tokenRes.on('data', chunk => { data += chunk; });
        tokenRes.on('end', () => {
          resolve({
            ok: tokenRes.statusCode >= 200 && tokenRes.statusCode < 300,
            json: () => Promise.resolve(JSON.parse(data))
          });
        });
      });
      tokenReq.on('error', reject);
      tokenReq.write(tokenData);
      tokenReq.end();
    });
    
    if (!tokenResponse.ok) {
      throw new Error('Failed to get Spotify access token');
    }
    
    const tokenJson = await tokenResponse.json();
    const accessToken = tokenJson.access_token;
    
    // Search Spotify (add market=US to avoid null items from market restrictions)
    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}&market=US`;
    const searchResponse = await httpsGet(searchUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!searchResponse.ok) {
      throw new Error('Spotify search failed');
    }
    
    const searchData = await searchResponse.json();
    
    // Format results based on type
    let results = [];
    
    if (type === 'playlist' && searchData.playlists?.items) {
      results = searchData.playlists.items
        .filter(p => p && p.id)
        .map(p => ({
          id: p.id,
          name: p.name || 'Unknown Playlist',
          description: p.description || '',
          owner: p.owner?.display_name || 'Unknown',
          image: p.images?.[0]?.url || null,
          trackCount: p.tracks?.total || 0,
          url: p.external_urls?.spotify || `https://open.spotify.com/playlist/${p.id}`,
          type: 'playlist'
        }));
    } else if (type === 'album' && searchData.albums?.items) {
      results = searchData.albums.items
        .filter(a => a && a.id)
        .map(a => ({
          id: a.id,
          name: a.name || 'Unknown Album',
          artist: a.artists?.[0]?.name || 'Unknown',
          image: a.images?.[0]?.url || null,
          trackCount: a.total_tracks || 0,
          releaseDate: a.release_date || '',
          url: a.external_urls?.spotify || `https://open.spotify.com/album/${a.id}`,
          type: 'album'
        }));
    } else if (type === 'track' && searchData.tracks?.items) {
      results = searchData.tracks.items
        .filter(t => t && t.id)
        .map(t => ({
          id: t.id,
          name: t.name || 'Unknown Track',
          artist: t.artists?.[0]?.name || 'Unknown',
          album: t.album?.name || '',
          image: t.album?.images?.[0]?.url || null,
          duration: t.duration_ms,
          url: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
          type: 'track'
        }));
    }
    
    console.log(`✅ Found ${results.length} ${type}s for "${query}"`);
    
    res.json({
      query,
      type,
      results,
      total: results.length
    });
    
  } catch (error) {
    console.error('Spotify search error:', error.message);
    res.status(500).json({ error: 'Failed to search Spotify', details: error.message });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`🎮 GameHub server running on port ${PORT}`);
  console.log(`🌐 Landing page: http://localhost:${PORT}/`);
  console.log(`🎰 GameHub: http://localhost:${PORT}/ghub`);
  console.log(`🦆 DuckMath: http://localhost:${PORT}/duckmath`);
  console.log(`⚡ Radon Portal: http://localhost:${PORT}/radon-g3mes`);
  console.log(`👼 Seraph: http://localhost:${PORT}/seraph`);
});
      // Basic routes
app.get('/games/:gameId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'games', `${req.params.gameId}.html`));
});

// 404 handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});
