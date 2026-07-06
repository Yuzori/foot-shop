"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface RecentProductSnapshot {
  id: string;
  name: string;
  image: string | null;
  price: number;
  currency: string;
  inStock: boolean;
}

interface RecentProductState {
  recent: RecentProductSnapshot | null;
  hidden: boolean;
  setRecent: (p: RecentProductSnapshot) => void;
  hide: () => void;
  show: () => void;
}

export const useRecentProductStore = create<RecentProductState>()(
  persist(
    (set) => ({
      recent: null,
      hidden: false,
      setRecent: (p) => set({ recent: p, hidden: false }),
      hide: () => set({ hidden: true }),
      show: () => set({ hidden: false }),
    }),
    { name: "footshop-recent-product" },
  ),
);
