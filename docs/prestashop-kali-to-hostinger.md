# Migration PrestaShop + MariaDB — Kali Linux → Hostinger

Guide pas à pas pour déplacer ton back-office PrestaShop (`192.168.1.68/prestashop`) vers `https://bo.foot-shop.fr` sur Hostinger.

**Durée estimée :** 1 à 2 h (selon la taille des images produits).

---

## Vue d’ensemble

```
┌─────────────────┐     export      ┌──────────────┐     upload      ┌─────────────────┐
│  VM Kali Linux  │  ────────────►  │  Ton PC      │  ────────────►  │  Hostinger      │
│  MariaDB + PS   │   .sql.gz       │  (Windows)   │   FTP/hPanel    │  MySQL + bo/    │
│  192.168.1.68   │   .tar.gz       │              │                 │  foot-shop.fr   │
└─────────────────┘                 └──────────────┘                 └─────────────────┘
```

---



## Phase 1 — Préparer Hostinger (15 min)



### 1.1 Créer le sous-domaine

**hPanel → Domaines → Sous-domaines**


| Champ        | Valeur           |
| ------------ | ---------------- |
| Sous-domaine | `bo`             |
| Dossier      | `public_html/bo` |


→ `https://bo.foot-shop.fr`

### 1.2 Créer la base MySQL

**hPanel → Bases de données → Bases de données MySQL**

1. Créer une base (ex. `u123456789_prestashop`)
2. Créer un utilisateur avec mot de passe fort
3. Associer l’utilisateur à la base (**tous les privilèges**)
4. **Noter** (tu en auras besoin plus tard) :


| Info         | Exemple                                            |
| ------------ | -------------------------------------------------- |
| Hôte MySQL   | `localhost` ou `mysql.hostinger.com` (voir hPanel) |
| Nom BDD      | `u123456789_prestashop`                            |
| Utilisateur  | `u123456789_psuser`                                |
| Mot de passe | `********`                                         |




### 1.3 SSL

**hPanel → SSL** → activer Let’s Encrypt pour `bo.foot-shop.fr`

---



## Phase 2 — Exporter depuis Kali (30 min)



### 2.1 Copier le script sur la VM

Depuis ton PC (PowerShell), si la VM est accessible en SSH :

```powershell
scp -r C:\Users\elamm\Projects\maillot-store\scripts\migration kali@192.168.1.68:~/
```

Ou copie le dossier `scripts/migration` via partage VirtualBox.

### 2.2 Trouver le dossier PrestaShop sur Kali

Sur la VM :

```bash
# Emplacements courants
ls /var/www/html/prestashop
ls /var/www/prestashop
```

Ton `.env.local` pointe vers `http://192.168.1.68/prestashop` → souvent `/var/www/html/prestashop`.

### 2.3 Lancer l’export

```bash
cd ~/migration
chmod +x export-from-kali.sh

# Adapter si ton chemin est différent
PS_DIR=/var/www/html/prestashop ./export-from-kali.sh
```

Le script produit un dossier `~/prestashop-export/YYYYMMDD-HHMMSS/` avec :


| Fichier                    | Contenu                           |
| -------------------------- | --------------------------------- |
| `prestashop.sql.gz`        | Dump MariaDB complet              |
| `prestashop-files.tar.gz`  | Fichiers PrestaShop (sans cache)  |
| `db-prefix.txt`            | Préfixe tables (`ps_` en général) |
| `hostinger-url-update.sql` | SQL pour corriger les URLs        |




### 2.4 Transférer vers Windows

```bash
# Depuis Kali — remplace par l’IP de ton PC Windows
scp -r ~/prestashop-export/202* elamm@192.168.1.X:~/Desktop/prestashop-export/
```

Ou glisser-déposer via le partage VirtualBox.

### 2.5 Export manuel (si le script échoue)

**Base de données :**

```bash
mysqldump -u root -p NOM_DE_TA_BDD > prestashop.sql
gzip prestashop.sql
```

**Fichiers :**

```bash
cd /var/www/html
sudo tar -czf prestashop-files.tar.gz \
  --exclude='prestashop/var/cache' \
  --exclude='prestashop/img/tmp' \
  prestashop
```

---



## Phase 3 — Importer sur Hostinger (45 min)



### 3.1 Importer la base de données

1. **hPanel → phpMyAdmin** → sélectionner ta nouvelle base
2. Onglet **Importer**
3. Choisir `prestashop.sql.gz` (ou décompresser en `.sql` si phpMyAdmin refuse le .gz)
4. Taille max : si le fichier est trop gros, utilise **BigDump** ou compresse en plusieurs parties, ou importe en SSH (plan VPS) — sur mutualisé, contacte le support Hostinger si > 256 Mo

