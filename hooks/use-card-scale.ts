"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

export type CardScale = "compact" | "default" | "large";

/** Adapte bouton / halo à la largeur réelle de la carte produit. */
export function useCardScale(): {
  ref: RefObject<HTMLDivElement | null>;
  scale: CardScale;
} {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState<CardScale>("default");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = (width: number) => {
      if (width >= 260) setScale("large");
      else if (width >= 190) setScale("default");
      else setScale("compact");
    };

    update(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => {
      update(entry?.contentRect.width ?? 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, scale };
}

const BUTTON_SCALE: Record<
  CardScale,
  { text: string; px: string; py: string; tracking: string }
> = {
  compact: {
    text: "text-[10px]",
    px: "px-4",
    py: "py-2",
    tracking: "tracking-[0.05em]",
  },
  default: {
    text: "text-[11px]",
    px: "px-5",
    py: "py-2.5",
    tracking: "tracking-[0.06em]",
  },
  large: {
    text: "text-xs sm:text-sm",
    px: "px-6 sm:px-7",
    py: "py-3 sm:py-3.5",
    tracking: "tracking-[0.07em]",
  },
};

export function cardButtonClasses(scale: CardScale): string {
  const s = BUTTON_SCALE[scale];
  return `${s.text} ${s.px} ${s.py} ${s.tracking}`;
}
