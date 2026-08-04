/**
 * Images de fond — section « Univers » sur l’accueil.
 * Placez les fichiers dans `public/` (noms en minuscules pour le déploiement Linux).
 */
export const collectionShowcaseImages = {
  jersey: "/myo.jpg",
  short: "/short.jpg",
  worldCup: "/wc.jpg",
  /**
   * Visuel CDM qui chevauche les cartes Shorts + Coupe du monde (PNG transparent).
   *
   * Dimensions recommandées :
   * - Export web : 600 × 900 px (ratio 2:3)
   * - Retina (@2x) : 1200 × 1800 px
   *
   * Placez le trophée centré dans le cadre, avec ~15 % de marge transparente
   * en haut et en bas pour qu’il déborde naturellement sur les deux cartes.
   */
  worldCupOverlay: "/wc-trophy.png",
} as const;
