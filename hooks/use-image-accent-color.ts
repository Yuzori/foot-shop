"use client";

import { useEffect, useState } from "react";

import {
  buildImageAccent,
  DEFAULT_IMAGE_ACCENT,
  extractAccentFromRgba,
  type ImageAccentData,
} from "@/lib/image-accent-core";
import { toImageAccent, type ImageAccent } from "@/lib/image-accent-client";

export type { ImageAccent };

type UseImageAccentColorOptions = {
  enabled?: boolean;
};

const accentCache = new Map<string, ImageAccentData>();

/** Fallback client si l'accent serveur n'est pas encore en cache. */
export function useImageAccentColor(
  imageUrl: string | null | undefined,
  options?: UseImageAccentColorOptions,
): { accent: ImageAccent; ready: boolean } {
  const enabled = options?.enabled ?? true;
  const cached = imageUrl ? accentCache.get(imageUrl) : undefined;
  const [accentData, setAccentData] = useState<ImageAccentData>(
    cached ?? DEFAULT_IMAGE_ACCENT,
  );
  const [ready, setReady] = useState(Boolean(cached));

  useEffect(() => {
    if (!imageUrl || !enabled) return;

    const hit = accentCache.get(imageUrl);
    if (hit) {
      setAccentData(hit);
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);

    const img = new Image();
    img.decoding = "async";
    img.crossOrigin = "anonymous";

    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        const sample = 48;
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
        const next = extractAccentFromRgba(data, sample, sample);
        accentCache.set(imageUrl, next);
        setAccentData(next);
        setReady(true);
      } catch {
        setAccentData(DEFAULT_IMAGE_ACCENT);
        setReady(true);
      }
    };

    img.onerror = () => {
      if (!cancelled) {
        setAccentData(DEFAULT_IMAGE_ACCENT);
        setReady(true);
      }
    };
    img.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [enabled, imageUrl]);

  return { accent: toImageAccent(accentData), ready };
}
