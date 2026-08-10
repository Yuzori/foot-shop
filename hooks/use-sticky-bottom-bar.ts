"use client";

import { useEffect, useRef, useState } from "react";

type StickyMode = "fixed" | "docked";

/** Barre mobile fixée en bas : se gare en fin de contenu et remonte au-dessus du footer. */
export function useStickyBottomBar(enabled: boolean) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<StickyMode>("fixed");
  const [footerLift, setFooterLift] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const update = () => {
      const anchor = anchorRef.current;
      const bar = barRef.current;
      if (!anchor || !bar) return;

      const barHeight = bar.offsetHeight || 80;
      const anchorRect = anchor.getBoundingClientRect();
      const footer = document.querySelector("footer");
      const footerTop = footer?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
      const vh = window.innerHeight;

      setFooterLift(footerTop < vh ? Math.max(0, vh - footerTop) : 0);
      setMode(anchorRect.top > vh - barHeight ? "fixed" : "docked");
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [enabled]);

  return { anchorRef, barRef, mode, footerLift, isFixed: mode === "fixed" };
}
