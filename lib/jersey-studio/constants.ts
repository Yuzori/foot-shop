/** PNG interne (pipeline) — sans compression zlib pour éviter les artefacts de recompression. */
export const LOSSLESS_PNG = {
  compressionLevel: 0,
  adaptiveFiltering: false,
} as const;

/** PNG export final — compressé sans perte de pixels, fichier raisonnable. */
export const EXPORT_PNG = {
  compressionLevel: 6,
  effort: 8,
} as const;

/** Rendu interne 2× puis export Lanczos → qualité nette sans artefacts. */
export const INTERNAL_EXPORT_SCALE = 2;

export const RENDER_SCALE = 2;
/** Dimensions carte produit exportées (px) — ratio 4:5 comme Figma. */
export const CARD_W = 328 * RENDER_SCALE;
export const CARD_H = 411 * RENDER_SCALE;
/** Dimensions de travail (supersampling avant export). */
export const WORK_CARD_W = CARD_W * INTERNAL_EXPORT_SCALE;
export const WORK_CARD_H = CARD_H * INTERNAL_EXPORT_SCALE;
/** Hauteur uniforme du maillot sur la carte (tous les produits alignés). */
export const JERSEY_TARGET_HEIGHT = 330 * RENDER_SCALE;
export const JERSEY_MAX_WIDTH = 300 * RENDER_SCALE;
export const WORK_JERSEY_TARGET_HEIGHT = JERSEY_TARGET_HEIGHT * INTERNAL_EXPORT_SCALE;
export const WORK_JERSEY_MAX_WIDTH = JERSEY_MAX_WIDTH * INTERNAL_EXPORT_SCALE;
export const ALPHA_THRESHOLD = 14;
export const WHITE_THRESHOLD = 246;
export const CARD_BG = { r: 22, g: 22, b: 22 };
/** Fond photo studio typique (blanc / gris clair) — distinct du fond carte #161616. */
export const STUDIO_PHOTO_BG = { r: 238, g: 238, b: 238 };
/** Figma plugin : LAYER_BLUR 119 @ 328px → ~50 sigma @ 656px (RENDER_SCALE 2×). */
export const HALO_BLUR_SIGMA = 50;
export const WORK_HALO_BLUR_SIGMA = HALO_BLUR_SIGMA * INTERNAL_EXPORT_SCALE;
/** Figma plugin : halo.opacity = 0.37 */
export const HALO_OPACITY = 0.37;
export const DETAIL_HALO_BLUR_SIGMA = 50;
export const DETAIL_WORK_HALO_BLUR_SIGMA = DETAIL_HALO_BLUR_SIGMA * INTERNAL_EXPORT_SCALE;
export const DETAIL_HALO_OPACITY = 0.37;
export const FEATHER_HARD_TOL = 36;
export const JERSEY_CUTOUT_TOL = 32;
export const JERSEY_BINARY_ALPHA = 140;
export const FEATHER_SOFT_TOL = FEATHER_HARD_TOL + 6;
export const DEFAULT_STOCK = 20;
export const STUDIO_MAX_IMAGES = 24;

/** Délai max rendu API — sous la limite Render (~30 s) pour renvoyer une erreur JSON. */
export const JERSEY_RENDER_DEADLINE_MS =
  Number(process.env.JERSEY_RENDER_DEADLINE_MS) ||
  (process.env.RENDER === "true" ? 27_000 : 110_000);
