import "server-only";

import sharp from "sharp";

import {
  ALPHA_THRESHOLD,
  CARD_BG,
  FEATHER_HARD_TOL,
  JERSEY_BINARY_ALPHA,
  JERSEY_CUTOUT_TOL,
  LOSSLESS_PNG,
  STUDIO_PHOTO_BG,
  WHITE_THRESHOLD,
} from "@/lib/jersey-studio/constants";
import {
  binarySilhouetteAlpha,
  cleanColorFringe,
  detectBackgroundRefs,
  finalizeSilhouetteAlpha,
  floodFillBackground,
  defringeAgainstBackground,
  getContentBounds,
  getAlphaBounds,
  isAccentStripePixel,
  isJerseyFabricPixel,
  pruneOutlineHalos,
  removeExteriorLightFringe,
  repairAccentHighlights,
  repairEnclosedTransparentHoles,
  removeOutlineStudioBleed,
  solidifyJerseyColors,
  stripNeutralOutlineFringe,
  touchesTransparentNeighbor,
} from "@/lib/jersey-studio/pixel-utils";

export async function rawRgba(buffer: Buffer): Promise<{
  data: Uint8Array;
  width: number;
  height: number;
}> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
}

export async function rgbaToPng(
  data: Uint8Array,
  width: number,
  height: number,
): Promise<Buffer> {
  return sharp(Buffer.from(data), {
    raw: { width, height, channels: 4 },
  })
    .png(LOSSLESS_PNG)
    .toBuffer();
}

/** Upscale uniquement les sources vraiment petites — évite upscale puis downscale. */
export async function prepareInput(input: Buffer): Promise<Buffer> {
  const rotated = await sharp(input).rotate().png(LOSSLESS_PNG).toBuffer();
  const meta = await sharp(rotated).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const minDim = Math.min(width, height);

  if (minDim > 0 && minDim < 1200) {
    const scale = 1200 / minDim;
    return sharp(rotated)
      .resize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)), {
        kernel: sharp.kernel.lanczos3,
      })
      .png(LOSSLESS_PNG)
      .toBuffer();
  }

  return rotated;
}

export async function trimWhiteMargins(input: Buffer): Promise<Buffer> {
  const { data, width, height } = await rawRgba(input);
  const bounds = getContentBounds(data, width, height, ALPHA_THRESHOLD, WHITE_THRESHOLD);
  if (!bounds) return input;

  return sharp(input)
    .extract({
      left: bounds.x,
      top: bounds.y,
      width: bounds.width,
      height: bounds.height,
    })
    .png(LOSSLESS_PNG)
    .toBuffer();
}

export async function removeBackground(input: Buffer): Promise<Buffer> {
  return removeBackgroundInternal(input, { aggressiveFringe: true });
}

/** Détourage détail : conserve les couleurs du maillot. */
export async function removeBackgroundForDetail(input: Buffer): Promise<Buffer> {
  return removeBackgroundInternal(input, { aggressiveFringe: false });
}

/** Détourage maillot : coupe nette, sans anti-aliasing. */
export async function removeBackgroundForJersey(input: Buffer): Promise<Buffer> {
  const { data, width, height } = await rawRgba(input);
  const refs = detectBackgroundRefs(data, width, height);
  const mask = new Uint8Array(width * height);

  floodFillBackground(mask, data, width, height, refs, JERSEY_CUTOUT_TOL);

  for (let p = 0; p < width * height; p++) {
    if (mask[p]) data[p * 4 + 3] = 0;
  }

  stripNeutralOutlineFringe(data, width, height);
  cleanColorFringeLight(data, width, height);
  binarySilhouetteAlpha(data, width, height, JERSEY_BINARY_ALPHA);

  return rgbaToPng(data, width, height);
}

