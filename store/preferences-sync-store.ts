"use client";

import { create } from "zustand";

interface PreferencesSyncState {
  paused: boolean;
  loadedUserId: string | null;
  pause: () => void;
  resume: () => void;
  markLoaded: (userId: string) => void;
  reset: () => void;
}

export const usePreferencesSyncStore = create<PreferencesSyncState>((set) => ({
  paused: false,
  loadedUserId: null,
  pause: () => set({ paused: true }),
  resume: () => set({ paused: false }),
  markLoaded: (userId) => set({ loadedUserId: userId }),
  reset: () => set({ loadedUserId: null }),
}));
