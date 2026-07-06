# Déploiement Foot Shop — Hostinger et/ou Render

## Quelle option choisir ?

| Hébergement | Possible ? | Plan Hostinger |
|-------------|------------|----------------|
| **PrestaShop** (PHP) | Oui | Tous (Premium, Business, Cloud…) |
| **Next.js** (ce repo) | Oui | **Business** ou **Cloud** — « Node.js Web App » |
| **Next.js** | Non | Hébergement **Web** basique (PHP seulement) |

**Non, ce n’est pas impossible sur Hostinger** — mais il faut l’offre avec **applications Node.js** (Business / Cloud), pas l’hébergement PHP classique seul.

### Option A — Tout sur Hostinger (recommandé si tu as déjà l’offre)

```
foot-shop.fr      →  Node.js Web App (boutique Next.js)
bo.foot-shop.fr   →  Site PHP (PrestaShop)
contact@...       →  Email Hostinger (déjà OK)
```

Avantages : un seul fournisseur, PrestaShop et boutique sur le même réseau (API plus rapide), pas de Render.

### Option B — Render + Hostinger (guide original)

```
foot-shop.fr      →  Render (Next.js)
bo.foot-shop.fr   →  Hostinger (PrestaShop)
```

Avantages : plan Render gratuit possible pour la boutique ; Hostinger garde seulement PrestaShop + mail.

---

## Option A — Boutique Next.js sur Hostinger (Node.js Web App)

Documentation Hostinger : [Déployer une app Node.js](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)

### Prérequis

- Plan **Business** ou **Cloud** Hostinger avec **Node.js Web Apps**
- Repo GitHub du projet `maillot-store`

### Étapes

1. **hPanel → Sites web → Ajouter un site → Node.js Web App**
2. **Importer depuis GitHub** → sélectionner le repo
3. Paramètres de build :

   | Champ | Valeur |
   |-------|--------|
   | Install | `npm ci` |
   | Build | `npm run build` |
   | Start | `npm run start -- -p $PORT` |
   | Node.js | **20** |

4. **Variables d’environnement** — copier depuis `.env.local` en adaptant :

   ```
   PRESTASHOP_API_URL=https://bo.foot-shop.fr/api
   PRESTASHOP_API_KEY=...
   PRESTASHOP_IMAGE_HOSTS=bo.foot-shop.fr
   NEXT_PUBLIC_SITE_URL=https://foot-shop.fr
   AUTH_SECRET=...
   STRIPE_* (mode live en prod)
   SMTP_* (contact@foot-shop.fr)
   ADMIN_SECRET, CRON_SECRET
   ```

5. Lier le domaine **`foot-shop.fr`** à cette application Node.js (pas à `public_html` PHP).
6. **Deploy** → attendre le build (~2–5 min).

### Cron alertes stock (sans Render)

Hostinger ne fournit pas toujours de cron intégré sur Node.js Web Apps. Solutions :

- **hPanel → Cron Jobs** (si disponible sur ton plan) :
  ```bash
  curl -fsS -H "Authorization: Bearer VOTRE_CRON_SECRET" https://foot-shop.fr/api/cron/notify
  ```
  Planification : `*/30 * * * *`

