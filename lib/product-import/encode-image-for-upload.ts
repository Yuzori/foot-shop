import "server-only";

import sharp from "sharp";

/** PrestaShop : max 2000 Ko — marge de sécurité. */
export const PRESTASHOP_MAX_IMAGE_BYTES = 2000 * 1024 - 48_000;

/**
 * Encode une image pour l'upload PrestaShop (≤ 2000 Ko).
 * PNG compressé (sans perte) en priorité, JPEG haute qualité en secours.
 */
export async function encodeImageForPrestaShop(
  input: Buffer,
): Promise<{ buffer: Buffer; mime: string }> {
  const png = await sharp(input)
    .png({ compressionLevel: 6, effort: 8 })
    .toBuffer();

  if (png.byteLength <= PRESTASHOP_MAX_IMAGE_BYTES) {
    return { buffer: png, mime: "image/png" };
  }

  for (const quality of [92, 88, 85, 82]) {
    const jpeg = await sharp(input).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (jpeg.byteLength <= PRESTASHOP_MAX_IMAGE_BYTES) {
      return { buffer: jpeg, mime: "image/jpeg" };
    }
  }

  const meta = await sharp(input).metadata();
  const width = meta.width ?? 656;
  const lastJpeg = await sharp(input).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  const ratio = Math.min(0.95, Math.sqrt(PRESTASHOP_MAX_IMAGE_BYTES / lastJpeg.byteLength));

  const resized = await sharp(input)
    .resize(Math.max(400, Math.round(width * ratio)), undefined, {
      fit: "inside",
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  return { buffer: resized, mime: "image/jpeg" };
}
