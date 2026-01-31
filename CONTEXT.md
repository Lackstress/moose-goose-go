# Project Context: Moose-Goose-Go Game Hub Platform

**Last Updated:** November 19, 2025  
**Repository:** Lackstress/moose-goose-go  
**Server Type:** Node.js/Express multi-hub game platform

---

## Project Overview

This is a Node.js/Express server that hosts multiple game hub platforms under a single unified server. Each hub is a separate Git submodule/clone serving its own collection of games with unique themes and interfaces.

### Active Hubs (5 Total)

1. **GameHub** (`/ghub`) - Main custom game collection
2. **DuckMath** (`/duckmath`) - Educational math games
3. **Seraph** (`/seraph`) - 500+ games with clean UI (Fork: Lackstress/seraph)
5. **Landing Page** (`/`) - Hub selector/portal

### Server Details

- **Port:** 3000
- **Main File:** `server.js`
- **Database:** SQLite (`database/db.js`)
- **Auth Middleware:** `middleware/auth.js`
- **Routes:** `routes/auth.js`

---

## Directory Structure

```
moose-goose-go/
├── server.js              # Main Express server with all hub routing
├── package.json           # Dependencies
├── setup-localhost.js     # Local setup script (clones all hubs)
├── deploy.sh             # Full deployment script
├── quick-deploy.sh       # Quick deployment script
├── database/
│   └── db.js             # SQLite database setup
├── middleware/
│   └── auth.js           # Authentication middleware
├── routes/
│   └── auth.js           # Auth routes
├── public/               # Landing page & custom GameHub files
│   ├── index.html        # Landing page (hub selector)
│   ├── hub.html          # GameHub interface
│   ├── games/            # Custom GameHub games
│   └── js/               # Shared JavaScript
├── ../duckmath/          # DuckMath hub (git clone)
└── ../seraph/            # Seraph hub (git clone from Lackstress/seraph)
```

---

## Key Technologies & Tools

### Required Tools

1. **PowerShell** - Default shell for all terminal commands
2. **Git** - For cloning hub repositories
3. **Node.js/npm** - Server runtime
4. **Express.js** - Web framework

### Code Style Expectations

- **Terminal Commands:** Always use PowerShell syntax (`;` for chaining, not `&&`)
- **File Operations:** Use `replace_string_in_file` or `multi_replace_string_in_file` for edits
- **Path Format:** Use absolute Windows paths (`C:\Users\LAPTOP\Downloads\...`)
- **NO Markdown Summaries:** Don't create change documentation unless requested

### Tools to Avoid

- ❌ `run_playwright_code` - Use browser navigation tools instead
- ❌ `&&` in terminal - Use `;` (PowerShell chaining)
- ❌ Creating summary files - Just do the work

---

## Critical Server Configuration Patterns

### Path Rewriting Strategy (server.js)

Each hub requires specific path rewriting to work correctly when served from subdirectories:

```javascript
// Example: Seraph hub configuration
const seraphPath = path.join(__dirname, '..', 'seraph');

// 1. Static file serving (NO index.html auto-serve)
app.use('/seraph', express.static(seraphPath, { index: false }));

// 2. Main index routes (/, /index.html)
app.get(['/seraph', '/seraph/', '/seraph/index.html'], (req, res) => {
  const filePath = path.join(seraphPath, 'index.html');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(500).send('Error loading page');
    
    // Path rewriting transformations:
    let modifiedHtml = data
      .replace(/<head>/, '<head>\n    <base href="/seraph/">')  // Base tag
      .replace(/href="\//g, 'href="/seraph/')                    // Absolute paths
      .replace(/src="\//g, 'src="/seraph/')                      // Script/image paths
      .replace(/url\('\/([^'])/g, "url('/seraph/$1")            // CSS url() paths
      .replace(/url\("\/([^"])/g, 'url("/seraph/$1')
      .replace(/url\(\/([^)'])/g, "url(/seraph/$1");
    
    res.send(modifiedHtml);
  });
});

// 3. Subdirectory routes (e.g., /seraph/games/, /seraph/apps/)
app.get('/seraph/*/', (req, res) => {
  const relativePath = req.path.replace('/seraph/', '');
  const dirPath = path.join(seraphPath, relativePath);
  const indexPath = path.join(dirPath, 'index.html');
  
  // Same path rewriting as above...
});
```

### Common Path Rewriting Issues

1. **Relative paths in inline styles** - `url('../images/...')` won't work with base tag
   - Solution: Convert to absolute paths in source files
