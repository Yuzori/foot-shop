import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ImageAccentData } from "@/lib/image-accent-core";

const CACHE_DIR = path.join(process.cwd(), ".data", "image-accents");

function cachePath(productId: string, imageId: string): string {
  return path.join(CACHE_DIR, `${productId}-${imageId}.json`);
}

export async function readAccentCache(
  productId: string,
  imageId: string,
): Promise<ImageAccentData | null> {
  try {
    const raw = await readFile(cachePath(productId, imageId), "utf8");
    const parsed = JSON.parse(raw) as ImageAccentData;
    if (
      typeof parsed.r === "number" &&
      typeof parsed.g === "number" &&
      typeof parsed.b === "number"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function writeAccentCache(
  productId: string,
  imageId: string,
  accent: ImageAccentData,
): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(cachePath(productId, imageId), JSON.stringify(accent), "utf8");
  } catch {
    /* cache best-effort */
  }
}
