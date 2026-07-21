import "server-only";

import sharp from "sharp";

import { cookieHeaderForUrl, storeResponseCookies } from "@/lib/product-import/fetch-session";
import { buildImageUrlCandidates } from "@/lib/product-import/image-url-quality";
import { validateRedirectUrl, validateSourceUrl } from "@/lib/product-import/validate-url";

const MIN_BYTES_STRICT = 12_000;
const MIN_BYTES_RELAXED = 2_500;
const MIN_MAX_DIMENSION_STRICT = 720;
const MIN_MAX_DIMENSION_RELAXED = 380;
const MAX_BYTES = 16 * 1024 * 1024;
const MAX_REDIRECT_HOPS = 12;
const FETCH_TIMEOUT_MS =
  Number(process.env.JERSEY_FETCH_TIMEOUT_MS) ||
  (process.env.RENDER === "true" ? 12_000 : 45_000);

async function fetchImageResponse(
  imageUrl: string,
  referer?: string,
): Promise<Response> {
  const start = await validateSourceUrl(imageUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let current = start;

    for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
      const response = await fetch(current.toString(), {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "image/jpeg,image/png,image/webp,image/apng,image/*;q=0.95",
          "Accept-Encoding": "identity",
          ...(referer ? { Referer: referer } : {}),
          ...(cookieHeaderForUrl(current)
            ? { Cookie: cookieHeaderForUrl(current)! }
            : {}),
        },
        redirect: "manual",
      });

      storeResponseCookies(current, response);

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("Redirection image invalide.");
        current = await validateRedirectUrl(location, current);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Image inaccessible (${response.status}).`);
      }

      return response;
    }

    throw new Error("Trop de redirections image.");
  } catch (manualErr) {
    const response = await fetch(start.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "image/jpeg,image/png,image/webp,image/apng,image/*;q=0.95",
        ...(referer ? { Referer: referer } : {}),
      },
      redirect: "follow",
    });
    if (!response.ok) {
      throw manualErr instanceof Error ? manualErr : new Error("Image inaccessible.");
    }
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchImageOnce(
  imageUrl: string,
  referer?: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const response = await fetchImageResponse(imageUrl, referer);

  const mimeType =
    (response.headers.get("content-type") ?? "image/jpeg").split(";")[0]?.trim() ||
    "image/jpeg";
  if (!mimeType.startsWith("image/")) {
    throw new Error("L'URL ne pointe pas vers une image.");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, mimeType };
}

function validateImageBuffer(
  buffer: Buffer,
  width: number,
  height: number,
  relaxed: boolean,
): void {
  const maxDim = Math.max(width, height);
  const minBytes = relaxed ? MIN_BYTES_RELAXED : MIN_BYTES_STRICT;
  const minDim = relaxed ? MIN_MAX_DIMENSION_RELAXED : MIN_MAX_DIMENSION_STRICT;

  if (buffer.byteLength > MAX_BYTES) {
    throw new Error("Image trop volumineuse (max 16 Mo).");
  }

  if (maxDim < minDim) {
    throw new Error(
      `Résolution insuffisante (${width}×${height}px) — miniature détectée.`,
    );
  }

  if (buffer.byteLength < minBytes) {
    if (!relaxed || maxDim < MIN_MAX_DIMENSION_STRICT) {
      throw new Error(
        `Image trop petite (${Math.round(buffer.byteLength / 1024)} Ko) — probablement une miniature.`,
      );
    }
  }
}

export async function fetchImageBuffer(
  imageUrl: string,
  referer?: string,
): Promise<{ buffer: Buffer; mimeType: string; width: number; height: number }> {
  if (imageUrl.startsWith("data:")) {
    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match?.[1] || !match[2]) {
      throw new Error("Image collée invalide.");
    }
    const buffer = Buffer.from(match[2], "base64");
    const mimeType = match[1].trim().toLowerCase();
    const meta = await sharp(buffer).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    validateImageBuffer(buffer, width, height, true);
    return { buffer, mimeType, width, height };
  }

  const candidates = buildImageUrlCandidates(imageUrl);
  let lastError: Error | null = null;

  for (const candidate of candidates) {
    for (const relaxed of [false, true]) {
      try {
        const { buffer, mimeType } = await fetchImageOnce(candidate, referer);
        const meta = await sharp(buffer).metadata();
        const width = meta.width ?? 0;
        const height = meta.height ?? 0;
        validateImageBuffer(buffer, width, height, relaxed);
        return { buffer, mimeType, width, height };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error("fetch_failed");
      }
    }
  }

  throw lastError ?? new Error("Image inaccessible.");
}
