"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { useSession } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { mergeCartLines } from "@/lib/cart-merge";
import { useCartStore } from "@/store/cart-store";
import { useFavoritesStore } from "@/store/favorites-store";
import { usePreferencesSyncStore } from "@/store/preferences-sync-store";

const CHECKOUT_PREFIX = "/paiement";
const CART_PREFIX = "/panier";

function isProtectedRoute(pathname: string): boolean {
  return pathname.startsWith(CHECKOUT_PREFIX) || pathname.startsWith(CART_PREFIX);
}

/** Synchronise panier et favoris avec le compte client. */
export function UserPreferencesSync() {
  const pathname = usePathname();
  const protectedRoute = isProtectedRoute(pathname);
  const { data: user } = useSession();
  const userId = user?.id ?? null;
  const paused = usePreferencesSyncStore((s) => s.paused);
  const loadedUserId = usePreferencesSyncStore((s) => s.loadedUserId);
  const markLoaded = usePreferencesSyncStore((s) => s.markLoaded);
  const reset = usePreferencesSyncStore((s) => s.reset);

  const favoriteIds = useFavoritesStore((s) => s.ids);
  const cartLines = useCartStore((s) => s.lines);
  const hydrating = useRef(false);
  const lastSavedCart = useRef("");

  useEffect(() => {
    if (protectedRoute) {
      usePreferencesSyncStore.getState().pause();
    } else {
      usePreferencesSyncStore.getState().resume();
    }
  }, [protectedRoute]);

  useEffect(() => {
    if (!userId) return;
    if (loadedUserId === userId || hydrating.current) return;

    hydrating.current = true;
    let cancelled = false;

    (async () => {
      try {
        const prefs = await api.getPreferences();
        if (cancelled) return;

        const serverFavs = prefs.favorites ?? [];
        const localFavs = useFavoritesStore.getState().ids;
        const mergedFavs = [...new Set([...localFavs, ...serverFavs])];
        useFavoritesStore.getState().setIds(mergedFavs);

        const serverCart = prefs.cart ?? [];
        const localCart = useCartStore.getState().lines;
        const mergedCart = mergeCartLines(localCart, serverCart);
        useCartStore.setState({ lines: mergedCart });
        lastSavedCart.current = JSON.stringify(mergedCart);

        markLoaded(userId);
      } catch {
        if (!cancelled) markLoaded(userId);
      } finally {
        hydrating.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, loadedUserId, markLoaded]);

  useEffect(() => {
    if (!userId) {
      reset();
      if (!protectedRoute) {
        usePreferencesSyncStore.getState().resume();
      }
    }
  }, [userId, reset, protectedRoute]);

  useEffect(() => {
    if (!userId || paused || protectedRoute || loadedUserId !== userId) {
      return;
    }

    const timer = window.setTimeout(() => {
      const cartSig = JSON.stringify(cartLines);
      if (cartSig === lastSavedCart.current) return;
      lastSavedCart.current = cartSig;

      api
        .savePreferences({ cart: cartLines, favorites: favoriteIds })
        .catch(() => {});
    }, 2_000);

    return () => window.clearTimeout(timer);
  }, [userId, cartLines, favoriteIds, paused, loadedUserId, protectedRoute]);

  return null;
}
