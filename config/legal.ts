/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  INFOS LÉGALES — À COMPLÉTER PAR VOUS                                  ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Renseignez ici les informations de votre entreprise. Elles           ║
 * ║  alimentent automatiquement les Mentions légales, les CGV et la       ║
 * ║  Politique de confidentialité. Obligatoire en France (Code de la      ║
 * ║  consommation, LCEN, RGPD).                                            ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * NB : ce contenu est un modèle. Faites-le valider par un professionnel
 * du droit avant mise en production.
 */

export const legalInfo = {
  /** Raison sociale / nom commercial de l'exploitant. */
  companyName: "Foot Shop",
  /** Forme juridique (SAS, SARL, auto-entrepreneur, etc.). */
  legalForm: "À compléter",
  /** Capital social, le cas échéant. */
  shareCapital: "À compléter",
  /** Adresse du siège social. */
  address: "À compléter — Adresse complète",
  /** Email de contact client. */
  email: "contact@footshop.example",
  /** Téléphone (facultatif). */
  phone: "À compléter",
  /** SIREN / SIRET. */
  siret: "À compléter",
  /** Numéro de TVA intracommunautaire. */
  vat: "À compléter",
  /** Numéro RCS et ville d'immatriculation. */
  rcs: "À compléter",
  /** Directeur / responsable de la publication. */
  publicationDirector: "À compléter",
  /** Hébergeur du site (nom, adresse, téléphone). */
  host: "À compléter — Nom de l'hébergeur, adresse, téléphone",
  /** Délai légal de rétractation (jours). */
  withdrawalDays: 14,
  /** Délai de retour commercial (jours). */
  returnDays: 30,
  /** Plateforme de règlement en ligne des litiges (UE). */
  odrUrl: "https://ec.europa.eu/consumers/odr",
} as const;
