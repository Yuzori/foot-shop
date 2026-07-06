"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Favorites store. Persists only product IDs — the actual product data is always
 * (re)fetched from the back office, never stored or invented locally.
 */
interface FavoritesState {
  ids: string[];
  toggle: (id: string) => void;
  add: (id: string) => void;
  remove: (id: string) => void;
  has: (id: string) => boolean;
  setIds: (ids: string[]) => void;
  clear: () => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) =>
        set((state) => ({
          ids: state.ids.includes(id)
            ? state.ids.filter((x) => x !== id)
            : [...state.ids, id],
        })),
      add: (id) =>
        set((state) => ({
          ids: state.ids.includes(id) ? state.ids : [...state.ids, id],
        })),
      remove: (id) =>
        set((state) => ({ ids: state.ids.filter((x) => x !== id) })),
      has: (id) => get().ids.includes(id),
      setIds: (ids) => set({ ids }),
      clear: () => set({ ids: [] }),
    }),
    { name: "maillot-favorites" },
  ),
);
