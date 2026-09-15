"use client";

import { useCallback, useEffect, useState } from "react";

import {
  isCheckoutProfileComplete,
  loadCheckoutProfileFromStorage,
  saveCheckoutProfileToStorage,
  type CheckoutDeliveryProfile,
} from "@/lib/checkout-profile";

/** Charge et enregistre le profil de livraison (local, sans compte). */
export function useCheckoutProfile() {
  const [profile, setProfile] = useState<CheckoutDeliveryProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = loadCheckoutProfileFromStorage();
    setProfile(
      stored && isCheckoutProfileComplete(stored) ? stored : null,
    );
    setLoaded(true);
  }, []);

  const saveProfile = useCallback(async (next: CheckoutDeliveryProfile) => {
    const payload: CheckoutDeliveryProfile = {
      ...next,
      updatedAt: new Date().toISOString(),
    };
    setProfile(payload);
    saveCheckoutProfileToStorage(payload);
  }, []);

  const clearProfile = useCallback(() => {
    setProfile(null);
  }, []);

  return {
    profile,
    loaded,
    hasProfile: Boolean(profile && isCheckoutProfileComplete(profile)),
    saveProfile,
    clearProfile,
  };
}
