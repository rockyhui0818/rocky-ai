#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/rocky-ai"
REPO_URL="${REPO_URL:-git@github.com:rockyhui0818/rocky-ai.git}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install Node.js 20+ first."
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

mkdir -p /var/www

if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" pull --ff-only
fi

cd "$APP_DIR"
node --check app.js
node --check server.js
node --check api/_lib/env.js
node --check api/health.js
node --check api/generate.js
node --check api/image.js

if [ ! -f "$APP_DIR/.env" ]; then
  echo "Missing $APP_DIR/.env. Copy .env.example to .env and fill production secrets."
  exit 1
fi

pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

echo "Deployed rocky-ai. Check: curl http://127.0.0.1:8000/api/health"
