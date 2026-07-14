import "server-only";

import sharp from "sharp";

import { CARD_H, CARD_W, EXPORT_PNG } from "@/lib/jersey-studio/constants";

/** Réduit la carte supersampling → taille export finale sans perte de détail. */
export async function downscaleCardForExport(internalCard: Buffer): Promise<Buffer> {
  const meta = await sharp(internalCard).metadata();
  const w = meta.width ?? CARD_W;
  const h = meta.height ?? CARD_H;

  if (w === CARD_W && h === CARD_H) {
    return internalCard;
  }

  return sharp(internalCard)
    .resize(CARD_W, CARD_H, {
      kernel: sharp.kernel.lanczos3,
    })
    .png(EXPORT_PNG)
    .toBuffer();
}
