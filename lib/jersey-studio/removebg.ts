import "server-only";

import sharp from "sharp";

import { removeBgConfig } from "@/config/removebg";

/** Clés dont le quota est épuisé pour la durée de vie du process Node. */
const exhaustedKeys = new Set<string>();

let rotationCursor = 0;

function maskKey(key: string): string {
  if (key.length <= 6) return "••••";
  return `…${key.slice(-4)}`;
}

function orderedActiveKeys(): string[] {
  const active = removeBgConfig.apiKeys.filter((k) => !exhaustedKeys.has(k));
  if (!active.length) return [];

  const start = rotationCursor % active.length;
  rotationCursor = (rotationCursor + 1) % Number.MAX_SAFE_INTEGER;

  return [...active.slice(start), ...active.slice(0, start)];
}

function isQuotaExhausted(status: number, body: string): boolean {
  if (status === 402) return true;
  if (status === 429) return true;
  const lower = body.toLowerCase();
  return (
    /insufficient credits|not enough credits|credit balance|quota exceeded|limit exceeded/i.test(
      lower,
    ) ||
    /no more credits|out of credits/i.test(lower)
  );
}

function isInvalidKey(status: number, body: string): boolean {
  if (status === 403 && /invalid api key|api key is invalid/i.test(body)) return true;
  return status === 401;
}

/** Réduit poids + dimensions avant envoi API (limite Remove.bg : 22 Mo). */
async function prepareForRemoveBgUpload(image: Buffer): Promise<{
  bytes: Buffer;
  mime: string;
  filename: string;
}> {
  const maxBytes = removeBgConfig.maxUploadBytes;
  const maxDim = removeBgConfig.maxUploadDimension;

  const base = sharp(image).rotate();
  const meta = await base.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const longest = Math.max(width, height);

  const pipeline =
    longest > maxDim
      ? base.resize({
          width: width >= height ? maxDim : undefined,
          height: height > width ? maxDim : undefined,
          fit: "inside",
          withoutEnlargement: true,
          kernel: sharp.kernel.lanczos3,
        })
      : base;

  const qualities = [92, 88, 84, 80, 76, 72];
  let best = await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer();

  for (const quality of qualities) {
    const candidate = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
    best = candidate;
    if (candidate.byteLength <= maxBytes) {
      return { bytes: candidate, mime: "image/jpeg", filename: "jersey.jpg" };
    }
  }

  let shrink = Math.min(0.92, Math.sqrt(maxBytes / Math.max(best.byteLength, 1)));
  for (let attempt = 0; attempt < 6; attempt++) {
    const targetW = Math.max(640, Math.round((width || maxDim) * shrink));
    const targetH = Math.max(640, Math.round((height || maxDim) * shrink));
    const candidate = await sharp(image)
      .rotate()
      .resize(targetW, targetH, {
        fit: "inside",
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3,
      })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    if (candidate.byteLength <= maxBytes) {
      return { bytes: candidate, mime: "image/jpeg", filename: "jersey.jpg" };
    }

    best = candidate;
    shrink *= 0.85;
  }

  if (best.byteLength > maxBytes) {
    throw new Error(
      `Image trop lourde pour Remove.bg (${Math.round(best.byteLength / 1024 / 1024)} Mo après compression).`,
    );
  }

  return { bytes: best, mime: "image/jpeg", filename: "jersey.jpg" };
}

async function callRemoveBg(key: string, image: Buffer): Promise<Buffer> {
  const upload = await prepareForRemoveBgUpload(image);
  const form = new FormData();
  form.append(
    "image_file",
    new Blob([new Uint8Array(upload.bytes)], { type: upload.mime }),
    upload.filename,
  );
  form.append("size", removeBgConfig.size);
  form.append("type", removeBgConfig.cutoutType);
  form.append("format", "png");
  form.append("channels", "rgba");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), removeBgConfig.requestTimeoutMs);

  try {
    const response = await fetch(removeBgConfig.endpoint, {
      method: "POST",
      headers: { "X-Api-Key": key },
      body: form,
      signal: controller.signal,
    });

    const bodyText = response.ok
      ? ""
      : await response.text().catch(() => "");

    if (!response.ok) {
      if (isQuotaExhausted(response.status, bodyText)) {
        exhaustedKeys.add(key);
        throw new RemoveBgQuotaError(maskKey(key), bodyText || `HTTP ${response.status}`);
      }

      if (isInvalidKey(response.status, bodyText)) {
        exhaustedKeys.add(key);
        throw new RemoveBgInvalidKeyError(maskKey(key));
      }

      const snippet = bodyText.slice(0, 200).trim();
      throw new Error(
        snippet
          ? `Remove.bg (${response.status}) : ${snippet}`
          : `Remove.bg a répondu ${response.status}.`,
      );
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength < 500) {
      throw new Error("Remove.bg a renvoyé une image vide.");
    }

    return bytes;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new RemoveBgTimeoutError();
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export class RemoveBgQuotaError extends Error {
  constructor(
    public readonly keyMask: string,
    detail?: string,
  ) {
    super(
      detail
        ? `Quota Remove.bg épuisé (${keyMask}).`
        : `Quota Remove.bg épuisé pour la clé ${keyMask}.`,
    );
    this.name = "RemoveBgQuotaError";
  }
}

export class RemoveBgInvalidKeyError extends Error {
  constructor(public readonly keyMask: string) {
    super(`Clé Remove.bg invalide (${keyMask}).`);
    this.name = "RemoveBgInvalidKeyError";
  }
}

export class RemoveBgTimeoutError extends Error {
  constructor() {
    super("Remove.bg : délai dépassé.");
    this.name = "RemoveBgTimeoutError";
  }
}

export class RemoveBgAllKeysExhaustedError extends Error {
  constructor(public readonly tried: number) {
    super(
      tried > 0
        ? `Toutes les clés Remove.bg sont épuisées (${tried} compte(s)).`
        : "Aucune clé Remove.bg configurée.",
    );
    this.name = "RemoveBgAllKeysExhaustedError";
  }
}

/** Détourage Remove.bg avec rotation automatique entre les clés API. */
export async function removeBackgroundWithRemoveBg(image: Buffer): Promise<Buffer> {
  const keys = orderedActiveKeys();
  if (!keys.length) {
    throw new RemoveBgAllKeysExhaustedError(removeBgConfig.apiKeys.length);
  }

  const errors: string[] = [];

  for (const key of keys) {
    try {
      return await callRemoveBg(key, image);
    } catch (err) {
      if (
        err instanceof RemoveBgQuotaError ||
        err instanceof RemoveBgInvalidKeyError ||
        err instanceof RemoveBgTimeoutError
      ) {
        errors.push(err.message);
        continue;
      }
      throw err;
    }
  }

  throw new RemoveBgAllKeysExhaustedError(removeBgConfig.apiKeys.length);
}

export function getRemoveBgStatus(): {
  enabled: boolean;
  totalKeys: number;
  activeKeys: number;
  exhaustedKeys: number;
} {
  return {
    enabled: removeBgConfig.enabled,
    totalKeys: removeBgConfig.apiKeys.length,
    activeKeys: removeBgConfig.apiKeys.filter((k) => !exhaustedKeys.has(k)).length,
    exhaustedKeys: exhaustedKeys.size,
  };
}

/** Réinitialise les clés marquées épuisées (utile après rechargement de crédits). */
export function resetRemoveBgKeyExhaustion(): void {
  exhaustedKeys.clear();
}
