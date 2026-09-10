/**
 * Informations légales - alimentent Mentions légales, CGV et Confidentialité.
 * Surcharge possible via variables d'environnement LEGAL_* (obligation LCEN / Code de la consommation).
 */

function envOr(key: string, fallback: string): string {
  const value = process.env[key]?.trim();
  return value || fallback;
}

export const legalInfo = {
  /** Nom commercial du site. */
  companyName: envOr("NEXT_PUBLIC_SITE_NAME", "Foot Shop"),
  /** Dénomination de l'entrepreneur (mémento fiscal). */
  proprietorName: envOr("LEGAL_PROPRIETOR", "BOUCHAOUR ZAKARIA"),
  legalForm: envOr("LEGAL_FORM", "Entrepreneur individuel"),
  shareCapital: envOr("LEGAL_CAPITAL", "Non applicable"),
  address: envOr(
    "LEGAL_ADDRESS",
    "79 rue du Huit Mai 1945, 69100 Villeurbanne, France",
  ),
  email: envOr("CONTACT_EMAIL", "contact@foot-shop.fr"),
  phone: envOr("LEGAL_PHONE", "Non communiqué"),
  siret: envOr("LEGAL_SIRET", "109 167 346 00013"),
  apeCode: envOr("LEGAL_APE", "4791B"),
  activity: envOr(
    "LEGAL_ACTIVITY",
    "Vente à distance sur catalogue spécialisé",
  ),
  vat: envOr(
    "LEGAL_VAT",
    "TVA non applicable, article 293 B du CGI (franchise en base)",
  ),
  rcs: envOr("LEGAL_RCS", "RCS Lyon — SIREN 109 167 346"),
  publicationDirector: envOr("LEGAL_DIRECTOR", "Zakaria Bouchaour"),
  host: envOr(
    "LEGAL_HOST",
    "Hostinger International Ltd. - 61 Lordou Vironos Street, 6023 Larnaca, Chypre",
  ),
  withdrawalDays: 14,
  /** Délai commercial « changer d'avis » à compter de la réception. */
  returnDays: 14,
  odrUrl: "https://ec.europa.eu/consumers/odr",
  /** Médiateur de la consommation (obligatoire pour les professionnels). */
  mediatorName: envOr("LEGAL_MEDIATOR_NAME", "Médiateur de la consommation - à désigner"),
  mediatorUrl: envOr("LEGAL_MEDIATOR_URL", "https://ec.europa.eu/consumers/odr"),
} as const;
