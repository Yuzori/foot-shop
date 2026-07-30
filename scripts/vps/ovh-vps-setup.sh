#!/usr/bin/env bash
# =============================================================================
# Foot Shop — Setup VPS OVH (Ubuntu 24.04)
# À exécuter SUR le VPS en root (console OVH ou SSH).
#
# Usage :
#   curl -fsSL ... | bash
#   — ou après git clone :
#   git clone https://github.com/Yuzori/foot-shop.git /tmp/foot-shop && bash /tmp/foot-shop/scripts/vps/ovh-vps-setup.sh
# =============================================================================
set -euo pipefail

APP_USER="${APP_USER:-deploy}"
APP_DIR="${APP_DIR:-/var/www/foot-shop}"
DOMAIN="${DOMAIN:-foot-shop.fr}"
BO_DOMAIN="${BO_DOMAIN:-bo.foot-shop.fr}"
NODE_MAJOR="${NODE_MAJOR:-20}"

echo "==> Mise à jour système"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

echo "==> Paquets de base"
apt-get install -y -qq \
  curl git nginx certbot python3-certbot-nginx \
  ufw fail2ban htop unzip

echo "==> Utilisateur deploy"
if ! id "$APP_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$APP_USER"
fi

echo "==> Node.js ${NODE_MAJOR}"
if ! command -v node &>/dev/null || [[ "$(node -v)" != v${NODE_MAJOR}* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -
  apt-get install -y -qq nodejs
fi
npm install -g pm2

echo "==> Dossier application"
mkdir -p "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$(dirname "$APP_DIR")"

echo "==> Firewall"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> Nginx (HTTP temporaire — SSL après DNS)"
cat > /etc/nginx/sites-available/foot-shop <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/foot-shop /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

cat <<'EOF'

=============================================================================
Setup de base terminé.
=============================================================================

Prochaines étapes (en tant que deploy) :

  1. Cloner le repo :
     sudo -u deploy git clone https://github.com/Yuzori/foot-shop.git /var/www/foot-shop

  2. Créer le fichier env :
     sudo -u deploy nano /var/www/foot-shop/.env.production
     (copier depuis .env.local — PRESTASHOP_API_URL=https://bo.foot-shop.fr/api etc.)

  3. Build + démarrage :
     cd /var/www/foot-shop
     npm ci && npm run build
     pm2 start npm --name foot-shop -- start
     pm2 save
     sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u deploy --hp /home/deploy

  4. SSL (quand DNS foot-shop.fr → IP du VPS) :
     certbot --nginx -d foot-shop.fr -d www.foot-shop.fr

  5. Cron alertes (crontab -u deploy -e) :
     */30 * * * * curl -fsS -H "Authorization: Bearer VOTRE_CRON_SECRET" https://foot-shop.fr/api/cron/notify

PrestaShop reste sur Hostinger (${BO_DOMAIN}) — pas besoin de le migrer sur le VPS.
=============================================================================
EOF