**Import lent ?** Désactive temporalement les clés étrangères dans phpMyAdmin avant import si erreurs.

### 3.2 Uploader les fichiers

**Option A — Gestionnaire de fichiers hPanel**

1. Aller dans `public_html/bo`
2. Supprimer le contenu par défaut (`index.html` etc.)
3. Uploader `prestashop-files.tar.gz`
4. Extraire l’archive (clic droit → Extract)
5. **Important :** le contenu de PrestaShop doit être **directement** dans `public_html/bo/`, pas dans `public_html/bo/prestashop/`

Structure attendue :

```
public_html/bo/
  index.php
  app/
  admin/
  img/
  ...
```

Si l’archive a créé un sous-dossier `prestashop/`, déplace tout un niveau au-dessus.

**Option B — FileZilla (FTP)**

- Hôte : voir hPanel → FTP
- Utilisateur / mot de passe FTP Hostinger
- Uploader vers `public_html/bo`



### 3.3 Configurer la connexion MySQL

Éditer `public_html/bo/app/config/parameters.php` (hPanel → Éditeur de fichiers) :

```php
'database_host' => 'localhost',        // ou valeur hPanel
'database_name' => 'u123456789_prestashop',
'database_user' => 'u123456789_psuser',
'database_password' => 'TON_MOT_DE_PASSE_HOSTINGER',
```

Sauvegarder. Ne partage jamais ce fichier publiquement.

### 3.4 Corriger les URLs

**phpMyAdmin → ta base → SQL** → coller le contenu de `hostinger-url-update.sql`

Si ton préfixe n’est pas `ps_` (voir `db-prefix.txt`), remplace `ps_` par ton préfixe dans le SQL.

### 3.5 Permissions (si erreur 500)

Dossiers en **755**, fichiers en **644**. Via hPanel ou :

```bash
# Si tu as accès SSH Hostinger
chmod -R 755 var cache img upload download
chmod -R 644 app/config/parameters.php
```

Sur mutualisé, le gestionnaire de fichiers Hostinger gère souvent ça automatiquement.

### 3.6 Vider le cache PrestaShop

Supprimer le contenu de :

- `public_html/bo/var/cache/` (tous les sous-dossiers)

---



## Phase 4 — Vérifications (15 min)



### 4.1 Back-office

Ouvrir : `https://bo.foot-shop.fr/admin`

- Connexion avec ton compte admin habituel
- Si page blanche : vérifier `parameters.php` et les logs dans `var/logs/`



### 4.2 Webservice (pour la boutique Next.js)

**Paramètres avancés → Webservice**

1. Activer le webservice
2. Créer une clé (garder la même clé `SHREESDX...` si possible, ou en créer une nouvelle)
3. Permissions : `products`, `categories`, `combinations`, `stock_availables`, `images`, `orders`, `customers`, `addresses`, `carts`, `product_option_values`, `product_options`

Test depuis ton PC :

```powershell
curl -u "TA_CLE_API:" https://bo.foot-shop.fr/api/
```

Réponse XML = OK.

### 4.3 Images produits

Ouvrir un produit dans le BO → vérifier que les images s’affichent.

### 4.4 Mettre à jour `.env.local` (boutique locale)

```env
PRESTASHOP_API_URL=https://bo.foot-shop.fr/api
PRESTASHOP_API_KEY=ta_cle_webservice
PRESTASHOP_IMAGE_HOSTS=bo.foot-shop.fr
```

Redémarrer `npm run dev` et vérifier que le catalogue charge.

---



## Dépannage


| Problème                      | Solution                                               |
| ----------------------------- | ------------------------------------------------------ |
| Erreur 500 après upload       | `parameters.php`, permissions `var/`, vider cache      |
| BO redirige vers 192.168.1.68 | Rejouer `hostinger-url-update.sql`                     |
| Import SQL trop gros          | Compression, ou demander augmentation limite Hostinger |
| `Access denied` MySQL         | Vérifier user/BDD associés dans hPanel                 |
| Images cassées                | Vérifier que dossier `img/` est bien uploadé           |
| API 401                       | Webservice activé + clé correcte                       |
| SSL mixed content             | `PS_SSL_ENABLED` = 1 dans `ps_configuration`           |


---



## Prochaine étape

Une fois PrestaShop OK sur `bo.foot-shop.fr` :

1. Déployer la boutique Next.js (Hostinger Node.js **ou** Render)
2. Variables prod avec `PRESTASHOP_API_URL=https://bo.foot-shop.fr/api`
3. Stripe webhook en production

Voir aussi : [DEPLOYMENT.md](./DEPLOYMENT.md)