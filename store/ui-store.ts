"use client";

import { create } from "zustand";

interface UIState {
  cartOpen: boolean;
  favoritesOpen: boolean;
  accountOpen: boolean;
  searchOpen: boolean;
  menuOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  openFavorites: () => void;
  closeFavorites: () => void;
  openAccount: () => void;
  closeAccount: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  setMenuOpen: (open: boolean) => void;
  closeAllPanels: () => void;
}

const closedPanels = {
  cartOpen: false,
  favoritesOpen: false,
  accountOpen: false,
  searchOpen: false,
};

export const useUIStore = create<UIState>((set) => ({
  cartOpen: false,
  favoritesOpen: false,
  accountOpen: false,
  searchOpen: false,
  menuOpen: false,
  openCart: () => set({ ...closedPanels, cartOpen: true, menuOpen: false }),
  closeCart: () => set({ cartOpen: false }),
  openFavorites: () =>
    set({ ...closedPanels, favoritesOpen: true, menuOpen: false }),
  closeFavorites: () => set({ favoritesOpen: false }),
  openAccount: () => set({ ...closedPanels, accountOpen: true, menuOpen: false }),
  closeAccount: () => set({ accountOpen: false }),
  openSearch: () => set({ ...closedPanels, searchOpen: true, menuOpen: false }),
  closeSearch: () => set({ searchOpen: false }),
  setMenuOpen: (open) => set({ menuOpen: open }),
  closeAllPanels: () => set(closedPanels),
}));
