import "server-only";

import sharp from "sharp";

import {
  CARD_BG,
  LOSSLESS_PNG,
  WORK_CARD_H,
  WORK_CARD_W,
  WORK_HALO_BLUR_SIGMA,
  HALO_OPACITY,
} from "@/lib/jersey-studio/constants";
import { isProtectedJerseyPixel, isJerseyFabricPixel, isStudioBackgroundPixel } from "@/lib/jersey-studio/pixel-utils";
import { applyOpacity, rawRgba, rgbaToPng } from "@/lib/jersey-studio/image-prep";

export async function fitToCardLayer(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .resize(WORK_CARD_W, WORK_CARD_H, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .png(LOSSLESS_PNG)
    .toBuffer();
}

/** Halo identique maillot / détail — franges quasi blanches uniquement, flou doux. */
export async function buildColoredHalo(jerseyLayer: Buffer): Promise<Buffer> {
  const { data, width, height } = await rawRgba(jerseyLayer);

  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const a = data[i + 3] ?? 0;

    if (a < 24) {
      data[i + 3] = 0;
      continue;
    }

    if (isStudioBackgroundPixel(r, g, b) && !isJerseyFabricPixel(r, g, b)) {
      data[i + 3] = 0;
      continue;
    }

    const nearWhite = r >= 248 && g >= 248 && b >= 248;
    const paleFringe =
      a < 210 && !isProtectedJerseyPixel(r, g, b) && nearWhite;

    if (paleFringe) {
      data[i] = CARD_BG.r;
      data[i + 1] = CARD_BG.g;
      data[i + 2] = CARD_BG.b;
      data[i + 3] = 0;
      continue;
    }
  }

  const sanitized = await rgbaToPng(data, width, height);
  const blurred = await sharp(sanitized)
    .blur(WORK_HALO_BLUR_SIGMA)
    .png(LOSSLESS_PNG)
    .toBuffer();
  return applyOpacity(blurred, HALO_OPACITY);
}

async function compositeCardInternal(normalizedJersey: Buffer): Promise<Buffer> {
  const meta = await sharp(normalizedJersey).metadata();
  const jerseyLayer =
    meta.width === WORK_CARD_W && meta.height === WORK_CARD_H
      ? normalizedJersey
      : await fitToCardLayer(normalizedJersey);

  const halo = await buildColoredHalo(jerseyLayer);

  const flatBg = await sharp({
    create: {
      width: WORK_CARD_W,
      height: WORK_CARD_H,
      channels: 3,
      background: CARD_BG,
    },
  })
    .png(LOSSLESS_PNG)
    .toBuffer();

  return sharp(flatBg)
    .composite([
      { input: halo, blend: "over" },
      { input: jerseyLayer, blend: "over" },
    ])
    .png(LOSSLESS_PNG)
    .toBuffer();
}

export async function compositeCard(normalizedJersey: Buffer): Promise<Buffer> {
  return compositeCardInternal(normalizedJersey);
}

export async function compositeDetailCard(normalizedJersey: Buffer): Promise<Buffer> {
  return compositeCardInternal(normalizedJersey);
}
