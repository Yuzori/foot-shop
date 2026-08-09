"use client";

import { useLayoutEffect } from "react";

/** Remonte en haut de page (navigation checkout, changement d'étape). */
export function useScrollToTop(active = true) {
  useLayoutEffect(() => {
    if (!active) return;
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [active]);
}
