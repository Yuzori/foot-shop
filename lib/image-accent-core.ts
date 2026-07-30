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

function isLikelyBackdrop(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;
  if (r >= 248 && g >= 248 && b >= 248 && sat < 12) return true;
  if (max <= 28 && min <= 26 && sat < 10) return true;
  return false;
}

function normalizeFabricNeutral(rgb: AccentRgb): AccentRgb {
  const lum = luminance(rgb.r, rgb.g, rgb.b);
  if (lum >= 185) return { r: 206, g: 206, b: 210 };
  if (lum <= 70) return { r: 42, g: 42, b: 48 };
  return rgb;
}

/** Extrait la couleur dominante depuis un buffer RGBA (48×48 typiquement). */
export function extractAccentFromRgba(
  data: Uint8Array | Buffer,
  width: number,
  height: number,
): ImageAccentData {
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
      if (isLikelyBackdrop(r, g, b)) continue;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max - min;

      const qr = Math.round(r / 18) * 18;
      const qg = Math.round(g / 18) * 18;
      const qb = Math.round(b / 18) * 18;
      const key = `${qr}-${qg}-${qb}`;
      const rgb = { r: qr, g: qg, b: qb };

      if (sat >= 22) {
        const weight = (sat + 1) * (sat + 1);
        const prev = chromatic.get(key);
        if (prev) prev.weight += weight;
        else chromatic.set(key, { rgb, weight });
      } else {
        const weight = Math.max(1, 120 - sat * 4);
        const prev = neutral.get(key);
        if (prev) prev.weight += weight;
        else neutral.set(key, { rgb, weight });
      }
    }
  }

  let bestChromatic: { rgb: AccentRgb; weight: number } | null = null;
  for (const entry of chromatic.values()) {
    if (!bestChromatic || entry.weight > bestChromatic.weight) bestChromatic = entry;
  }

  let bestNeutral: { rgb: AccentRgb; weight: number } | null = null;
  for (const entry of neutral.values()) {
    if (!bestNeutral || entry.weight > bestNeutral.weight) bestNeutral = entry;
  }

  if (
    bestChromatic &&
    (!bestNeutral || bestChromatic.weight >= bestNeutral.weight * 0.28)
  ) {
    return buildImageAccent(bestChromatic.rgb);
  }

  if (bestNeutral) {
    return buildImageAccent(normalizeFabricNeutral(bestNeutral.rgb));
  }

  return DEFAULT_IMAGE_ACCENT;
}
