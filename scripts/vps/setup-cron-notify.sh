#!/usr/bin/env bash
# Installe un cron qui appelle /api/cron/notify toutes les 15 minutes.
# Usage (sur le VPS, une fois) : sudo bash scripts/vps/setup-cron-notify.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/foot-shop}"
ENV_FILE="${APP_DIR}/.env"
CRON_TAG="foot-shop-notify"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}"
  exit 1
fi

CRON_SECRET="$(grep -E '^CRON_SECRET=' "${ENV_FILE}" | tail -n1 | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//')"
if [[ -z "${CRON_SECRET}" ]]; then
  CRON_SECRET="$(grep -E '^ADMIN_SECRET=' "${ENV_FILE}" | tail -n1 | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//')"
fi

if [[ -z "${CRON_SECRET}" ]]; then
  echo "CRON_SECRET or ADMIN_SECRET required in ${ENV_FILE}"
  exit 1
fi

LINE="*/15 * * * * curl -fsS -H \"Authorization: Bearer ${CRON_SECRET}\" http://127.0.0.1:3000/api/cron/notify >> /var/log/foot-shop-notify.log 2>&1 # ${CRON_TAG}"

TMP="$(mktemp)"
crontab -l 2>/dev/null | grep -v "${CRON_TAG}" > "${TMP}" || true
echo "${LINE}" >> "${TMP}"
crontab "${TMP}"
rm -f "${TMP}"

echo "Cron notify installed:"
crontab -l | grep "${CRON_TAG}"
