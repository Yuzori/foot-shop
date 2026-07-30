/** Couleur d'accent extraite d'une image produit (partagé client + serveur). */

export type AccentRgb = { r: number; g: number; b: number };

export type ImageAccentData = AccentRgb & {
  rgb: string;
  muted: string;
  light: string;
};

const DEFAULT_RGB: AccentRgb = { r: 102, g: 186, b: 255 };

function mixWhite(r: number, g: number, b: number, amount: number): AccentRgb {
  return {
    r: Math.round(r + (255 - r) * amount),
    g: Math.round(g + (255 - g) * amount),
    b: Math.round(b + (255 - b) * amount),
  };
}

function slightlyDarken(r: number, g: number, b: number, factor = 0.86): AccentRgb {
  return {
    r: Math.round(r * factor),
    g: Math.round(g * factor),
    b: Math.round(b * factor),
  };
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function buildImageAccent(rgb: AccentRgb): ImageAccentData {
  const { r, g, b } = rgb;
  const muted = slightlyDarken(r, g, b);
  const light = mixWhite(r, g, b, 0.38);
  return {
    r,
    g,
    b,
    rgb: `rgb(${r}, ${g}, ${b})`,
    muted: `rgb(${muted.r}, ${muted.g}, ${muted.b})`,
    light: `rgb(${light.r}, ${light.g}, ${light.b})`,
  };
}

export const DEFAULT_IMAGE_ACCENT = buildImageAccent(DEFAULT_RGB);

export function accentAlpha(rgb: AccentRgb, opacity: number): string {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

/** Fond photo — pas le maillot. */
function isLikelyBackdrop(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;
  if (r >= 248 && g >= 248 && b >= 248 && sat < 12) return true;
  if (max <= 28 && min <= 26 && sat < 10) return true;
  return false;
}

type FabricKind = "backdrop" | "warm" | "chromatic" | "neutral";

function classifyFabric(r: number, g: number, b: number): FabricKind {
  if (isLikelyBackdrop(r, g, b)) return "backdrop";

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;
  const lum = luminance(r, g, b);

  if (lum >= 236 && sat < 20) return "neutral";
  if (lum <= 42 && sat < 22) return "neutral";
  if (sat < 16) return "neutral";

  // Beige, crème, sable — corps de maillot clair (pas du blanc pur).
  if (lum >= 132 && lum <= 238 && sat >= 8 && sat <= 62) {
    return "warm";
  }

  if (sat >= 32) return "chromatic";

  return "neutral";
}

function quantize(r: number, g: number, b: number): AccentRgb {
  const step = 12;
  return {
    r: Math.round(r / step) * step,
    g: Math.round(g / step) * step,
    b: Math.round(b / step) * step,
  };
}

type Bucket = Map<string, { rgb: AccentRgb; weight: number }>;

function addPixel(
  bucket: Bucket,
  r: number,
  g: number,
  b: number,
  weight = 1,
): void {
  const rgb = quantize(r, g, b);
  const key = `${rgb.r}-${rgb.g}-${rgb.b}`;
  const prev = bucket.get(key);
  if (prev) prev.weight += weight;
  else bucket.set(key, { rgb, weight });
}

function pickDominantByArea(bucket: Bucket): AccentRgb | null {
  let best: { rgb: AccentRgb; score: number } | null = null;

  for (const entry of bucket.values()) {
    const { r, g, b } = entry.rgb;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    // Surface d'abord ; saturation seulement en cas d'égalité proche.
    const score = entry.weight + sat * 0.04;

    if (!best || score > best.score) {
      best = { rgb: entry.rgb, score };
    }
  }

  return best?.rgb ?? null;
}

function mergeBuckets(...buckets: Bucket[]): Bucket {
  const merged: Bucket = new Map();
  for (const bucket of buckets) {
    for (const entry of bucket.values()) {
      const key = `${entry.rgb.r}-${entry.rgb.g}-${entry.rgb.b}`;
      const prev = merged.get(key);
      if (prev) prev.weight += entry.weight;
      else merged.set(key, { rgb: entry.rgb, weight: entry.weight });
    }
  }
  return merged;
}

function totalWeight(bucket: Bucket): number {
  let total = 0;
  for (const entry of bucket.values()) total += entry.weight;
  return total;
}

function normalizeFabricNeutral(rgb: AccentRgb): AccentRgb {
  const lum = luminance(rgb.r, rgb.g, rgb.b);
  if (lum >= 185) return { r: 206, g: 206, b: 210 };
  if (lum <= 70) return { r: 42, g: 42, b: 48 };
  return rgb;
}

/** Extrait la couleur dominante depuis un buffer RGBA (48×48 typiquement). */
export function extractAccentFromRgba(
  data: ArrayLike<number>,
  width: number,
  height: number,
): ImageAccentData {
  const warm = new Map<string, { rgb: AccentRgb; weight: number }>();
  const chromatic = new Map<string, { rgb: AccentRgb; weight: number }>();
  const neutral = new Map<string, { rgb: AccentRgb; weight: number }>();

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      const a = data[i + 3] ?? 0;
      if (a < 100) continue;

      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const kind = classifyFabric(r, g, b);

      if (kind === "backdrop") continue;

      if (kind === "warm") addPixel(warm, r, g, b);
      else if (kind === "chromatic") addPixel(chromatic, r, g, b);
      else addPixel(neutral, r, g, b);
    }
  }

  const fabricArea = totalWeight(warm) + totalWeight(chromatic);

  if (fabricArea > 0) {
    const dominant = pickDominantByArea(mergeBuckets(warm, chromatic));
    if (dominant) return buildImageAccent(dominant);
  }

  const bestNeutral = pickDominantByArea(neutral);
  if (bestNeutral) {
    return buildImageAccent(normalizeFabricNeutral(bestNeutral));
  }

  return DEFAULT_IMAGE_ACCENT;
}
