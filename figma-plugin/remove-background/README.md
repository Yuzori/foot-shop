# Plugin Figma — Détourer le fond

Plugin privé pour Foot Shop : sélectionne un calque dans Figma, envoie l'image à [remove.bg](https://www.remove.bg/api), réapplique le PNG transparent sur le calque.

## Prérequis

1. Compte gratuit sur [remove.bg/api](https://www.remove.bg/api) → récupère ta **API Key** (50 crédits / mois gratuits)
2. [Node.js 20+](https://nodejs.org/)
3. Figma Desktop (les plugins de développement ne marchent pas dans le navigateur seul)

## Installation (une fois)

```powershell
cd figma-plugin/remove-background
npm install
npm run build
```

## Lancer le plugin dans Figma

1. Ouvre **Figma Desktop**
2. Menu **Plugins → Development → Import plugin from manifest…**
3. Choisis le fichier `figma-plugin/remove-background/manifest.json` dans ce repo
4. Le plugin apparaît dans **Plugins → Development → Foot Shop — Détourer**

## Utilisation

1. Place ou sélectionne une image (rectangle avec fill image, frame, etc.)
2. Lance le plugin
3. Colle ta clé API → **Enregistrer la clé** (stockée localement dans Figma)
4. **Retirer le fond**
5. Le calque est mis à jour avec le PNG détouré

## Développement

```powershell
npm run watch
```

Puis dans Figma : **Plugins → Development → Reload plugin** après chaque modification.

## Coût remove.bg

| Plan | Crédits |
|------|---------|
| Gratuit | 50 images / mois |
| Payant | À partir de ~0,20 € / image |

Pour un gros volume catalogue, un plan payant ou un traitement batch Photoshop reste plus économique.

## Publier sur la communauté Figma (optionnel)

Si tu veux le partager publiquement :

1. Compte développeur Figma
2. **Publish plugin** depuis le menu Development
3. La mention « accès réseau → api.remove.bg » apparaît sur la page du plugin

## Limites

- Une sélection à la fois
- Nécessite Internet + clé API
- La qualité dépend de remove.bg (excellent sur packshots, variable sur photos complexes)
