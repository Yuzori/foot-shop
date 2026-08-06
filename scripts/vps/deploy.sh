#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/foot-shop}"
APP_NAME="${APP_NAME:-foot-shop}"

cd "$APP_DIR"

echo "→ git pull"
git pull --ff-only origin main

echo "→ npm ci"
npm ci

echo "→ npm run build"
npm run build

echo "→ pm2 restart"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$APP_NAME"
else
  pm2 start npm --name "$APP_NAME" -- start
  pm2 save
fi

echo "→ nginx static assets"
bash scripts/vps/apply-nginx.sh || echo "WARN: nginx apply skipped"

sleep 5
echo "→ health check"
curl -fsS "http://127.0.0.1:3000/api/health" || curl -fsS "http://127.0.0.1:3000/api/health"

echo "✓ Deploy OK"
