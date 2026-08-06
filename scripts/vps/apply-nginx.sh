#!/usr/bin/env bash
# Apply nginx config for Foot Shop (run on VPS as deploy, needs passwordless sudo).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/foot-shop}"
CONF_DEST="/etc/nginx/sites-available/foot-shop"
SSL_CERT="/etc/letsencrypt/live/foot-shop.fr/fullchain.pem"

if [[ -f "$SSL_CERT" ]]; then
  CONF_SRC="$APP_DIR/scripts/vps/nginx-foot-shop.conf"
  echo "→ Using HTTPS config"
else
  CONF_SRC="$APP_DIR/scripts/vps/nginx-foot-shop.http.conf"
  echo "→ Using HTTP config (no SSL cert yet)"
fi

if [[ ! -f "$CONF_SRC" ]]; then
  echo "Config not found: $CONF_SRC" >&2
  exit 1
fi

echo "→ Installing $CONF_SRC → $CONF_DEST"
sudo cp "$CONF_SRC" "$CONF_DEST"
sudo ln -sf "$CONF_DEST" /etc/nginx/sites-enabled/foot-shop

echo "→ Testing nginx"
sudo nginx -t

echo "→ Reloading nginx"
sudo systemctl reload nginx

echo "→ Verifying static assets"
CSS_FILE="$(curl -fsS http://127.0.0.1:3000/ 2>/dev/null | grep -oE '_next/static/css/[a-f0-9]+\.css' | head -1 || true)"
if [[ -n "$CSS_FILE" ]]; then
  STATUS="$(curl -sS -o /dev/null -w '%{http_code}' "https://foot-shop.fr/${CSS_FILE}" 2>/dev/null || curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1/${CSS_FILE}")"
  echo "   ${CSS_FILE} → HTTP ${STATUS}"
  if [[ "$STATUS" != "200" ]]; then
    echo "WARN: static asset check failed (expected 200)" >&2
    exit 1
  fi
fi

echo "✓ Nginx OK"
