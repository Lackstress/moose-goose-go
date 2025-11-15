#!/bin/bash
# Force rebuild Radon Games with correct base path and CDN patches
# Run this if Radon Portal routing is broken (clicks lead to 404/search)

set -e
cd "$(dirname "$0")"

RADON_PATH="../radon-games"

if [ ! -d "$RADON_PATH" ]; then
  echo "❌ Radon Games not found at $RADON_PATH"
  exit 1
fi

echo "🔧 Force rebuilding Radon Games with /radon-g3mes base path..."

cd "$RADON_PATH"

# Reset any local changes
git reset --hard HEAD
git pull || true

# Apply vite.config.ts base path
if [ -f "vite.config.ts" ]; then
  if ! grep -q 'base: "/radon-g3mes/"' vite.config.ts; then
    sed -i '/export default defineConfig({/a\  base: "/radon-g3mes/",' vite.config.ts
    echo "  ✓ Patched vite.config.ts"
  fi
fi

# Apply router basepath
if [ -f "src/main.tsx" ]; then
  if ! grep -q 'basepath: "/radon-g3mes"' src/main.tsx; then
    sed -i 's/const router = createRouter({ routeTree, defaultPreload: "viewport" });/const router = createRouter({ routeTree, defaultPreload: "viewport", basepath: "\/radon-g3mes" });/g' src/main.tsx
    echo "  ✓ Patched src/main.tsx"
  fi
fi

# Apply CDN path patches
for file in "src/routes/game/\$gameid.tsx" "src/components/GameCard.tsx"; do
  if [ -f "$file" ]; then
    sed -i 's|src={`/cdn/|src={`/radon-g3mes/cdn/|g' "$file"
    echo "  ✓ Patched $file"
  fi
done

# Reinstall and rebuild
echo "📦 Installing dependencies..."
npm install || pnpm install

echo "🔨 Building..."
npm run build || pnpm run build

echo "✅ Radon Games rebuilt successfully!"
echo ""
echo "Restart your server (node server.js or npm start) and navigate to:"
echo "  http://localhost:3000/radon-g3mes"