2. **Game links** - Need `../` prefix when in subdirectories
   - Example: `href="slope/index.html"` → `href="../slope/index.html"`
3. **Homepage links** - Need double `../` to reach parent
   - Example: `href="index.html"` → `href="../../index.html"`

---

## Adding a New Hub - Complete Workflow

### Step 1: Clone the Hub Repository

Add to `setup-localhost.js`:

```javascript
async function setupNewHub() {
    const hubPath = path.join(__dirname, '..', 'newhub');
    
    if (!fs.existsSync(hubPath)) {
        console.log('📦 Cloning NewHub...');
        await execAsync('git clone https://github.com/username/newhub.git ../newhub');
        console.log('✅ NewHub cloned successfully');
    } else {
        console.log('✅ NewHub already exists');
    }
}

// Add to main setup function
await setupNewHub();
```

### Step 2: Add Server Routes (server.js)

```javascript
// 1. Define path constant
const newHubPath = path.join(__dirname, '..', 'newhub');

// 2. Add static file serving
app.use('/newhub', express.static(newHubPath, { index: false }));

// 3. Add main index route handler
app.get(['/newhub', '/newhub/', '/newhub/index.html'], (req, res) => {
    const filePath = path.join(newHubPath, 'index.html');
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return res.status(500).send('Error loading page');
        
        let modifiedHtml = data
            .replace(/<head>/, '<head>\n    <base href="/newhub/">')
            .replace(/href="\//g, 'href="/newhub/')
            .replace(/src="\//g, 'src="/newhub/')
            .replace(/url\('\/([^'])/g, "url('/newhub/$1")
            .replace(/url\("\/([^"])/g, 'url("/newhub/$1')
            .replace(/url\(\/([^)'])/g, "url(/newhub/$1");
        
        res.send(modifiedHtml);
    });
});

// 4. Add subdirectory route handler (if hub has subdirectories)
app.get('/newhub/*/', (req, res) => {
    const relativePath = req.path.replace('/newhub/', '');
    const dirPath = path.join(newHubPath, relativePath);
    const indexPath = path.join(dirPath, 'index.html');
    
    if (!fs.existsSync(indexPath)) {
        return res.status(404).send('Page not found');
    }
    
    fs.readFile(indexPath, 'utf8', (err, data) => {
        if (err) return res.status(500).send('Error loading page');
        
        // Same path rewriting as main route
        let modifiedHtml = data
            .replace(/<head>/, '<head>\n    <base href="/newhub/">')
            .replace(/href="\//g, 'href="/newhub/')
            .replace(/src="\//g, 'src="/newhub/')
            .replace(/url\('\/([^'])/g, "url('/newhub/$1")
            .replace(/url\("\/([^"])/g, 'url("/newhub/$1')
            .replace(/url\(\/([^)'])/g, "url(/newhub/$1");
        
        res.send(modifiedHtml);
    });
});
```

### Step 3: Update Landing Page (public/index.html)

Add new hub card:

```html
<div class="hub-card" onclick="window.location.href='/newhub'">
    <h2>🎯 NewHub</h2>
    <p>Description of the new hub</p>
</div>
```

### Step 4: Update Deployment Scripts

**deploy.sh:**
```bash
# Add to Step 5.7
git clone https://github.com/username/newhub.git
```

**quick-deploy.sh:**
```bash
# Add after other clones
echo "Cloning NewHub..."
git clone https://github.com/username/newhub.git
```

### Step 5: Update Server Startup Message (server.js)

```javascript
console.log(`🎮 GameHub server running on port ${PORT}`);
console.log(`🌐 Landing page: http://localhost:${PORT}/`);
console.log(`🎰 GameHub: http://localhost:${PORT}/ghub`);
console.log(`🦆 DuckMath: http://localhost:${PORT}/duckmath`);
console.log(`👼 Seraph: http://localhost:${PORT}/seraph`);
console.log(`🎯 NewHub: http://localhost:${PORT}/newhub`);  // Add this
```

### Step 6: Test the Integration

```powershell
# 1. Stop existing server
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# 2. Run setup (clones new hub)
node setup-localhost.js

# 3. Start server
node server.js

