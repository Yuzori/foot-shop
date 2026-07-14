/**
 * Offre de bienvenue : 2 achetés, 1 offert (3ᵉ article gratuit au checkout).
 * Modifiez les textes ici — le reste du site s’aligne automatiquement.
 */

export interface PromoPopup {
  enabled: boolean;
  id: string;
  eyebrow: string;
  title: string;
  message: string;
  code: string;
  cta: { label: string; href: string };
  delayMs: number;
}

export const promoPopup: PromoPopup = {
  enabled: true,
  id: "welcome-bogo-2026",
  eyebrow: "Offre de bienvenue",
  title: "2 achetés, 1 offert",
  message:
    "Créez un compte et profitez de 2 achetés, 1 offert sur votre première commande — le 3ᵉ article est offert automatiquement au paiement.",
  code: "",
  cta: { label: "J'en profite", href: "/creer-compte" },
  delayMs: 3500,
};

/** Promo de bienvenue — 2+1 sur la première commande (une seule utilisation). */
export const welcomePromo = {
  enabled: true,
  code: "",
  /** Texte marketing site-wide */
  label: "2 achetés, 1 offert",
  /** Texte checkout / paiement */
  checkoutLabel: "3ᵉ article offert",
  shortLabel: "2+1 offert",
  /** Nombre d’articles payants pour déclencher 1 gratuit */
  buyQty: 2,
  freeQty: 1,
} as const;

/** Code promo remerciement 1ʳᵉ commande (-10 %). */
export const firstOrderThankYouPromo = {
  code: "FOODSHOP10",
  percent: 10,
  label: "10 % sur votre prochaine commande",
} as const;

export const announcementMessages: string[] = [
  "2 achetés, 1 offert sur votre 1ʳᵉ commande — créez un compte",
  "Livraison offerte sur votre 1ʳᵉ commande",
  "Livraison express disponible",
  "Retours gratuits sous 30 jours",
  "Maillots & shorts officiels — flocage premium",
  "Paiement 100% sécurisé",
];
