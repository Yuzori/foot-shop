"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { useCartStore } from "@/store/cart-store";

const VISITOR_KEY = "footshop-visitor-id";
const INTERVAL_MS = 30_000;

function getVisitorId(): string {
  let id = sessionStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(VISITOR_KEY, id);
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

/** Envoie un ping serveur pour les stats admin (visiteurs / paniers). */
export function SitePresenceHeartbeat() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;

    const sessionId = getVisitorId();

    const ping = () => {
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

    return () => {
      window.clearInterval(timer);
      unsub();
    };
  }, [pathname]);

  return null;
}
