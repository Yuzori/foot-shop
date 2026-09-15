"use client";

import { useLayoutEffect } from "react";

/** Remonte en haut une fois (ex. étape checkout). Restaure scrollRestoration au départ. */
export function useScrollToTop(active = true) {
  useLayoutEffect(() => {
    if (!active) return;

    const previous =
      "scrollRestoration" in history ? history.scrollRestoration : null;
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    return () => {
      if ("scrollRestoration" in history && previous) {
        history.scrollRestoration = previous;
      }
    };
  }, [active]);
}
