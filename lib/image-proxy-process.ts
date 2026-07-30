import sharp from "sharp";

import {
  extractAccentFromRgba,
  type ImageAccentData,
} from "@/lib/image-accent-core";
import { writeAccentCache } from "@/lib/image-accent-cache";

const SAMPLE = 48;

export async function processImageToWebp(
  input: Buffer,
  options?: {
    productId?: string;
    imageId?: string;
  },
): Promise<{ body: Buffer; accent: ImageAccentData | null }> {
  const base = sharp(input, { failOn: "none" }).rotate();

  const { data, info } = await base
    .clone()
    .resize(SAMPLE, SAMPLE, { fit: "cover" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const accent = extractAccentFromRgba(data, info.width, info.height);

  if (options?.productId && options?.imageId) {
    await writeAccentCache(options.productId, options.imageId, accent);
  }

  const body = await base.webp({ quality: 76, effort: 4 }).toBuffer();

  return { body, accent };
}
