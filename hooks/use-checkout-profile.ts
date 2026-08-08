"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import {
  clearCheckoutProfileFromStorage,
  isCheckoutProfileComplete,
  saveCheckoutProfileToStorage,
  type CheckoutDeliveryProfile,
} from "@/lib/checkout-profile";
import { useSession } from "@/hooks/use-auth";

/** Charge et enregistre le profil de livraison (compte connecté uniquement). */
export function useCheckoutProfile() {
  const sessionQuery = useSession();
  const userId = sessionQuery.data?.id ?? null;
  const [profile, setProfile] = useState<CheckoutDeliveryProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      clearCheckoutProfileFromStorage();
      setLoaded(true);
      return;
    }

    let cancelled = false;
    setLoaded(false);

    void api
      .getPreferences()
      .then((prefs) => {
        if (cancelled) return;
        const server = prefs.checkoutProfile;
        if (server && isCheckoutProfileComplete(server)) {
          setProfile(server);
          saveCheckoutProfileToStorage(server);
        } else {
          setProfile(null);
          clearCheckoutProfileFromStorage();
        }
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const saveProfile = useCallback(
    async (next: CheckoutDeliveryProfile) => {
      if (!userId) return;

      const payload: CheckoutDeliveryProfile = {
        ...next,
        updatedAt: new Date().toISOString(),
      };
      setProfile(payload);
      saveCheckoutProfileToStorage(payload);

      try {
        const current = await api.getPreferences();
        await api.savePreferences({
          cart: current.cart,
          favorites: current.favorites,
          checkoutProfile: payload,
        });
      } catch {
        /* non bloquant */
      }
    },
    [userId],
  );

  const clearProfile = useCallback(() => {
    setProfile(null);
    clearCheckoutProfileFromStorage();
  }, []);

  return {
    profile,
    loaded,
    hasProfile: Boolean(userId && profile && isCheckoutProfileComplete(profile)),
    saveProfile,
    clearProfile,
  };
}
