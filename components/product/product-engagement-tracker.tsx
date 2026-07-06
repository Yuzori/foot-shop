"use client";

import { useEffect } from "react";

import {
  useProductEngagementStore,
} from "@/store/product-engagement-store";

const NUDGE_DELAY_MS = 10_000;

/** Après 10 s sur la page produit, affiche le rappel favoris (si pas acheté). */
export function ProductEngagementTracker({ productId }: { productId: string }) {
  const markViewed = useProductEngagementStore((s) => s.markViewed);
  const revealNudge = useProductEngagementStore((s) => s.revealNudge);
  const hideNudge = useProductEngagementStore((s) => s.hideNudge);

  useEffect(() => {
    markViewed(productId);

    const timer = window.setTimeout(() => {
      const state = useProductEngagementStore.getState();
      if (state.purchasedIds.includes(productId)) return;
      if (state.nudgeDismissedIds.includes(productId)) return;
      state.revealNudge(productId);
    }, NUDGE_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      hideNudge();
    };
  }, [productId, markViewed, revealNudge, hideNudge]);

  return null;
}
