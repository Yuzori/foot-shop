"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import {
  isAdminSessionActive,
  VISITOR_SESSION_KEY,
} from "@/lib/admin-session";
import { useCartStore } from "@/store/cart-store";

const INTERVAL_MS = 8_000;

function getVisitorId(): string {
  let id = sessionStorage.getItem(VISITOR_SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(VISITOR_SESSION_KEY, id);
  }
  return id;
}

function cartCounts() {
  const lines = useCartStore.getState().lines;
  return {
    cartLines: lines.length,
    cartItems: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

function shouldSkipPresence(pathname: string): boolean {
  if (pathname.startsWith("/admin")) return true;
  return isAdminSessionActive();
}

/** Envoie un ping serveur pour les stats admin (visiteurs / paniers). */
export function SitePresenceHeartbeat() {
  const pathname = usePathname();

  useEffect(() => {
    if (shouldSkipPresence(pathname)) return;

    const sessionId = getVisitorId();

    const ping = () => {
      if (shouldSkipPresence(window.location.pathname)) return;

      const { cartLines, cartItems } = cartCounts();
      void fetch("/api/site/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          cartLines,
          cartItems,
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
  }, [pathname]);

  return null;
}
