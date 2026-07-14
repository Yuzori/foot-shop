import "server-only";

import sharp from "sharp";

import { compositeDetailCard } from "@/lib/jersey-studio/card-composite";
import { LOSSLESS_PNG, WORK_CARD_H, WORK_CARD_W } from "@/lib/jersey-studio/constants";
import { downscaleCardForExport } from "@/lib/jersey-studio/export-card";
import {
  prepareInput,
  polishCutoutDetail,
  rawRgba,
  removeBackgroundForDetail,
  rgbaToPng,
} from "@/lib/jersey-studio/image-prep";
import { getAlphaBounds, removeCornerWatermarkArtifacts } from "@/lib/jersey-studio/pixel-utils";

/** Remplit la carte de travail (2× export) en cover. */
async function fillCardPreservingFraming(cutout: Buffer): Promise<Buffer> {
  const { data, width, height } = await rawRgba(cutout);
  const bounds = getAlphaBounds(data, width, height, 8);
  if (!bounds) {
    throw new Error("Aucun contenu détecté pour l'image détail.");
  }

  return sharp(cutout)
    .extract({
      left: bounds.x,
      top: bounds.y,
      width: bounds.width,
      height: bounds.height,
    })
    .resize(WORK_CARD_W, WORK_CARD_H, {
      fit: "cover",
      position: "centre",
      kernel: sharp.kernel.lanczos3,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .png(LOSSLESS_PNG)
    .toBuffer()
    .then(polishCutoutDetail);
}

/** Pipeline détail : détourage → carte pleine + halo. */
export async function renderDetailProductCard(input: Buffer): Promise<Buffer> {
  const prepared = await prepareInput(input);
  const { data, width, height } = await rawRgba(prepared);
  removeCornerWatermarkArtifacts(data, width, height);
  const cleaned = await rgbaToPng(data, width, height);
  const cutout = await removeBackgroundForDetail(cleaned);
  const framed = await fillCardPreservingFraming(cutout);
  const internal = await compositeDetailCard(framed);
  return downscaleCardForExport(internal);
}

export async function renderDetailProductCardBase64(input: Buffer): Promise<string> {
  const png = await renderDetailProductCard(input);
  return png.toString("base64");
}
