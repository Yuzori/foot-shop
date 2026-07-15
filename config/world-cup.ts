import { routes } from "@/config/site";

/**
 * Zone World Cup — modifiable sans toucher aux composants.
 *
 * • categoryId : ID de la catégorie PrestaShop « Coupe du monde » (si définie).
 * • href : lien de la zone (catégorie ou page dédiée).
 * • Image bannière : placez wc.jpg dans public/ (anciennement worldcup-banner.jpg).
 */
export const worldCupConfig = {
  enabled: true,
  label: "World Cup",
  /** Lien nav + section accueil. Remplacez par routes.category("3") si besoin. */
  href: routes.category("11"),
  categoryId: "11",
  bannerDesktop: "/wc.jpg",
  bannerMobile: "/wc.jpg",
  /** Texte d’accessibilité — le visuel affiche déjà « World Cup ». */
  ariaLabel: "Collection World Cup",
  subline: "",
  ctaLabel: "Explorer la collection",
} as const;