async function removeBackgroundInternal(
  input: Buffer,
  opts: { aggressiveFringe: boolean },
): Promise<Buffer> {
  const { data, width, height } = await rawRgba(input);
  const work = new Uint8Array(data);
  const refs = detectBackgroundRefs(work, width, height);
  const mask = new Uint8Array(width * height);

  floodFillBackground(mask, work, width, height, refs, FEATHER_HARD_TOL);

  for (let p = 0; p < width * height; p++) {
    if (mask[p]) work[p * 4 + 3] = 0;
  }

  repairEnclosedTransparentHoles(work, width, height);
  removeOutlineStudioBleed(work, width, height);

  if (opts.aggressiveFringe) {
    cleanColorFringe(work, width, height);
  }

  pruneOutlineHalos(work, width, height);
  removeExteriorLightFringe(work, width, height, CARD_BG);
  solidifyJerseyColors(work, width, height);
  finalizeSilhouetteAlpha(work, width, height);

  const bounds = getAlphaBounds(work, width, height, ALPHA_THRESHOLD);
  const totalArea = width * height;
  const keptRatio = bounds ? (bounds.width * bounds.height) / totalArea : 0;

  if (!bounds || keptRatio < 0.04) {
    throw new Error("Aucun contour de maillot détecté après détourage.");
  }

  return rgbaToPng(work, width, height);
}

/** Nettoyage léger : franges quasi blanches uniquement. */
function cleanColorFringeLight(
  data: Uint8Array,
  width: number,
  height: number,
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const i = p * 4;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const a = data[i + 3] ?? 0;
      if (a === 0 || a >= 240) continue;
      if (!touchesTransparentNeighbor(data, width, height, x, y)) continue;
      if (isJerseyFabricPixel(r, g, b) || isAccentStripePixel(r, g, b)) continue;

      const nearWhite = r >= 248 && g >= 248 && b >= 248;
      if (nearWhite && a < 200) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      }
    }
  }
}

export async function polishCutout(png: Buffer): Promise<Buffer> {
  const { data, width, height } = await rawRgba(png);
  pruneOutlineHalos(data, width, height);
  cleanColorFringe(data, width, height);
  solidifyJerseyColors(data, width, height);
  finalizeSilhouetteAlpha(data, width, height);
  return rgbaToPng(data, width, height);
}

/** Finition maillot : pas d'anti-aliasing, contour binaire net. */
export async function polishCutoutJersey(png: Buffer): Promise<Buffer> {
  const { data, width, height } = await rawRgba(png);
  stripNeutralOutlineFringe(data, width, height);
  cleanColorFringeLight(data, width, height);
  binarySilhouetteAlpha(data, width, height, JERSEY_BINARY_ALPHA);
  return rgbaToPng(data, width, height);
}

/** Finition détail : pas de flou, dimensions carte conservées. */
export async function polishCutoutDetail(png: Buffer): Promise<Buffer> {
  const { data, width, height } = await rawRgba(png);
  repairEnclosedTransparentHoles(data, width, height);
  removeOutlineStudioBleed(data, width, height);
  stripNeutralOutlineFringe(data, width, height);
  defringeAgainstBackground(
    data,
    width,
    height,
    STUDIO_PHOTO_BG.r,
    STUDIO_PHOTO_BG.g,
    STUDIO_PHOTO_BG.b,
    { protectSaturated: true },
  );
  pruneOutlineHalos(data, width, height);
  cleanColorFringeLight(data, width, height);
  removeExteriorLightFringe(data, width, height, CARD_BG);
  repairAccentHighlights(data, width, height);
  solidifyJerseyColors(data, width, height);
  finalizeSilhouetteAlpha(data, width, height);
  return rgbaToPng(data, width, height);
}

export async function applyOpacity(png: Buffer, opacity: number): Promise<Buffer> {
  const { data, width, height } = await rawRgba(png);
  for (let i = 3; i < data.length; i += 4) {
    const alpha = data[i] ?? 0;
    data[i] = Math.round(alpha * opacity);
  }
  return rgbaToPng(data, width, height);
}
