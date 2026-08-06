"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import {
  emptyCheckoutProfile,
  isCheckoutProfileComplete,
  loadCheckoutProfileFromStorage,
  saveCheckoutProfileToStorage,
  type CheckoutDeliveryProfile,
} from "@/lib/checkout-profile";
import { useSession } from "@/hooks/use-auth";

/** Charge et enregistre le profil de livraison (local + compte connecté). */
export function useCheckoutProfile() {
  const sessionQuery = useSession();
  const [profile, setProfile] = useState<CheckoutDeliveryProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const local = loadCheckoutProfileFromStorage();
    if (local && isCheckoutProfileComplete(local)) {
      setProfile(local);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!sessionQuery.data?.id) return;
    void api
      .getPreferences()
      .then((prefs) => {
        const server = prefs.checkoutProfile;
        if (server && isCheckoutProfileComplete(server)) {
          setProfile(server);
          saveCheckoutProfileToStorage(server);
        }
      })
      .catch(() => {
        /* non bloquant */
      });
  }, [sessionQuery.data?.id]);

  const saveProfile = useCallback(
    async (next: CheckoutDeliveryProfile) => {
      const payload: CheckoutDeliveryProfile = {
        ...next,
        updatedAt: new Date().toISOString(),
      };
      setProfile(payload);
      saveCheckoutProfileToStorage(payload);

      if (sessionQuery.data?.id) {
        try {
          const current = await api.getPreferences();
          await api.savePreferences({
            cart: current.cart,
            favorites: current.favorites,
            checkoutProfile: payload,
          });
        } catch {
          /* localStorage suffit */
        }
      }
    },
    [sessionQuery.data?.id],
  );

  const clearProfile = useCallback(() => {
    setProfile(null);
    saveCheckoutProfileToStorage(emptyCheckoutProfile());
  }, []);

  return {
    profile,
    loaded,
    hasProfile: Boolean(profile && isCheckoutProfileComplete(profile)),
    saveProfile,
    clearProfile,
  };
}
