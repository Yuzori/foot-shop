#!/usr/bin/env bash
# Export PrestaShop + MariaDB depuis la VM Kali Linux
# Usage (sur Kali, en root ou avec sudo si besoin) :
#   chmod +x export-from-kali.sh
#   ./export-from-kali.sh
#
# Variables optionnelles :
#   PS_DIR=/var/www/html/prestashop   # dossier PrestaShop
#   OUT_DIR=~/prestashop-export       # dossier de sortie

set -euo pipefail

PS_DIR="${PS_DIR:-/var/www/html/prestashop}"
OUT_DIR="${OUT_DIR:-$HOME/prestashop-export}"
STAMP="$(date +%Y%m%d-%H%M%S)"
WORKDIR="$OUT_DIR/$STAMP"

echo "=== Export PrestaShop → Hostinger ==="
echo "Dossier PrestaShop : $PS_DIR"
echo "Sortie             : $WORKDIR"
echo

if [[ ! -d "$PS_DIR" ]]; then
  echo "ERREUR: dossier PrestaShop introuvable: $PS_DIR"
  echo "Indiquez le bon chemin : PS_DIR=/chemin/vers/prestashop $0"
  exit 1
fi

mkdir -p "$WORKDIR"

# ── 1. Lire les identifiants BDD depuis parameters.php (PS 1.7+) ──
PARAMS="$PS_DIR/app/config/parameters.php"
if [[ ! -f "$PARAMS" ]]; then
  PARAMS="$PS_DIR/config/settings.inc.php"
fi

if [[ ! -f "$PARAMS" ]]; then
  echo "ERREUR: fichier config introuvable (parameters.php ou settings.inc.php)"
  exit 1
fi

echo "→ Lecture config : $PARAMS"

# Extraction simple (fonctionne avec le format standard PrestaShop)
DB_NAME="$(grep -oP "database_name'\s*=>\s*'\K[^']+" "$PARAMS" 2>/dev/null || true)"
DB_USER="$(grep -oP "database_user'\s*=>\s*'\K[^']+" "$PARAMS" 2>/dev/null || true)"
DB_PASS="$(grep -oP "database_password'\s*=>\s*'\K[^']+" "$PARAMS" 2>/dev/null || true)"
DB_HOST="$(grep -oP "database_host'\s*=>\s*'\K[^']+" "$PARAMS" 2>/dev/null || true)"
DB_PREFIX="$(grep -oP "database_prefix'\s*=>\s*'\K[^']+" "$PARAMS" 2>/dev/null || true)"

# Fallback PS 1.6 settings.inc.php
if [[ -z "$DB_NAME" ]]; then
  DB_NAME="$(grep -oP "define\('_DB_NAME_',\s*'\K[^']+" "$PARAMS" 2>/dev/null || true)"
  DB_USER="$(grep -oP "define\('_DB_USER_',\s*'\K[^']+" "$PARAMS" 2>/dev/null || true)"
  DB_PASS="$(grep -oP "define\('_DB_PASSWD_',\s*'\K[^']+" "$PARAMS" 2>/dev/null || true)"
  DB_HOST="$(grep -oP "define\('_DB_SERVER_',\s*'\K[^']+" "$PARAMS" 2>/dev/null || true)"
  DB_PREFIX="$(grep -oP "define\('_DB_PREFIX_',\s*'\K[^']+" "$PARAMS" 2>/dev/null || true)"
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PREFIX="${DB_PREFIX:-ps_}"

if [[ -z "$DB_NAME" || -z "$DB_USER" ]]; then
  echo "ERREUR: impossible de lire database_name / database_user dans $PARAMS"
  echo "Exportez la BDD manuellement avec mysqldump."
  exit 1
fi

echo "   BDD : $DB_NAME @ $DB_HOST (préfixe: $DB_PREFIX)"
echo

# ── 2. Dump MariaDB ──
echo "→ Export base de données..."
DUMP_FILE="$WORKDIR/prestashop.sql"

if [[ -n "$DB_PASS" ]]; then
  mysqldump -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" \
    --single-transaction --quick --routines --triggers \
    "$DB_NAME" > "$DUMP_FILE"
else
  mysqldump -h "$DB_HOST" -u "$DB_USER" \
    --single-transaction --quick --routines --triggers \
    "$DB_NAME" > "$DUMP_FILE"
fi

gzip -f "$DUMP_FILE"
echo "   OK : prestashop.sql.gz ($(du -h "$DUMP_FILE.gz" | cut -f1))"
echo

# ── 3. Archive fichiers (sans cache lourd) ──
echo "→ Archive des fichiers PrestaShop (peut prendre plusieurs minutes)..."
FILES_ARCHIVE="$WORKDIR/prestashop-files.tar.gz"

tar -czf "$FILES_ARCHIVE" \
  --exclude='var/cache' \
  --exclude='var/logs' \
  --exclude='img/tmp' \
  --exclude='.git' \
  -C "$(dirname "$PS_DIR")" "$(basename "$PS_DIR")"

echo "   OK : prestashop-files.tar.gz ($(du -h "$FILES_ARCHIVE" | cut -f1))"
echo

# ── 4. Infos pour Hostinger ──
cat > "$WORKDIR/README-hostinger.txt" <<EOF
Export PrestaShop — $STAMP
============================

Fichiers à transférer sur ton PC Windows puis Hostinger :
  - prestashop.sql.gz      → importer dans phpMyAdmin Hostinger
  - prestashop-files.tar.gz → extraire dans public_html/bo

Ancienne config détectée :
  - Préfixe tables : $DB_PREFIX
  - Base           : $DB_NAME

Après import sur Hostinger :
  1. Éditer app/config/parameters.php avec les identifiants MySQL Hostinger
  2. Exécuter hostinger-url-update.sql dans phpMyAdmin (adapter le préfixe si besoin)
  3. Activer SSL sur bo.foot-shop.fr
  4. Activer le Webservice (clé API pour la boutique Next.js)

Guide complet : docs/prestashop-kali-to-hostinger.md
EOF

# Sauvegarder le préfixe pour le SQL
echo "$DB_PREFIX" > "$WORKDIR/db-prefix.txt"

cp "$(dirname "$0")/hostinger-url-update.sql" "$WORKDIR/" 2>/dev/null || true

echo "=== Terminé ==="
echo "Dossier prêt : $WORKDIR"
echo
echo "Transférer vers Windows (depuis Kali, IP de ton PC) :"
echo "  scp -r $WORKDIR elamm@IP_WINDOWS:~/Desktop/"
echo
echo "Ou partage VirtualBox / clé USB."
