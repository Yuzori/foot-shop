# Déploiement Foot Shop sur VPS OVH

## Architecture recommandée

```
foot-shop.fr      →  VPS OVH (Next.js — ce repo)
bo.foot-shop.fr   →  Hostinger (PrestaShop — inchangé)
```

Le VPS héberge **uniquement la boutique Next.js**. PrestaShop reste sur Hostinger.

---

## Étape 0 — Accès SSH (si le mot de passe ne marche pas)

### Réinitialiser le mot de passe root

1. [OVH Manager](https://www.ovh.com/manager/) → **Bare Metal Cloud** → ton VPS
2. **Accueil** → bouton **⋯** ou **Redémarrer en mode rescue** / **Réinitialiser le mot de passe**
3. Ou : **KVM / Console** (accès direct sans SSH) → login `root` + nouveau mot de passe

### Ubuntu 24 sur OVH — utilisateurs possibles

| Login | Quand l'utiliser |
|-------|------------------|
| `root` | Mot de passe reçu par mail OVH à la création |
| `ubuntu` | Certaines images n'autorisent que les clés SSH pour root |

### Test depuis ton PC (PowerShell)

```powershell
ssh root@137.74.166.133
```

Si « Permission denied » :
- Réinitialise le mot de passe dans le panel OVH
- Ou utilise la **console KVM** dans le panel (pas besoin de SSH)

### Sécurité

- **Ne partage jamais** le mot de passe root dans un chat
- Après la première connexion, crée une clé SSH et désactive le mot de passe root

---

## Étape 1 — Setup automatique sur le VPS

**Via console KVM OVH** (coller ligne par ligne) :

```bash
apt-get update && apt-get install -y git
git clone https://github.com/Yuzori/foot-shop.git /tmp/foot-shop
bash /tmp/foot-shop/scripts/vps/ovh-vps-setup.sh
```

Ou copier-coller le contenu de `scripts/vps/ovh-vps-setup.sh` dans la console.

---

## Étape 2 — Déployer l'application

```bash
sudo -u deploy git clone https://github.com/Yuzori/foot-shop.git /var/www/foot-shop
cd /var/www/foot-shop
sudo -u deploy nano .env.production
```

Variables minimales (copier depuis `.env.local`) :

```env
PRESTASHOP_API_URL=https://bo.foot-shop.fr/api
PRESTASHOP_API_KEY=...
PRESTASHOP_IMAGE_HOSTS=bo.foot-shop.fr
PRESTASHOP_SHOP_ID=1
PRESTASHOP_LANG_ID=1
NEXT_PUBLIC_SITE_URL=https://foot-shop.fr
AUTH_SECRET=...
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=1
SMTP_USER=contact@foot-shop.fr
SMTP_PASSWORD=...
ADMIN_SECRET=...
CRON_SECRET=...
```

Build et démarrage :

```bash
cd /var/www/foot-shop
export $(grep -v '^#' .env.production | xargs)
npm ci
npm run build
pm2 start npm --name foot-shop -- start
pm2 save
pm2 startup
```

---

## Déploiement auto GitHub Actions

Workflow : `.github/workflows/deploy-vps.yml` (déclenché à chaque push sur `main`).

### Secrets (Settings → Secrets and variables → Actions)

| Secret | Exemple | Erreurs fréquentes |
|--------|---------|-------------------|
| `VPS_HOST` | `137.74.166.133` | Pas de `https://`, pas d’espace |
| `VPS_USER` | `deploy` | |
| `VPS_SSH_KEY` | clé privée OpenSSH complète | **Doit** inclure les lignes `BEGIN` / `END` et les retours à la ligne |

### Clé SSH sur le VPS

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
cat ~/.ssh/github_deploy   # → coller dans VPS_SSH_KEY (GitHub)
```

### Si le workflow échoue en ~5 secondes

C’est presque toujours la **clé SSH** (connexion refusée avant `npm build`) :

1. Recopier la clé privée depuis le VPS (`cat ~/.ssh/github_deploy`)
2. GitHub → modifier `VPS_SSH_KEY` → coller **tout** le bloc
3. Actions → **Deploy VPS** → **Re-run all jobs**

Un build réussi dure **plusieurs minutes**, pas 5 secondes.

### Déploiement manuel (secours)

```bash
ssh deploy@137.74.166.133 "cd /var/www/foot-shop && git pull origin main && npm ci && npm run build && pm2 restart foot-shop"
```

---

## Étape 3 — DNS (chez Hostinger / OVH)

| Type | Nom | Valeur |
|------|-----|--------|
| **A** | `@` | `137.74.166.133` |
| **A** | `www` | `137.74.166.133` |

`bo.foot-shop.fr` reste sur Hostinger (ne pas changer).

---

## Étape 4 — SSL HTTPS

Quand le DNS pointe vers le VPS :

```bash
certbot --nginx -d foot-shop.fr -d www.foot-shop.fr
```

Mettre à jour `NEXT_PUBLIC_SITE_URL=https://foot-shop.fr` puis :

```bash
cd /var/www/foot-shop && npm run build && pm2 restart foot-shop
```

---

## Étape 5 — Stripe webhook

Dashboard Stripe → Webhooks → `https://foot-shop.fr/api/webhooks/stripe`

---

## Vérifications

```bash
curl http://127.0.0.1:3000/api/health
curl https://foot-shop.fr/api/health
```

Réponse attendue : `{ "ok": true, "prestashop": true }`

---

## Mises à jour

```bash
cd /var/www/foot-shop
git pull
npm ci && npm run build
pm2 restart foot-shop
```

---

## Dépannage SSH

| Problème | Solution |
|----------|----------|
| Permission denied (password) | Réinitialiser MDP dans panel OVH |
| Permission denied (publickey) | Utiliser console KVM ou ajouter ta clé SSH dans OVH |
| Connection timed out | Vérifier firewall OVH + `ufw allow OpenSSH` |
| Port 22 fermé | Panel OVH → Firewall réseau → autoriser TCP 22 |
