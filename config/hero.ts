import { routes } from "@/config/site";

/** Contenu hero — thème paint (maquette). */
export const heroPaintConfig = {
  eyebrow: "Collection premium · Saison en cours",
  /** Image titre hero — `public/titre.png` */
  titleImage: "/titre.png",
  titleAlt: "Portez les couleurs de la légende",
  description:
    "Maillots et shorts, éditions limitées et flocage personnalisé. Une sélection pensée pour les vrais passionnés.",
  ctaJerseys: "Voir les maillots",
  ctaShorts: "Voir les shorts",
  seasonLabel: "Season",
  seasonValue: "24-25",
  /** Texte vertical défilant à droite */
  seasonTicker: [
    "Season 24-25",
    "Collection premium",
    "Éditions limitées",
    "Flocage personnalisé",
    "Nouveautés",
  ],
  newDrop: {
    label: "Nouvelle collection",
    sublabel: "Découvrir",
    image: "/myo.jpg",
    href: `${routes.catalogue}?sort=newest`,
  },
  /** Bandeau confiance sous le hero (sans livraison express). */
  trustItems: [
    { id: "secure", label: "Paiement 100% sécurisé" },
    { id: "shipping", label: "Livraison offerte — 1ʳᵉ commande" },
    { id: "bogo", label: "2 achetés, 1 offert" },
    { id: "returns", label: "Retours gratuits 14 jours" },
    { id: "flocage", label: "Flocage premium" },
  ],
} as const;
