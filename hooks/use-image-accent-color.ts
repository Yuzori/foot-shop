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

function isBackgroundPixel(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 30) return true;
  if (max > 200 && max - min < 28) return true;
  return false;
}

/** Extrait la couleur dominante (centre du visuel) pour halo / accents par produit. */
export function useImageAccentColor(imageUrl: string | null | undefined): ImageAccent {
  const [accent, setAccent] = useState<ImageAccent>(DEFAULT_ACCENT);

  useEffect(() => {
    if (!imageUrl) {
      setAccent(DEFAULT_ACCENT);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.decoding = "async";

    const isSameOrigin =
      imageUrl.startsWith("/") ||
      (typeof window !== "undefined" && imageUrl.startsWith(window.location.origin));

    if (!isSameOrigin) {
      img.crossOrigin = "anonymous";
    }

    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        const sample = 72;
        canvas.width = sample;
        canvas.height = sample;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        const sw = img.naturalWidth * 0.55;
        const sh = img.naturalHeight * 0.55;
        const sx = (img.naturalWidth - sw) / 2;
        const sy = (img.naturalHeight - sh) / 2;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sample, sample);

        const { data } = ctx.getImageData(0, 0, sample, sample);
        const buckets = new Map<string, { rgb: [number, number, number]; weight: number }>();

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3] ?? 0;
          if (a < 100) continue;
          const r = data[i] ?? 0;
          const g = data[i + 1] ?? 0;
          const b = data[i + 2] ?? 0;
          if (isBackgroundPixel(r, g, b)) continue;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max - min;
          if (sat < 6) continue;

          const qr = Math.round(r / 18) * 18;
          const qg = Math.round(g / 18) * 18;
          const qb = Math.round(b / 18) * 18;
          const key = `${qr}-${qg}-${qb}`;
          const weight = (sat + 1) * (sat + 1);
          const prev = buckets.get(key);
          if (prev) prev.weight += weight;
          else buckets.set(key, { rgb: [qr, qg, qb], weight });
        }

        let best: { rgb: [number, number, number]; weight: number } | null = null;
        for (const entry of buckets.values()) {
          if (!best || entry.weight > best.weight) best = entry;
        }
        if (best) setAccent(buildAccent(...best.rgb));
      } catch {
        setAccent(DEFAULT_ACCENT);
      }
    };

    img.onerror = () => {
      if (!cancelled) setAccent(DEFAULT_ACCENT);
    };
    img.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  return accent;
}
