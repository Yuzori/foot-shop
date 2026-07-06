# MAILLOT — Storefront premium (Next.js 15)

Front-end e-commerce **haut de gamme** pour une boutique de maillots de football.
Le front est **totalement découplé** : **PrestaShop sert uniquement de Back Office**.

> **Règle d'or du projet : aucune donnée fictive.**
> Aucun produit, prix, club, joueur ou catégorie n'est codé en dur. Toutes les
> données proviennent de l'API. Si l'API est vide ou non connectée, les pages
> affichent des **Empty States élégants** — jamais de démo.

---

## Stack

- **Next.js 15** (App Router) + **React 19**
- **TypeScript** strict
- **Tailwind CSS** (design system premium)
- **Framer Motion** (animations fluides, micro-interactions)
- **TanStack React Query** (data fetching/cache)
- **Axios** (client HTTP)
- **Zustand** (panier & favoris persistés)
- **ESLint** (next/core-web-vitals + typescript)

## Démarrage

```bash
npm install
cp .env.example .env.local   # puis renseignez vos variables
npm run dev
```

- `npm run dev` — serveur de développement
- `npm run build` — build de production
- `npm run start` — serveur de production
- `npm run lint` — ESLint
- `npm run type-check` — vérification TypeScript

## Déploiement production

| Guide | Contenu |
|-------|---------|
| **[prestashop-kali-to-hostinger.md](docs/prestashop-kali-to-hostinger.md)** | **Commencer ici** — migrer PrestaShop + MariaDB depuis Kali |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Boutique Next.js (Hostinger Node.js ou Render) |

## Connexion au Back Office PrestaShop

Le front ne parle **jamais** directement à PrestaShop depuis le navigateur.
Le flux est :

```
Composant → hook (React Query) → lib/api.ts (axios → /api/*)
          → route handler Next (app/api/*) → services/prestashop.ts → PrestaShop
```

La clé Webservice reste **secrète côté serveur**. Pour connecter une instance,
il suffit de renseigner `.env.local` — **aucun composant n'est à modifier** :

| Variable                  | Description                                           |
| ------------------------- | ----------------------------------------------------- |
| `PRESTASHOP_API_URL`      | URL du Webservice, finissant par `/api`               |
| `PRESTASHOP_API_KEY`      | Clé Webservice (Basic Auth, mot de passe vide)        |
| `PRESTASHOP_IMAGE_HOSTS`  | Hôtes images (séparés par des virgules) pour next/image |
| `PRESTASHOP_LANG_ID`      | Id de langue (souvent `1`)                            |
| `NEXT_PUBLIC_SITE_NAME`   | Nom affiché de la boutique                            |
| `NEXT_PUBLIC_CURRENCY`    | Devise d'affichage (ex. `EUR`)                        |
| `NEXT_PUBLIC_LOCALE`      | Locale d'affichage (ex. `fr-FR`)                      |

Activez le Webservice dans PrestaShop : **Paramètres avancés → Webservice**,
puis créez une clé avec les permissions de lecture sur `products`, `categories`,
`combinations`, `product_option_values`, `stock_availables`, `images`, `orders`.

Tant que `PRESTASHOP_API_URL` / `PRESTASHOP_API_KEY` ne sont pas renseignés, le
service renvoie des résultats vides et l'UI affiche ses Empty States.

## Architecture

```
app/                  # Pages (App Router) + route handlers (app/api)
components/            # Composants génériques (props uniquement)
  ui/                 # Primitives (Button, Price, EmptyState, Field…)
  layout/             # Header, Footer, nav, icônes
  product/            # Carte produit, galerie, variantes, achat
  category/ home/ …   # Sections métier
  motion/             # Reveal / Stagger (Framer Motion)
config/               # Configuration centralisée (env, routes, nav)
hooks/                # Hooks React Query + utilitaires
lib/                  # axios client interne, query client, format, utils
providers/            # Providers React (React Query)
services/             # services/prestashop.ts = SEUL accès au Back Office
store/                # Zustand (panier, favoris)
styles/               # globals.css (Tailwind + design tokens)
types/                # domain.ts (modèles UI) + prestashop.ts (bruts)
```

### Principes

- **Un seul service** (`services/prestashop.ts`) parle à PrestaShop. Aucun `fetch`
  dispersé dans les composants.
- **Mappers** (`services/mappers.ts`) : seule zone consciente des formats
  PrestaShop. Les composants ne connaissent que les modèles de `types/domain.ts`.
- **Composants génériques** : ils reçoivent uniquement des `props`.
- **Découplage total** : changer de back office = réécrire le service + les
  mappers, sans toucher aux composants.

## Pages

Accueil, Boutique (catalogue), Catégories + Catégorie, Produit, Recherche,
Favoris, Panier, Paiement, Connexion, Création de compte, Compte, Historique des
commandes, Suivi de commande, Contact, À propos, Mentions légales,
Confidentialité, CGV, 404.

## Notes sur le périmètre

Les flux nécessitant l'**écriture** ou une **session client** (création de
commande, comptes, messagerie) affichent un état honnête tant que les API
correspondantes ne sont pas branchées — **aucune confirmation ni compte fictif
n'est fabriqué**. Le **panier** et les **favoris** sont locaux (standard
e-commerce) et toujours construits à partir de produits réels du back office.
Le **suivi de commande** est, lui, pleinement fonctionnel via l'API `orders`.
