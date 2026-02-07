#!/bin/sh
set -e

# Set CI mode for pnpm to avoid TTY issues in Docker
export CI=true

# Install dependencies if node_modules doesn't exist or package files changed
# pnpm install is fast when nothing changed due to its caching
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.pnpm/package.json" ]; then
  echo "Installing dependencies..."
  pnpm install
else
  # Quick check: if package.json or pnpm-lock.yaml is newer, reinstall
  PKG_MTIME=$(stat -c %Y package.json 2>/dev/null || echo 0)
  LOCK_MTIME=$(stat -c %Y pnpm-lock.yaml 2>/dev/null || echo 0)
  NODE_MTIME=$(stat -c %Y node_modules/.pnpm/package.json 2>/dev/null || echo 0)
  
  if [ "$PKG_MTIME" -gt "$NODE_MTIME" ] || [ "$LOCK_MTIME" -gt "$NODE_MTIME" ]; then
    echo "Dependencies changed, updating..."
    pnpm install
  fi
fi

# Start the dev server (migrations run automatically via instrumentation.ts)
exec pnpm run dev
