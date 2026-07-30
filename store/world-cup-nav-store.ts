import { create } from "zustand";

interface WorldCupNavState {
  productActive: boolean;
  setProductActive: (active: boolean) => void;
}

export const useWorldCupNavStore = create<WorldCupNavState>((set) => ({
  productActive: false,
  setProductActive: (productActive) => set({ productActive }),
}));
