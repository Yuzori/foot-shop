"use client";

import { useState, type FormEvent } from "react";
import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getStripePromise, isCheckoutSessionPaid } from "@/lib/stripe-client";

interface StripePaymentFormProps {
  clientSecret: string;
  publishableKey: string;
  onSuccess: (checkoutSessionId: string) => void | Promise<void>;
  onError: (message: string) => void;
  disabled?: boolean;
}

function PaymentForm({
  onSuccess,
  onError,
  disabled = false,
}: Omit<StripePaymentFormProps, "clientSecret" | "publishableKey">) {
  const checkoutState = useCheckoutElements();
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const totalLabel =
    checkoutState.type === "success"
      ? checkoutState.checkout.total.total.amount
      : null;

  async function handlePay(e: FormEvent) {
    e.preventDefault();
    if (checkoutState.type !== "success" || !ready) return;

    const { checkout } = checkoutState;
    if (!checkout.canConfirm) {
      onError("Le formulaire de paiement n'est pas encore prêt. Patientez un instant.");
      return;
    }

    setPending(true);
    onError("");

    try {
      const confirmResult = await checkout.confirm({
        redirect: "if_required",
      });

      if (confirmResult.type === "error") {
        onError(confirmResult.error.message ?? "Le paiement a échoué.");
        return;
      }

      if (
        isCheckoutSessionPaid(confirmResult.session.status) ||
        confirmResult.session.status.type === "complete"
      ) {
        await onSuccess(confirmResult.session.id);
        return;
      }

      onError("Le paiement n'a pas pu être finalisé. Réessayez.");
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue pendant le paiement.",
      );
    } finally {
      setPending(false);
    }
  }

  if (checkoutState.type === "loading") {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (checkoutState.type === "error") {
    return (
      <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm text-accent">
        {checkoutState.error.message}
      </p>
    );
  }

  return (
    <form onSubmit={handlePay} className="space-y-6">
      {loadError ? (
        <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm text-accent">
          {loadError}
        </p>
      ) : null}

      {!ready && !loadError ? (
        <div className="flex items-center justify-center py-10">
          <Spinner className="h-6 w-6" />
        </div>
      ) : null}

      <div className={ready ? "block" : "sr-only"}>
        <PaymentElement
          options={{ layout: "tabs" }}
          onReady={() => setReady(true)}
          onLoadError={(event) => {
            const message =
              event.error?.message ??
              "Impossible de charger le formulaire de paiement. Vérifiez vos clés Stripe (test/live doivent correspondre).";
            setLoadError(message);
            onError(message);
          }}
        />
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={!ready || pending || disabled || Boolean(loadError) || !totalLabel}
        className="w-full bg-accent hover:bg-accent-dark"
      >
        {pending ? (
          <span className="flex h-5 w-full items-center justify-center">
            <Spinner className="h-5 w-5 border-paper/30 border-t-paper" />
          </span>
        ) : (
          `Payer ${totalLabel ?? "…"}`
        )}
      </Button>
    </form>
  );
}

export function StripePaymentForm({
  clientSecret,
  publishableKey,
  onSuccess,
  onError,
  disabled,
}: StripePaymentFormProps) {
  const stripePromise = getStripePromise(publishableKey);

  if (!publishableKey) {
    return (
      <p className="text-sm text-accent">
        Clé publique Stripe manquante ou incompatible avec la clé secrète.
        Vérifiez .env.local (sk_test_ + pk_test_, ou sk_live_ + pk_live_).
      </p>
    );
  }

  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <CheckoutElementsProvider
      key={clientSecret}
      stripe={stripePromise}
      options={{
        clientSecret,
        elementsOptions: {
          appearance: {
            theme: "stripe",
            variables: {
              colorPrimary: "#e2001a",
              borderRadius: "12px",
              fontFamily: "Poppins, sans-serif",
            },
          },
        },
      }}
    >
      <PaymentForm onSuccess={onSuccess} onError={onError} disabled={disabled} />
    </CheckoutElementsProvider>
  );
}
