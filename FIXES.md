# Radon Portal & Media Player - Quick Fix Guide

## Problem 1: Radon Portal - All clicks lead to 404/search page

**Root cause**: Radon Games SPA not configured for `/radon-g3mes` base path.

**Fix**:
```bash
chmod +x fix-radon-routing.sh
./fix-radon-routing.sh
```

This will:
- Reset and pull latest Radon Games code
- Patch Vite config with `base: '/radon-g3mes/'`
- Patch router with `basepath: '/radon-g3mes'`
- Patch CDN references to use `/radon-g3mes/cdn/`
- Reinstall dependencies and rebuild

**Verify**:
- Navigate to http://localhost:3000/radon-g3mes
- Click Home, Games, any game card
- URL should stay under `/radon-g3mes/...` and render properly
- Refresh on any nested route - should still work

---

## Problem 2: Media Player - 410 errors (ytdl-core broken)

**Root cause**: `ytdl-core` library can't handle YouTube's current anti-bot signatures, causing persistent 410 errors.

**Fix**: Replaced `ytdl-core` with `yt-dlp` CLI wrapper (industry-standard, actively maintained).

**Install yt-dlp**:

Ubuntu/Debian:
```bash
sudo apt update && sudo apt install -y yt-dlp
```

macOS:
```bash
brew install yt-dlp
```

Windows (run as admin):
```powershell
winget install yt-dlp
```

Or universal (Python):
```bash
pip3 install -U yt-dlp
```

**Verify**:
```bash
yt-dlp --version
```

**Then restart server**:
```bash
npm install
node server.js
```

**Test media player**:
- http://localhost:3000/media-player
- Paste YouTube URL
- Formats should load, streaming should work

---

## Combined Quick Start

```bash
# Install yt-dlp
sudo apt install -y yt-dlp  # or brew/pip/winget

# Fix Radon routing
chmod +x fix-radon-routing.sh
./fix-radon-routing.sh

# Reinstall deps and start
npm install
node server.js
```

**Endpoints**:
- Landing: http://localhost:3000/
- GameHub: http://localhost:3000/ghub
- DuckMath: http://localhost:3000/duckmath
- Radon (fixed): http://localhost:3000/radon-g3mes
- Media Player (fixed): http://localhost:3000/media-player

---

## Troubleshooting

**Radon still goes to 404/search**:
- Check browser DevTools → Network tab for failed asset loads
- Ensure `radon-games/dist` folder exists and has `index.html`
- Run `./fix-radon-routing.sh` again
- Hard refresh browser (Ctrl+Shift+R)

**Media player still shows 410**:
- Confirm `yt-dlp --version` works
- Check server logs for exec errors
- Try a different YouTube URL (some are geo-restricted)
- Increase server timeout if video is long

**Database concerns**:
- Your `database/games.db` is auto-created and never modified by scripts
- Ignored by Git - safe across rebuilds

---

## Optional Enhancements

Add to server later if needed:
- Audio-only fallback for 410-resistant formats
- ffmpeg merging for 1080p+4K with separate A/V tracks
- Rate limiting on media endpoints
- Persistent format cache (Redis)
