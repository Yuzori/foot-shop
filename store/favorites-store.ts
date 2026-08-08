"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Favorites store. Persists only product IDs — the actual product data is always
 * (re)fetched from the back office, never stored or invented locally.
 */
interface FavoritesState {
  ids: string[];
  /** Pastille menu (nouveau favori ajouté, non consulté). */
  hasNewFavorite: boolean;
  toggle: (id: string) => void;
  add: (id: string) => void;
  remove: (id: string) => void;
  has: (id: string) => boolean;
  setIds: (ids: string[]) => void;
  clear: () => void;
  clearFavoriteNotice: () => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      ids: [],
      hasNewFavorite: false,
      toggle: (id) =>
        set((state) => {
          const removing = state.ids.includes(id);
          return {
            ids: removing
              ? state.ids.filter((x) => x !== id)
              : [...state.ids, id],
            hasNewFavorite: removing ? state.hasNewFavorite : true,
          };
        }),
      add: (id) =>
        set((state) => ({
          ids: state.ids.includes(id) ? state.ids : [...state.ids, id],
          hasNewFavorite: true,
        })),
      remove: (id) =>
        set((state) => ({ ids: state.ids.filter((x) => x !== id) })),
      has: (id) => get().ids.includes(id),
      setIds: (ids) => set({ ids }),
      clear: () => set({ ids: [], hasNewFavorite: false }),
      clearFavoriteNotice: () => set({ hasNewFavorite: false }),
    }),
    {
      name: "maillot-favorites",
      partialize: (state) => ({ ids: state.ids }),
    },
  ),
);
