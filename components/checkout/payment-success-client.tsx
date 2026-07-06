"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { api } from "@/lib/api";
import { useCartStore } from "@/store/cart-store";

/** Finalise la commande après redirection Stripe (3DS, etc.). */
export function PaymentSuccessClient({
  sessionId,
}: {
  sessionId?: string;
}) {
  const clear = useCartStore((s) => s.clear);
  const started = useRef(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (!sessionId || started.current) return;
    started.current = true;

    void api.confirmStripePayment(sessionId).then(() => {
      clear();
      void qc.invalidateQueries({ queryKey: ["my-orders"] });
      void qc.invalidateQueries({ queryKey: ["session"] });
      void qc.invalidateQueries({ queryKey: ["welcome-promo"] });
    });
  }, [sessionId, clear, qc]);

  return null;
}
