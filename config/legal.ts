/**
 * Informations légales — alimentent Mentions légales, CGV et Confidentialité.
 * Renseignez les champs « À compléter » avant mise en production (obligation LCEN / Code de la consommation).
 */

function envOr(key: string, fallback: string): string {
  const value = process.env[key]?.trim();
  return value || fallback;
}

export const legalInfo = {
  companyName: envOr("NEXT_PUBLIC_SITE_NAME", "Foot Shop"),
  legalForm: envOr("LEGAL_FORM", "Micro-entreprise"),
  shareCapital: envOr("LEGAL_CAPITAL", "Non applicable"),
  address: envOr("LEGAL_ADDRESS", "France — adresse à compléter"),
  email: envOr("CONTACT_EMAIL", "contact@foot-shop.fr"),
  phone: envOr("LEGAL_PHONE", "Non communiqué"),
  siret: envOr("LEGAL_SIRET", "À compléter"),
  vat: envOr("LEGAL_VAT", "Franchise en base de TVA — article 293 B du CGI"),
  rcs: envOr("LEGAL_RCS", "À compléter"),
  publicationDirector: envOr("LEGAL_DIRECTOR", "Le responsable de la publication"),
  host: envOr(
    "LEGAL_HOST",
    "Hostinger International Ltd. — 61 Lordou Vironos Street, 6023 Larnaca, Chypre",
  ),
  withdrawalDays: 14,
  returnDays: 30,
  odrUrl: "https://ec.europa.eu/consumers/odr",
  /** Médiateur de la consommation (obligatoire pour les professionnels). */
  mediatorName: envOr("LEGAL_MEDIATOR_NAME", "Médiateur de la consommation — à désigner"),
  mediatorUrl: envOr("LEGAL_MEDIATOR_URL", "https://ec.europa.eu/consumers/odr"),
} as const;
