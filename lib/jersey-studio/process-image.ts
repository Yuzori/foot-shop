import "server-only";

import sharp from "sharp";

import { compositeCard } from "@/lib/jersey-studio/card-composite";
import {
  ALPHA_THRESHOLD,
  LOSSLESS_PNG,
  WORK_CARD_H,
  WORK_CARD_W,
  WORK_JERSEY_MAX_WIDTH,
  WORK_JERSEY_TARGET_HEIGHT,
} from "@/lib/jersey-studio/constants";
import { downscaleCardForExport } from "@/lib/jersey-studio/export-card";
import {
  prepareInput,
  rawRgba,
  removeBackgroundForDetail,
  rgbaToPng,
  trimWhiteMargins,
} from "@/lib/jersey-studio/image-prep";
import { removeCornerWatermarkArtifacts } from "@/lib/jersey-studio/pixel-utils";
import { getAlphaBounds } from "@/lib/jersey-studio/pixel-utils";

/**
 * Recadre le maillot, redimensionne à taille uniforme et centre sur la carte de travail.
 */
async function normalizeJerseyPng(cutout: Buffer): Promise<Buffer> {
  const { data, width, height } = await sharp(cutout)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
    .then(({ data, info }) => ({
      data: new Uint8Array(data),
      width: info.width,
      height: info.height,
    }));

  const bounds = getAlphaBounds(data, width, height, ALPHA_THRESHOLD);
  if (!bounds) {
    throw new Error("Aucun contour de maillot détecté après détourage.");
  }

  const scaleH = WORK_JERSEY_TARGET_HEIGHT / bounds.height;
  const scaleW = WORK_JERSEY_MAX_WIDTH / bounds.width;
  const scale = Math.min(scaleH, scaleW);
  const targetW = Math.max(1, Math.round(bounds.width * scale));
  const targetH = Math.max(1, Math.round(bounds.height * scale));

  const resized = await sharp(cutout)
    .extract({
      left: bounds.x,
      top: bounds.y,
      width: bounds.width,
      height: bounds.height,
    })
    .resize(targetW, targetH, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .png(LOSSLESS_PNG)
    .toBuffer();

  const resizedMeta = await sharp(resized).metadata();
  const actualW = resizedMeta.width ?? targetW;
  const actualH = resizedMeta.height ?? targetH;
  const left = Math.round((WORK_CARD_W - actualW) / 2);
  const top = Math.round((WORK_CARD_H - actualH) / 2);

  return sharp({
    create: {
      width: WORK_CARD_W,
      height: WORK_CARD_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left, top }])
    .png(LOSSLESS_PNG)
    .toBuffer();
}

/** Pipeline maillot uniforme : trim → détourage → normalisation → fond #161616 + halo. */
export async function renderJerseyProductCard(input: Buffer): Promise<Buffer> {
  const prepared = await prepareInput(input);
  const trimmed = await trimWhiteMargins(prepared);
  const { data, width, height } = await rawRgba(trimmed);
  removeCornerWatermarkArtifacts(data, width, height);
  const cleaned = await rgbaToPng(data, width, height);
  const cutout = await removeBackgroundForDetail(cleaned);
  const normalized = await normalizeJerseyPng(cutout);
  const internal = await compositeCard(normalized);
  return downscaleCardForExport(internal);
}

export async function renderJerseyProductCardBase64(input: Buffer): Promise<string> {
  const png = await renderJerseyProductCard(input);
  return png.toString("base64");
}
