# Media Player Fix - Missing yt-dlp Dependency

## Issue
Media player works locally but fails on production domain `moose-goose-go.ink`.

## Root Cause
The media player uses `yt-dlp` as a **system binary** (not a Node.js package). The function `fetchYoutubeInfoStable` in `server.js` calls:

```javascript
await execFileAsync('yt-dlp', [
  '--dump-json',
  '--no-playlist',
  '--skip-download',
  videoUrl
])
```

**Local environment**: yt-dlp version 2025.11.12 is installed ✅  
**Production environment**: yt-dlp likely NOT installed ❌

## Solution
Install `yt-dlp` on the production server.

### Installation Methods

#### Option 1: Using pip (Recommended)
```bash
sudo pip install yt-dlp
```

#### Option 2: Using apt (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install yt-dlp
```

#### Option 3: Using wget (manual install)
```bash
sudo wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

### Verification
After installation, verify with:
```bash
yt-dlp --version
```

Should output version number (e.g., `2025.11.12`).

### Restart Server
After installing yt-dlp, restart the Node.js server:
```bash
pm2 restart all
# or
systemctl restart your-service-name
```

## Testing Confirmation
✅ **Local testing completed** using Playwright browser:
- Page loads correctly at http://localhost:3000/media-player
- YouTube URL input works (tested with Rick Astley video)
- Play button triggers stream request
- Video element loads successfully:
  - `readyState: 4` (HAVE_ENOUGH_DATA)
  - `duration: 213.043084` seconds
  - Quality dropdown populated with 25 formats
  - No playback errors

## Additional Notes
- The media player uses a 5-minute cache (`YT_INFO_TTL_MS = 5 * 60 * 1000`)
- All formats are fetched via yt-dlp's `--dump-json` flag
- Video streaming uses direct URL proxying (no 410 errors)
- Supports both streaming (`/media-player/stream`) and downloading (`/media-player/download`)

## Alternative Solution (If yt-dlp Cannot Be Installed)
If you cannot install yt-dlp on production, consider switching to a Node.js library:

1. Install `@distube/ytdl-core`:
```bash
npm install @distube/ytdl-core
```

2. Replace `fetchYoutubeInfoStable` function in `server.js` with ytdl-core implementation (requires code refactoring).

However, yt-dlp is **more reliable** and handles anti-bot measures better.
