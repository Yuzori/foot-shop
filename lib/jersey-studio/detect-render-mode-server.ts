import "server-only";

import sharp from "sharp";

import { detectRenderModeFromRgba } from "@/lib/jersey-studio/detect-render-mode";
import type { JerseyRenderMode } from "@/lib/jersey-studio/render-mode";

/** Analyse une image (buffer) pour deviner maillot vs détail zoom. */
export async function detectRenderModeFromBuffer(
  buffer: Buffer,
): Promise<JerseyRenderMode> {
  const { data, info } = await sharp(buffer)
    .rotate()
    .resize(420, 420, { fit: "inside", withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return detectRenderModeFromRgba(
    new Uint8Array(data),
    info.width,
    info.height,
    info.channels ?? 3,
  );
}
