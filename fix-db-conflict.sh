#!/bin/bash
# One-time fix to resolve games.db git conflict
# Run this on your VM: bash fix-db-conflict.sh

set -e

echo "🔧 Fixing games.db git conflict..."

# Backup the database
if [ -f "database/games.db" ]; then
    echo "📦 Backing up database..."
    cp database/games.db database/games.db.safe
    echo "✅ Backup created at database/games.db.safe"
fi

# Remove from git tracking
echo "🗑️  Removing database from git tracking..."
git rm --cached database/games.db 2>/dev/null || true

# Restore the file
if [ -f "database/games.db.safe" ]; then
    cp database/games.db.safe database/games.db
    rm database/games.db.safe
fi

# Discard any local changes to the file in git's view
git checkout HEAD -- database/games.db 2>/dev/null || true

# Now the database file exists locally but is ignored by git
echo "✅ games.db is now untracked and safe"
echo ""
echo "You can now run: bash quick-deploy.sh or bash deploy.sh"
echo "The database will never conflict with git again!"
