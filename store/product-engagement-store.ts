"use client";

import { create } from "zustand";

interface EngagementState {
  viewedProductId: string | null;
  purchasedIds: string[];
  nudgeDismissedIds: string[];
  nudgeVisible: boolean;
  markViewed: (id: string) => void;
  markPurchased: (id: string) => void;
  /** Affiche le rappel favoris (uniquement sur la page produit, après délai). */
  revealNudge: (id: string) => void;
  dismissNudge: (id: string) => void;
  hideNudge: () => void;
}

export const useProductEngagementStore = create<EngagementState>((set, get) => ({
  viewedProductId: null,
  purchasedIds: [],
  nudgeDismissedIds: [],
  nudgeVisible: false,
  markViewed: (id) => set({ viewedProductId: id, nudgeVisible: false }),
  markPurchased: (id) =>
    set((s) => ({
      purchasedIds: [...new Set([...s.purchasedIds, id])],
      nudgeVisible: false,
    })),
  revealNudge: (id) => {
    if (get().viewedProductId !== id) return;
    if (get().purchasedIds.includes(id)) return;
    if (get().nudgeDismissedIds.includes(id)) return;
    set({ nudgeVisible: true });
  },
  dismissNudge: (id) =>
    set((s) => ({
      nudgeDismissedIds: [...new Set([...s.nudgeDismissedIds, id])],
      nudgeVisible: false,
    })),
  hideNudge: () => set({ nudgeVisible: false }),
}));