# 4. Test routes
# - http://localhost:3000/newhub
# - http://localhost:3000/newhub/ (should work identically)
# - http://localhost:3000/newhub/index.html (should work identically)
```

---

## Troubleshooting Common Issues

### Issue: Hub loads but CSS/images broken

**Cause:** Path rewriting not working correctly  
**Solution:** 
1. Check base tag is injected: `<base href="/hubname/">`
2. Verify all path replacements in server route
3. Check for inline styles using relative paths (need to fix in source files)

### Issue: Game links return 404

**Cause:** Relative paths don't resolve correctly with base tag  
**Solution:** 
1. For games in subdirectories: Use `../gamename/index.html`
2. For homepage links: Use `../../index.html`
3. Update source files with PowerShell replace:
   ```powershell
   $content = Get-Content "path/to/file.html" -Raw
   $content = $content -replace 'href="([^/][^"]+/index\.html)"', 'href="../$1"'
   Set-Content "path/to/file.html" -Value $content -NoNewline
   ```

### Issue: Server won't start

**Cause:** Port 3000 already in use  
**Solution:**
```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
node server.js
```

### Issue: Hub repository has routing conflicts

**Cause:** Hub expects to be at root `/` but served from `/hubname`  
**Solution:** This is exactly what the path rewriting solves - no changes needed to hub repo

---

## Agent Expectations & Guidelines

### When Starting a Conversation

1. Read this CONTEXT.md file first
2. Check current server state (is it running?)
3. Understand which hub(s) are affected
4. Review server.js route configuration for that hub

### When Making Changes

1. **Use multi_replace_string_in_file** for multiple independent edits
2. **Include 3-5 lines context** in replace operations
3. **Test after changes** - restart server and verify routes
4. **Use PowerShell syntax** - `;` not `&&`
5. **No summary files** - just implement the changes

### When Using Playwright

1. **Navigate to pages** with `browser_navigate`
2. **Take snapshots** to verify visual state
3. **Don't use run_code** - use provided browser tools
4. **Test multiple routes** - `/hub`, `/hub/`, `/hub/index.html` should all work

### When Debugging

1. Check browser console errors (use Playwright tools)
2. Verify network requests (404s indicate path issues)
3. Check server terminal output
4. Compare working hub vs broken hub routing

---

## Important File Locations

### Server Files
- `C:\Users\LAPTOP\Downloads\moose-goose-go\server.js`
- `C:\Users\LAPTOP\Downloads\moose-goose-go\package.json`

### Hub Directories (Parent of Workspace)
- `C:\Users\LAPTOP\Downloads\duckmath\`
- `C:\Users\LAPTOP\Downloads\seraph\`

### Landing Page
- `C:\Users\LAPTOP\Downloads\moose-goose-go\public\index.html`

### Setup Scripts
- `C:\Users\LAPTOP\Downloads\moose-goose-go\setup-localhost.js`
- `C:\Users\LAPTOP\Downloads\moose-goose-go\deploy.sh`
- `C:\Users\LAPTOP\Downloads\moose-goose-go\quick-deploy.sh`

---

## Quick Reference Commands

### Server Management
```powershell
# Stop server
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Start server (foreground)
node server.js

# Start server (background)
Start-Process pwsh -ArgumentList "-Command", "node server.js" -WindowStyle Hidden
```

### Setup & Deployment
```powershell
# Local setup (clones all hubs)
node setup-localhost.js

# Install dependencies
npm install

# Check hub exists
Test-Path "C:\Users\LAPTOP\Downloads\hubname"
```

### File Operations
```powershell
# Find files
Get-ChildItem -Path "C:\path" -Filter "*.html" -Recurse

# Search content
Select-String -Path "file.html" -Pattern "search term"

# Replace in file (use tools instead)
# Don't do this manually - use replace_string_in_file tool
```

---

## Hub-Specific Notes

### Seraph Hub
- **Fork:** Using Lackstress/seraph (improved UI)
- **Original:** a456pur/seraph
- **Special Requirements:**
  - Games directory needs `../` prefix for game links
  - Thumbnails use absolute paths `/seraph/images/...`
  - Homepage link needs `../../index.html`


### DuckMath
- **Purpose:** Educational math games
- **Simple structure:** No complex routing needs

### GameHub
- **Location:** `/public` directory (not external clone)
- **Route:** `/ghub`
- **Custom games:** All in `public/games/`

---

## Version History

- **v1.0** (Nov 19, 2025) - Initial context document
  - 5 active hubs
  - Seraph switched to Lackstress fork
  - Path rewriting strategy documented

---

## Contact & Resources

**Repository:** https://github.com/Lackstress/moose-goose-go  
**Issues:** Use GitHub Issues for bug reports  
**Local Server:** http://localhost:3000/

---

*This document should be provided to agents at the start of each conversation to ensure they understand the project structure, expectations, and best practices.*
