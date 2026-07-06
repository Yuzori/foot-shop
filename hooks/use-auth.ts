"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import axios from "axios";

import { api, type LoginInput, type RegisterInput, type RegisterVerifyInput } from "@/lib/api";
import { useCartStore } from "@/store/cart-store";
import { useFavoritesStore } from "@/store/favorites-store";
import { usePreferencesSyncStore } from "@/store/preferences-sync-store";

const SESSION_KEY = ["session"] as const;

async function saveAccountPreferences(): Promise<void> {
  try {
    await api.savePreferences({
      cart: useCartStore.getState().lines,
      favorites: useFavoritesStore.getState().ids,
    });
  } catch {
    /* non bloquant */
  }
}

function clearLocalShoppingState(): void {
  useCartStore.getState().clear();
  useFavoritesStore.getState().clear();
}

/** Current authenticated customer (or null). */
export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: () => api.me(),
    staleTime: 120_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  const resetPrefs = usePreferencesSyncStore((s) => s.reset);

  return useMutation({
    mutationFn: (input: LoginInput) => api.login(input),
    onSuccess: (user) => {
      resetPrefs();
      qc.setQueryData(SESSION_KEY, user);
      void qc.invalidateQueries({ queryKey: ["welcome-promo"] });
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (input: RegisterInput) => api.register(input),
  });
}

export function useVerifyRegister() {
  const qc = useQueryClient();
  const resetPrefs = usePreferencesSyncStore((s) => s.reset);

  return useMutation({
    mutationFn: (input: RegisterVerifyInput) => api.verifyRegister(input),
    onSuccess: (user) => {
      resetPrefs();
      qc.setQueryData(SESSION_KEY, user);
      qc.invalidateQueries({ queryKey: ["welcome-promo"] });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const pause = usePreferencesSyncStore((s) => s.pause);
  const resume = usePreferencesSyncStore((s) => s.resume);
  const resetPrefs = usePreferencesSyncStore((s) => s.reset);

  return useMutation({
    mutationFn: async () => {
      pause();
      await saveAccountPreferences();
      await api.logout();
    },
    onSuccess: () => {
      qc.setQueryData(SESSION_KEY, null);
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      qc.invalidateQueries({ queryKey: ["stock-alert-status"] });
      clearLocalShoppingState();
      resetPrefs();
      resume();
    },
    onError: () => {
      resume();
    },
  });
}

/** Order history for the logged-in customer. */
export function useMyOrders(enabled: boolean) {
  const qc = useQueryClient();

  return useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => {
      try {
        return await api.myOrders();
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          qc.setQueryData(SESSION_KEY, null);
        }
        throw err;
      }
    },
    enabled,
    retry: false,
  });
}
