"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const FAVORITES_DEFAULT_ACCENT = "rgb(102, 186, 255)";

type AccentMap = Record<string, string>;

interface FavoritesPersisted {
  ids: string[];
  accentById?: AccentMap;
  /** @deprecated migré vers accentById */
  lastAccentColor?: string;
}

/**
 * Favorites store. Persists only product IDs — the actual product data is always
 * (re)fetched from the back office, never stored or invented locally.
 */
interface FavoritesState {
  ids: string[];
  accentById: AccentMap;
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

/** Couleur affichée : dernier favori encore présent (ordre d’ajout). */
export function selectMenuAccent(state: FavoritesState): string {
  for (let i = state.ids.length - 1; i >= 0; i--) {
    const id = state.ids[i];
    if (!id) continue;
    const color = state.accentById[id];
    if (color) return color;
  }
  return FAVORITES_DEFAULT_ACCENT;
}

function pruneAccents(ids: string[], accentById: AccentMap): AccentMap {
  const kept = new Set(ids);
  return Object.fromEntries(
    Object.entries(accentById).filter(([id]) => kept.has(id)),
  );
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      ids: [],
      accentById: {},
      toggle: (id, accentColor) =>
        set((state) => {
          const removing = state.ids.includes(id);
          if (removing) {
            const ids = state.ids.filter((x) => x !== id);
            return {
              ids,
              accentById: pruneAccents(ids, state.accentById),
            };
          }
          return {
            ids: [...state.ids, id],
            accentById: {
              ...state.accentById,
              [id]: withAccent(
                accentColor,
                state.accentById[id] ?? FAVORITES_DEFAULT_ACCENT,
              ),
            },
          };
        }),
      add: (id, accentColor) =>
        set((state) => {
          if (state.ids.includes(id)) return state;
          return {
            ids: [...state.ids, id],
            accentById: {
              ...state.accentById,
              [id]: withAccent(
                accentColor,
                state.accentById[id] ?? FAVORITES_DEFAULT_ACCENT,
              ),
            },
          };
        }),
      remove: (id) =>
        set((state) => {
          const ids = state.ids.filter((x) => x !== id);
          return {
            ids,
            accentById: pruneAccents(ids, state.accentById),
          };
        }),
      has: (id) => get().ids.includes(id),
      setIds: (ids) =>
        set((state) => ({
          ids,
          accentById: pruneAccents(ids, state.accentById),
        })),
      clear: () => set({ ids: [], accentById: {} }),
    }),
    {
      name: "maillot-favorites",
      version: 2,
      migrate: (persisted) => {
        const state = persisted as FavoritesPersisted;
        if (state.accentById) {
          return { ids: state.ids ?? [], accentById: state.accentById };
        }

        const accentById: AccentMap = {};
        const legacy = state.lastAccentColor;
        const ids = state.ids ?? [];
        if (legacy && ids.length) {
          const lastId = ids[ids.length - 1];
          if (lastId) accentById[lastId] = legacy;
        }

        return { ids, accentById };
      },
      partialize: (state) => ({
        ids: state.ids,
        accentById: state.accentById,
      }),
    },
  ),
);