- Ou service externe gratuit (ex. [cron-job.org](https://cron-job.org)) qui appelle la même URL.

### Fichiers `.data/` (préférences, alertes)

Sur Hostinger Node.js, le disque est **plus persistant** qu’on Render gratuit, mais peut quand même être réinitialisé selon les mises à jour plateforme. Le panier navigateur reste la source principale.

---

## Option B — Render + Hostinger

Architecture cible :

```
foot-shop.fr          →  Render (boutique Next.js — ce repo)
bo.foot-shop.fr       →  Hostinger (PrestaShop — back-office uniquement)
contact@foot-shop.fr  →  Hostinger Email (SMTP, déjà configuré)
```

Le navigateur **ne parle jamais** à PrestaShop directement. Render appelle l’API Webservice en serveur à serveur.

---

## Partie 1 — PrestaShop sur Hostinger

### 1.1 Créer le sous-domaine back-office

Dans **hPanel → Domaines → Sous-domaines** :

| Sous-domaine | Dossier suggéré        |
|--------------|------------------------|
| `bo`         | `public_html/bo`       |

→ URL finale : `https://bo.foot-shop.fr`

### 1.2 Migrer depuis ta VM (Kali / VirtualBox)

**Sur l’ancienne VM :**

1. **Base de données** — export phpMyAdmin ou :
   ```bash
   mysqldump -u USER -p NOM_BDD > prestashop.sql
   ```
2. **Fichiers** — zip du dossier PrestaShop (`/prestashop` ou équivalent), **sans** le cache volumineux si possible :
   - exclure `var/cache/*`, `img/tmp/*`

**Sur Hostinger :**

1. **Bases de données MySQL** → créer une BDD + utilisateur (noter host, nom, user, mot de passe).
2. **phpMyAdmin** → importer `prestashop.sql`.
3. **Gestionnaire de fichiers** ou **FTP** → uploader les fichiers dans `public_html/bo`.
4. Éditer `app/config/parameters.php` (PS 1.7+) ou `.env` avec les **nouveaux** identifiants MySQL Hostinger.

### 1.3 Mettre à jour les URLs PrestaShop

Après import, les URLs pointent encore vers `192.168.1.68`. Dans **phpMyAdmin**, table `ps_shop_url` (préfixe peut varier) :

```sql
UPDATE ps_shop_url SET domain = 'bo.foot-shop.fr', domain_ssl = 'bo.foot-shop.fr';
```

Et dans `ps_configuration` :

```sql
UPDATE ps_configuration SET value = 'https://bo.foot-shop.fr/' WHERE name = 'PS_SHOP_DOMAIN';
UPDATE ps_configuration SET value = 'https://bo.foot-shop.fr/' WHERE name = 'PS_SHOP_DOMAIN_SSL';
```

Puis **Back-office → Paramètres de la boutique → Trafic & SEO** : vérifier l’URL de la boutique.

Active **SSL** (hPanel → SSL → Let’s Encrypt pour `bo.foot-shop.fr`).

### 1.4 Webservice (obligatoire pour la boutique Render)

1. **Paramètres avancés → Webservice** → activer.
2. **Ajouter une clé** :
   - Description : `Foot Shop Render`
   - Permissions : lecture/écriture selon besoin (`products`, `categories`, `combinations`, `stock_availables`, `images`, `orders`, `customers`, `addresses`, `carts`…)
3. Copier la clé → `PRESTASHOP_API_KEY` sur Render.

Test depuis ton PC :

```bash
curl -u "VOTRE_CLE:" https://bo.foot-shop.fr/api/
```

(Réponse XML = OK. Le mot de passe Basic Auth est **vide**.)

### 1.5 Sécuriser le back-office (recommandé)

- Mot de passe admin fort.
- Limiter l’accès au BO via **mot de passe répertoire** hPanel sur `/bo/admin` (optionnel).
- Ne pas utiliser `bo.foot-shop.fr` comme vitrine publique — la boutique vitrine est sur Render.

---

## Partie 2 — Boutique Next.js sur Render

### 2.1 Pousser le code sur GitHub

```bash
git add .
git commit -m "Prepare Render deployment"
git remote add origin https://github.com/VOTRE_USER/maillot-store.git
git push -u origin main
```

`.env.local` est **ignoré par git** — les secrets iront dans le dashboard Render.

### 2.2 Créer le service Web

**Option A — Blueprint** (fichier `render.yaml` à la racine) :

1. [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint**
2. Connecter le repo → Render crée `foot-shop` + le cron.

**Option B — Manuel** :

1. **New → Web Service** → repo GitHub
2. Runtime : **Node**
3. Build : `npm ci && npm run build`
4. Start : `npm start`
5. Région : **Frankfurt** (proche France / Hostinger EU)

### 2.3 Variables d’environnement (Render → Environment)

| Variable | Exemple production |
|----------|-------------------|
| `PRESTASHOP_API_URL` | `https://bo.foot-shop.fr/api` |
| `PRESTASHOP_API_KEY` | clé webservice |
| `PRESTASHOP_IMAGE_HOSTS` | `bo.foot-shop.fr` |
| `PRESTASHOP_LANG_ID` | `1` |
| `PRESTASHOP_SHOP_ID` | `1` |
| `PRESTASHOP_PAID_STATE_ID` | `2` |
| `NEXT_PUBLIC_SITE_URL` | `https://foot-shop.fr` |
| `NEXT_PUBLIC_SITE_NAME` | `Foot Shop` |
| `NEXT_PUBLIC_CURRENCY` | `EUR` |
| `NEXT_PUBLIC_LOCALE` | `fr-FR` |
| `AUTH_SECRET` | 64 caractères aléatoires |
| `SMTP_HOST` | `smtp.hostinger.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `1` |
| `SMTP_USER` | `contact@foot-shop.fr` |
| `SMTP_PASSWORD` | mot de passe boîte mail |
| `MAIL_FROM` | `Foot Shop <contact@foot-shop.fr>` |
| `CONTACT_EMAIL` | `contact@foot-shop.fr` |
| `MAIL_REPLY_TO` | `contact@foot-shop.fr` |
| `STRIPE_SECRET_KEY` | `sk_live_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` |
| `STRIPE_CURRENCY` | `eur` |
| `ADMIN_SECRET` | secret long aléatoire |
| `CRON_SECRET` | même valeur ou autre secret |
| `PRODUCT_IMPORT_CATEGORY_ID` | `11` |
| `NEXT_PUBLIC_ENFANT_MAILLOTS_CATEGORY_ID` | `12` |

Générer `AUTH_SECRET` :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2.4 Domaine custom `foot-shop.fr`

1. Render → service **foot-shop** → **Settings → Custom Domains** → ajouter `foot-shop.fr` et `www.foot-shop.fr`.
2. Render affiche les enregistrements DNS à créer.

**Chez Hostinger (DNS de foot-shop.fr)** :

| Type | Nom | Valeur |
|------|-----|--------|
| CNAME | `www` | URL fournie par Render |
| A ou ALIAS | `@` | IP ou CNAME apex fourni par Render |

Attendre la propagation DNS (5 min à 48 h). Render provisionne le SSL automatiquement.

Mettre à jour `NEXT_PUBLIC_SITE_URL=https://foot-shop.fr` puis **redéployer**.

### 2.5 Stripe en production

1. [dashboard.stripe.com](https://dashboard.stripe.com) → passer en **mode Live**.
2. **Webhooks → Add endpoint** :
   - URL : `https://foot-shop.fr/api/webhooks/stripe`
   - Événements : `checkout.session.completed`, `payment_intent.succeeded`
3. Copier `whsec_...` → `STRIPE_WEBHOOK_SECRET` sur Render.
4. Remplacer `sk_test_` / `pk_test_` par les clés **live**.

### 2.6 Cron alertes stock (Render)

Le fichier `render.yaml` définit un job toutes les 30 min. Après le 1er déploiement, sur le service **foot-shop-notify** :

- `CRON_TARGET_URL` = `https://foot-shop.fr` (ou l’URL `*.onrender.com` temporaire)
- `CRON_SECRET` = même secret que sur le service web

Test manuel :

```bash
curl -H "Authorization: Bearer VOTRE_CRON_SECRET" https://foot-shop.fr/api/cron/notify
```

### 2.7 Vérifications après déploiement

| Test | URL / action |
|------|----------------|
| Santé API | `GET https://foot-shop.fr/api/health` → `{ "ok": true, "prestashop": true }` |
| Catalogue | Page d’accueil affiche les produits |
| Images | Photos produits chargent (`PRESTASHOP_IMAGE_HOSTS` correct) |
| Compte | Inscription / connexion |
| Paiement | Checkout Stripe test puis live |
| Email | Formulaire contact → reçu sur `contact@foot-shop.fr` |

---

## Partie 3 — Limitations importantes

### Fichiers éphémères sur Render (plan gratuit)

Ces données sont stockées sur le disque du conteneur (dossier `.data/`) :

- préférences utilisateur (panier sauvegardé compte)
- alertes stock, newsletter, promos bienvenue, expéditions…

Sur le **plan gratuit**, elles sont **perdues à chaque redéploiement**. Le panier local (navigateur) continue de fonctionner.

**Solutions futures** : disque persistant Render (payant), ou migrer vers Redis / base de données.

### Performances PrestaShop

Tes logs locaux montraient ~3–8 s par requête API. Sur Hostinger mutualisé, ça peut être similaire. Pistes :

- activer le cache PrestaShop ;
- opcode PHP (souvent activé sur Hostinger) ;
- éviter les requêtes inutiles côté Next (déjà mis en cache React Query).

---

## Schéma DNS récapitulatif

```
foot-shop.fr      →  Render (boutique)
www.foot-shop.fr  →  Render
bo.foot-shop.fr   →  Hostinger (PrestaShop + images)
MX                →  Hostinger (emails)
```

---

## Dépannage rapide

| Problème | Cause probable |
|----------|----------------|
| Catalogue vide | `PRESTASHOP_API_URL` / clé incorrecte ; webservice désactivé |
| Images cassées | `PRESTASHOP_IMAGE_HOSTS=bo.foot-shop.fr` manquant |
| 401 webservice | Clé invalide ou permissions insuffisantes |
| Stripe ne finalise pas | Webhook URL ou `STRIPE_WEBHOOK_SECRET` incorrect |
| Emails non reçus | SMTP Hostinger ; vérifier SPF/DKIM |
| Session déconnectée | `AUTH_SECRET` changé entre déploiements |
