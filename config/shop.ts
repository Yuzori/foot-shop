/**
 * Boutique — constantes modifiables (hors données produits PrestaShop).
 */
export const shopConfig = {
  /** Prix du flocage personnalisé (nom / numéro) par maillot. */
  flocagePrice: 2.99,
  flocageLabel: "Flocage personnalisé",
  flocageNameMax: 15,
  flocageNumberMin: 2,
  flocageNumberMax: 2,
  /** Messages sous le bouton d'achat (rotation toutes les 3 s). */
  purchaseTicker: [
    "Livraison gratuite sur toute la boutique",
    "Livraison estimée : 5 à 10 jours ouvrés",
    "Retours gratuits sous 30 jours",
    "Flocage premium disponible sur tous les maillots",
    "Paiement 100 % sécurisé",
  ],
  tickerIntervalMs: 3000,
  /** Afficher le badge « Nouveau » sur les produits récents — mettre false pour le masquer. */
  showNewBadge: false,
  /** Jours pendant lesquels un produit est considéré comme nouveau (si showNewBadge). */
  newProductDays: 30,
  /** En dessous de ce seuil : badge et texte « Bientôt épuisé ». */
  lowStockThreshold: 5,
  /** Référence max pour le dégradé de couleur du stock (ex. 20 = vert à 20+, rouge à 0). */
  stockColorReferenceMax: 20,
  /** Ordre d'affichage des tailles (PrestaShop peut renvoyer d'autres libellés). */
  sizeOrder: ["XS", "S", "M", "L", "XL", "XXL"] as const,
  /** Message livraison gratuite (bandeau + checkout). */
  freeShippingLabel: "Livraison gratuite sur toute la boutique",
} as const;

/** Formate le flocage pour l'affichage et les commandes fournisseur. */
export function formatFlocageLabel(f: {
  name: string;
  number: string;
}): string {
  const name = f.name.trim().toUpperCase();
  const num = f.number.trim();
  return num ? `${name} ${num}` : name;
}
