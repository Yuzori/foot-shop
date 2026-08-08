"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const FAVORITES_DEFAULT_ACCENT = "rgb(102, 186, 255)";

/**
 * Favorites store. Persists only product IDs — the actual product data is always
 * (re)fetched from the back office, never stored or invented locally.
 */
interface FavoritesState {
  ids: string[];
  /** Couleur du dernier maillot ajouté aux favoris (badge menu mobile). */
  lastAccentColor: string;
  toggle: (id: string, accentColor?: string) => void;
  add: (id: string, accentColor?: string) => void;
  remove: (id: string) => void;
  has: (id: string) => boolean;
  setIds: (ids: string[]) => void;
  clear: () => void;
}

function withAccent(
  accentColor: string | undefined,
  fallback: string,
): string {
  return accentColor?.trim() || fallback;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      ids: [],
      lastAccentColor: FAVORITES_DEFAULT_ACCENT,
      toggle: (id, accentColor) =>
        set((state) => {
          const removing = state.ids.includes(id);
          if (removing) {
            const ids = state.ids.filter((x) => x !== id);
            return {
              ids,
              lastAccentColor:
                ids.length === 0
                  ? FAVORITES_DEFAULT_ACCENT
                  : state.lastAccentColor,
            };
          }
          return {
            ids: [...state.ids, id],
            lastAccentColor: withAccent(
              accentColor,
              state.lastAccentColor || FAVORITES_DEFAULT_ACCENT,
            ),
          };
        }),
      add: (id, accentColor) =>
        set((state) => {
          if (state.ids.includes(id)) return state;
          return {
            ids: [...state.ids, id],
            lastAccentColor: withAccent(
              accentColor,
              state.lastAccentColor || FAVORITES_DEFAULT_ACCENT,
            ),
          };
        }),
      remove: (id) =>
        set((state) => {
          const ids = state.ids.filter((x) => x !== id);
          return {
            ids,
            lastAccentColor:
              ids.length === 0
                ? FAVORITES_DEFAULT_ACCENT
                : state.lastAccentColor,
          };
        }),
      has: (id) => get().ids.includes(id),
      setIds: (ids) =>
        set({
          ids,
          lastAccentColor:
            ids.length === 0 ? FAVORITES_DEFAULT_ACCENT : get().lastAccentColor,
        }),
      clear: () =>
        set({ ids: [], lastAccentColor: FAVORITES_DEFAULT_ACCENT }),
    }),
    {
      name: "maillot-favorites",
      partialize: (state) => ({
        ids: state.ids,
        lastAccentColor: state.lastAccentColor,
      }),
    },
  ),
);
