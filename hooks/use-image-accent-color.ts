"use client";

import { useEffect, useState } from "react";

const DEFAULT_RGB: [number, number, number] = [102, 186, 255];

export type ImageAccent = {
  rgb: string;
  /** Légèrement plus foncé que la couleur dominante (anneau de base). */
  muted: string;
  light: string;
  alpha: (opacity: number) => string;
};

export type ImageAccentResult = {
  accent: ImageAccent;
  /** True une fois la couleur extraite (ou trouvée en cache). */
  ready: boolean;
};

function mixWhite(r: number, g: number, b: number, amount: number): [number, number, number] {
  return [
    Math.round(r + (255 - r) * amount),
    Math.round(g + (255 - g) * amount),
    Math.round(b + (255 - b) * amount),
  ];
}

function slightlyDarken(r: number, g: number, b: number, factor = 0.86): [number, number, number] {
  return [Math.round(r * factor), Math.round(g * factor), Math.round(b * factor)];
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function buildAccent(r: number, g: number, b: number): ImageAccent {
  const [mr, mg, mb] = slightlyDarken(r, g, b);
  const [lr, lg, lb] = mixWhite(r, g, b, 0.38);
  return {
    rgb: `rgb(${r}, ${g}, ${b})`,
    muted: `rgb(${mr}, ${mg}, ${mb})`,
    light: `rgb(${lr}, ${lg}, ${lb})`,
    alpha: (opacity: number) => `rgba(${r}, ${g}, ${b}, ${opacity})`,
  };
}

const DEFAULT_ACCENT = buildAccent(...DEFAULT_RGB);

/** Cache global — évite de rescanner le même image pour chaque carte. */
const accentCache = new Map<string, ImageAccent>();

const MAX_CONCURRENT = 2;
let inFlight = 0;
const pendingQueue: Array<() => void> = [];

function scheduleIdle(work: () => void) {
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(() => work(), { timeout: 1200 });
  } else {
    window.setTimeout(work, 16);
  }
}

function runQueued(work: () => void) {
  const run = () => {
    inFlight += 1;
    scheduleIdle(() => {
      try {
        work();
      } finally {
        inFlight -= 1;
        const next = pendingQueue.shift();
        if (next) next();
      }
    });
  };

  if (inFlight < MAX_CONCURRENT) run();
  else pendingQueue.push(run);
}

/** Fond photo / carte — pas la couleur du maillot. */
function isLikelyBackdrop(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;
  if (r >= 248 && g >= 248 && b >= 248 && sat < 12) return true;
  if (max <= 28 && min <= 26 && sat < 10) return true;
  return false;
}

/** Blanc / noir / gris du maillot → teinte visible sur fond clair du site. */
function normalizeFabricNeutral(rgb: [number, number, number]): [number, number, number] {
  const [r, g, b] = rgb;
  const lum = luminance(r, g, b);

  if (lum >= 185) {
    return [206, 206, 210];
  }
  if (lum <= 70) {
    return [42, 42, 48];
  }
  return rgb;
}

function extractAccentFromImage(img: HTMLImageElement): ImageAccent {
  const canvas = document.createElement("canvas");
  const sample = 48;
  canvas.width = sample;
  canvas.height = sample;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return DEFAULT_ACCENT;

  const sw = img.naturalWidth * 0.55;
  const sh = img.naturalHeight * 0.55;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = (img.naturalHeight - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sample, sample);

  const { data } = ctx.getImageData(0, 0, sample, sample);
  const chromatic = new Map<string, { rgb: [number, number, number]; weight: number }>();
  const neutral = new Map<string, { rgb: [number, number, number]; weight: number }>();

  for (let y = 0; y < sample; y += 2) {
    for (let x = 0; x < sample; x += 2) {
      const i = (y * sample + x) * 4;
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

      if (sat >= 22) {
        const weight = (sat + 1) * (sat + 1);
        const prev = chromatic.get(key);
        if (prev) prev.weight += weight;
        else chromatic.set(key, { rgb: [qr, qg, qb], weight });
      } else {
        const weight = Math.max(1, 120 - sat * 4);
        const prev = neutral.get(key);
        if (prev) prev.weight += weight;
        else neutral.set(key, { rgb: [qr, qg, qb], weight });
      }
    }
  }

  let bestChromatic: { rgb: [number, number, number]; weight: number } | null = null;
  for (const entry of chromatic.values()) {
    if (!bestChromatic || entry.weight > bestChromatic.weight) bestChromatic = entry;
  }

  let bestNeutral: { rgb: [number, number, number]; weight: number } | null = null;
  for (const entry of neutral.values()) {
    if (!bestNeutral || entry.weight > bestNeutral.weight) bestNeutral = entry;
  }

  if (
    bestChromatic &&
    (!bestNeutral || bestChromatic.weight >= bestNeutral.weight * 0.28)
  ) {
    return buildAccent(...bestChromatic.rgb);
  }

  if (bestNeutral) {
    return buildAccent(...normalizeFabricNeutral(bestNeutral.rgb));
  }

  return DEFAULT_ACCENT;
}

function loadAccent(imageUrl: string): Promise<ImageAccent> {
  const hit = accentCache.get(imageUrl);
  if (hit) return Promise.resolve(hit);

  return new Promise<ImageAccent>((resolve) => {
    runQueued(() => {
      const img = new Image();
      img.decoding = "async";

      const isSameOrigin =
        imageUrl.startsWith("/") ||
        (typeof window !== "undefined" && imageUrl.startsWith(window.location.origin));

      if (!isSameOrigin) {
        img.crossOrigin = "anonymous";
      }

      img.onload = () => {
        try {
          const next = extractAccentFromImage(img);
          accentCache.set(imageUrl, next);
          resolve(next);
        } catch {
          accentCache.set(imageUrl, DEFAULT_ACCENT);
          resolve(DEFAULT_ACCENT);
        }
      };

      img.onerror = () => {
        accentCache.set(imageUrl, DEFAULT_ACCENT);
        resolve(DEFAULT_ACCENT);
      };

      img.src = imageUrl;
    });
  });
}

type UseImageAccentColorOptions = {
  /** Désactivé par défaut sur les grilles — extraction au survol uniquement. */
  enabled?: boolean;
};

/** Extrait la couleur dominante (centre du visuel) pour halo / accents par produit. */
export function useImageAccentColor(
  imageUrl: string | null | undefined,
  options?: UseImageAccentColorOptions,
): ImageAccentResult {
  const enabled = options?.enabled ?? true;
  const cached = imageUrl ? accentCache.get(imageUrl) : undefined;
  const [accent, setAccent] = useState<ImageAccent>(cached ?? DEFAULT_ACCENT);
  const [ready, setReady] = useState(Boolean(cached));

  useEffect(() => {
    if (!imageUrl || !enabled) {
      if (!imageUrl) {
        setAccent(DEFAULT_ACCENT);
        setReady(false);
      }
      return;
    }

    const hit = accentCache.get(imageUrl);
    if (hit) {
      setAccent(hit);
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);

    loadAccent(imageUrl).then((next) => {
      if (cancelled) return;
      setAccent(next);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, imageUrl]);

  return { accent, ready };
}
