"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const CartDrawer = dynamic(
  () => import("@/components/cart/cart-drawer").then((m) => ({ default: m.CartDrawer })),
  { ssr: false },
);
const FavoritesDrawer = dynamic(
  () =>
    import("@/components/favorites/favorites-drawer").then((m) => ({
      default: m.FavoritesDrawer,
    })),
  { ssr: false },
);
const AccountDrawer = dynamic(
  () =>
    import("@/components/account/account-drawer").then((m) => ({
      default: m.AccountDrawer,
    })),
  { ssr: false },
);
const SearchOverlay = dynamic(
  () =>
    import("@/components/search/search-overlay").then((m) => ({
      default: m.SearchOverlay,
    })),
  { ssr: false },
);
const WelcomePromoNotifier = dynamic(
  () =>
    import("@/components/marketing/welcome-promo-notifier").then((m) => ({
      default: m.WelcomePromoNotifier,
    })),
  { ssr: false },
);
const FavoriteNudge = dynamic(
  () =>
    import("@/components/product/favorite-nudge").then((m) => ({
      default: m.FavoriteNudge,
    })),
  { ssr: false },
);
const RecentProductBar = dynamic(
  () =>
    import("@/components/product/recent-product-bar").then((m) => ({
      default: m.RecentProductBar,
    })),
  { ssr: false },
);

/** Overlays chargés après le premier rendu pour alléger la navigation. */
export function ClientShell() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const mount = () => {
      if (!cancelled) setReady(true);
    };

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(mount, { timeout: 1200 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }

    const t = window.setTimeout(mount, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  if (!ready) return null;

  return (
    <>
      <CartDrawer />
      <FavoritesDrawer />
      <AccountDrawer />
      <SearchOverlay />
      <WelcomePromoNotifier />
      <FavoriteNudge />
      <RecentProductBar />
    </>
  );
}
