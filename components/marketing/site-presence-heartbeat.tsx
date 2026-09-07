"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { useSession } from "@/hooks/use-auth";
import {
  isAdminSessionActive,
  VISITOR_SESSION_KEY,
} from "@/lib/admin-session";
import { loadCheckoutProfileFromStorage } from "@/lib/checkout-profile";
import type { LiveCartProduct } from "@/lib/live-site-stats-types";
import { useCartStore } from "@/store/cart-store";

const INTERVAL_MS = 4_000;

function getVisitorId(): string {
  let id = sessionStorage.getItem(VISITOR_SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(VISITOR_SESSION_KEY, id);
  }
  return id;
}

function cartPayload(): {
  cartLines: number;
  cartItems: number;
  products: LiveCartProduct[];
} {
  const lines = useCartStore.getState().lines;
  const products = lines.map((line) => ({
    name: line.name,
    quantity: line.quantity,
    optionsLabel: line.optionsLabel,
  }));
  return {
    cartLines: lines.length,
    cartItems: lines.reduce((sum, line) => sum + line.quantity, 0),
    products,
  };
}

function guestDisplayName(sessionId: string): string {
  const suffix = sessionId.replace(/-/g, "").slice(-6).toLowerCase();
  return `User_${suffix}`;
}

function resolveDisplayName(
  sessionId: string,
  user?: { firstName?: string | null; lastName?: string | null } | null,
): string {
  if (user?.firstName?.trim() || user?.lastName?.trim()) {
    return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  }
  const profile = loadCheckoutProfileFromStorage();
  const fromProfile = `${profile?.contact.firstName ?? ""} ${profile?.contact.lastName ?? ""}`.trim();
  if (fromProfile) return fromProfile;
  return guestDisplayName(sessionId);
}

function shouldSkipPresence(pathname: string): boolean {
  if (pathname.startsWith("/admin")) return true;
  return isAdminSessionActive();
}

/** Envoie un ping serveur pour les stats admin (visiteurs / paniers). */
export function SitePresenceHeartbeat() {
  const pathname = usePathname();
  const { data: user } = useSession();

  useEffect(() => {
    if (shouldSkipPresence(pathname)) return;

    const sessionId = getVisitorId();

    const ping = () => {
      if (shouldSkipPresence(window.location.pathname)) return;

      const { cartLines, cartItems, products } = cartPayload();
      void fetch("/api/site/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          cartLines,
          cartItems,
          products,
          displayName: resolveDisplayName(sessionId, user),
          pathname: window.location.pathname,
        }),
        keepalive: true,
      });
    };

    ping();
    const timer = window.setInterval(ping, INTERVAL_MS);
    const unsub = useCartStore.subscribe(ping);

    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(timer);
      unsub();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname, user]);

  return null;
}
