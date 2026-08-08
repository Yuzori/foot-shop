"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import axios from "axios";

import { api, type LoginInput, type RegisterInput, type RegisterVerifyInput } from "@/lib/api";
import { clearAccountLocalState } from "@/lib/clear-account-local-state";
import {
  isCheckoutProfileComplete,
  loadCheckoutProfileFromStorage,
} from "@/lib/checkout-profile";
import { welcomePromo } from "@/config/promotions";
import { usePreferencesSyncStore } from "@/store/preferences-sync-store";

const SESSION_KEY = ["session"] as const;
const WELCOME_PROMO_KEY = ["welcome-promo"] as const;

async function saveAccountPreferences(): Promise<void> {
  try {
    const { useCartStore } = await import("@/store/cart-store");
    const { useFavoritesStore } = await import("@/store/favorites-store");
    const checkoutProfile = loadCheckoutProfileFromStorage();
    await api.savePreferences({
      cart: useCartStore.getState().lines,
      favorites: useFavoritesStore.getState().ids,
      ...(checkoutProfile && isCheckoutProfileComplete(checkoutProfile)
        ? { checkoutProfile }
        : {}),
    });
  } catch {
    /* non bloquant */
  }
}

function clearWelcomePromoCache(qc: ReturnType<typeof useQueryClient>): void {
  qc.setQueryData(WELCOME_PROMO_KEY, {
    status: "none" as const,
    enabled: welcomePromo.enabled,
    code: null,
    label: welcomePromo.label,
    checkoutLabel: welcomePromo.checkoutLabel,
    shortLabel: welcomePromo.shortLabel,
  });
}

/** Current authenticated customer (or null). */
export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: () => api.me(),
    staleTime: 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
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
      try {
        await api.logout();
      } catch {
        /* on nettoie le client même si l'API échoue */
      }
    },
    onSettled: () => {
      qc.setQueryData(SESSION_KEY, null);
      clearAccountLocalState();
      clearWelcomePromoCache(qc);
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      qc.invalidateQueries({ queryKey: ["stock-alert-status"] });
      resetPrefs();
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
