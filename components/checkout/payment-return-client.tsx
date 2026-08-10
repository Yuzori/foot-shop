"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { routes } from "@/config/site";
import { api } from "@/lib/api";
import { clearCheckoutSession } from "@/lib/checkout-session-storage";
import { useCartStore } from "@/store/cart-store";

type Phase = "verifying" | "pending" | "paid" | "failed";

const PENDING_POLLS = 20;
const PENDING_INTERVAL_MS = 2_000;

/**
 * Retour paiement (PayPal, 3DS, etc.) — n'affiche le succès qu'après
 * vérification serveur du paiement.
 */
export function PaymentReturnClient({
  sessionId,
  refParam,
}: {
  sessionId?: string;
  refParam?: string;
}) {
  const [phase, setPhase] = useState<Phase>(sessionId ? "verifying" : "failed");
  const [reference, setReference] = useState<string | null>(refParam ?? null);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const started = useRef(false);
  const confirmAttempted = useRef(false);
  const qc = useQueryClient();
  const clearCart = useCartStore((s) => s.clear);
  const unlockCheckout = useCartStore((s) => s.unlockCheckout);

  useEffect(() => {
    if (!sessionId || started.current) return;
    started.current = true;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    async function finalizePaid(confirmedReference: string | null) {
      if (cancelled) return;
      setReference(confirmedReference);
      unlockCheckout();
      clearCheckoutSession();
      clearCart();
      void qc.invalidateQueries({ queryKey: ["my-orders"] });
      void qc.invalidateQueries({ queryKey: ["session"] });
      void qc.invalidateQueries({ queryKey: ["welcome-promo"] });
      setPhase("paid");
    }

    async function handleFailed(reason: string | null) {
      if (cancelled) return;
      unlockCheckout();
      clearCheckoutSession();
      setFailureReason(reason);
      setPhase("failed");
    }

    async function confirmPaymentOnce(): Promise<boolean> {
      if (confirmAttempted.current) return true;
      confirmAttempted.current = true;
      try {
        await api.confirmStripePayment(sessionId!);
        return true;
      } catch {
        confirmAttempted.current = false;
        return false;
      }
    }

    async function verifyPaid(): Promise<
      | { ok: true; reference: string | null }
      | { ok: false; state: "pending" | "failed"; reason: string | null }
    > {
      const status = await api.getStripeSessionStatus(sessionId!);
      if (status.reference) setReference(status.reference);

      if (status.state === "paid") {
        if (status.fulfilled) {
          return {
            ok: true,
            reference: status.reference ?? refParam ?? null,
          };
        }

        const confirmed = await confirmPaymentOnce();
        if (confirmed) {
          return {
            ok: true,
            reference: status.reference ?? refParam ?? null,
          };
        }

        return { ok: false, state: "pending", reason: "processing" };
      }

      if (status.state === "pending") {
        return { ok: false, state: "pending", reason: status.reason };
      }

      return {
        ok: false,
        state: "failed",
        reason: status.reason ?? "cancelled_or_unpaid",
      };
    }

    async function run() {
      try {
        const first = await verifyPaid();
        if (cancelled) return;

        if (first.ok) {
          await finalizePaid(first.reference);
          return;
        }

        if (first.state === "failed") {
          await handleFailed(first.reason);
          return;
        }

        setPhase("pending");
        let attempts = 0;

        const poll = async () => {
          if (cancelled || attempts >= PENDING_POLLS) {
            if (!cancelled && attempts >= PENDING_POLLS) {
              await handleFailed("processing_timeout");
            }
            return;
          }
          attempts += 1;

          try {
            const next = await verifyPaid();
            if (cancelled) return;

            if (next.ok) {
              await finalizePaid(next.reference);
              return;
            }
            if (next.state === "failed") {
              await handleFailed(next.reason);
              return;
            }
          } catch {
            /* réessayer */
          }

          pollTimer = setTimeout(() => {
            void poll();
          }, PENDING_INTERVAL_MS);
        };

        pollTimer = setTimeout(() => {
          void poll();
        }, PENDING_INTERVAL_MS);
      } catch {
        await handleFailed("verification_error");
      }
    }

    void run();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [sessionId, refParam, clearCart, unlockCheckout, qc]);

  const trackingHref = reference
    ? `${routes.tracking}?ref=${encodeURIComponent(reference)}`
    : routes.tracking;

  if (phase === "verifying" || phase === "pending") {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <Spinner className="mx-auto h-8 w-8" />
        <h1 className="display-2 mt-8">
          {phase === "pending"
            ? "Paiement en cours de validation"
            : "Vérification du paiement"}
        </h1>
        <p className="mt-4 text-sm text-ink/55">
          {phase === "pending"
            ? "Votre banque ou PayPal confirme encore le paiement. Ne fermez pas cette page."
            : "Nous vérifions que votre paiement a bien été accepté…"}
        </p>
      </div>
    );
  }

  if (phase === "failed") {
    const message =
      failureReason === "processing_timeout"
        ? "Le paiement n'a pas été confirmé à temps. Si un débit apparaît sur votre compte, contactez-nous avec votre référence."
        : failureReason === "verification_error"
          ? "Impossible de vérifier le paiement. Réessayez ou choisissez un autre moyen de paiement."
          : "Le paiement n'a pas été finalisé (annulé ou refusé). Votre commande n'est pas confirmée et vous n'avez pas été débité.";

    return (
      <div className="mx-auto max-w-xl">
        <h1 className="display-2 mb-6 text-center text-accent">
          Paiement non confirmé
        </h1>
        <EmptyState
          title={reference ? `Référence ${reference}` : "Aucun paiement reçu"}
          description={message}
          action={{ label: "Réessayer le paiement", href: `${routes.checkout}?payment_failed=1` }}
        />
        <div className="mt-6 text-center">
          <Link href={routes.cart} className="text-sm text-ink/50 underline-offset-2 hover:text-ink hover:underline">
            Retour au panier
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="display-2 mb-6 text-center">Merci pour votre commande</h1>
      <EmptyState
        title={
          reference
            ? `Paiement confirmé — Référence ${reference}`
            : "Paiement confirmé"
        }
        description="Votre paiement a bien été reçu. Conservez votre référence : vous pouvez suivre votre commande sans créer de compte."
        action={{ label: "Suivre ma commande", href: trackingHref }}
      />
    </div>
  );
}
