"use client";

import { useState, type ComponentProps, type FormEvent } from "react";
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

/**
 * Onglets avec logos en haut + portefeuilles (Google Pay, Apple Pay, Link).
 * Plus fiable que ExpressCheckoutElement (souvent vide avec Checkout Sessions + PMC).
 */
const PAYMENT_ELEMENT_OPTIONS = {
  layout: {
    type: "tabs" as const,
    defaultCollapsed: false,
  },
  paymentMethodOrder: [
    "google_pay",
    "apple_pay",
    "paypal",
    "link",
    "card",
  ],
  wallets: {
    applePay: "auto" as const,
    googlePay: "auto" as const,
  },
};

const STRIPE_APPEARANCE = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#66BAFF",
    borderRadius: "12px",
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSizeBase: "15px",
    spacingUnit: "4px",
  },
  rules: {
    ".Tab": {
      border: "1px solid rgba(15, 23, 42, 0.1)",
      borderRadius: "10px",
      padding: "10px 12px",
    },
    ".Tab--selected": {
      borderColor: "#66BAFF",
      boxShadow: "0 0 0 1px rgba(102, 186, 255, 0.35)",
    },
    ".TabIcon": {
      height: "1.35rem",
    },
    ".TabLabel": {
      fontWeight: "600",
      fontSize: "13px",
    },
    ".Label": {
      fontWeight: "500",
    },
    ".Input": {
      fontSize: "15px",
    },
  },
};

async function finalizeCheckout(
  checkout: { confirm: (opts: Record<string, unknown>) => Promise<unknown> },
  confirmArgs: Record<string, unknown>,
  onSuccess: (checkoutSessionId: string) => void | Promise<void>,
  onError: (message: string) => void,
): Promise<boolean> {
  const confirmResult = (await checkout.confirm({
    redirect: "if_required",
    ...confirmArgs,
  })) as {
    type: string;
    error?: { message?: string };
    session?: { id: string; status: { type: string } };
  };

  if (confirmResult.type === "error") {
    onError(confirmResult.error?.message ?? "Le paiement a échoué.");
    return false;
  }

  const session = confirmResult.session;
  if (
    session &&
    (isCheckoutSessionPaid(session.status) || session.status.type === "complete")
  ) {
    await onSuccess(session.id);
    return true;
  }

  onError("Le paiement n'a pas pu être finalisé. Réessayez.");
  return false;
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
      await finalizeCheckout(checkout, {}, onSuccess, onError);
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
    <form onSubmit={handlePay} className="checkout-payment-form space-y-6">
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

      <div className={ready ? "checkout-payment-tabs block" : "sr-only"}>
        <PaymentElement
          options={
            PAYMENT_ELEMENT_OPTIONS as ComponentProps<
              typeof PaymentElement
            >["options"]
          }
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
        className="w-full bg-accent text-ink hover:bg-accent-dark hover:shadow-glow-sm"
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
          appearance: STRIPE_APPEARANCE,
        },
      }}
    >
      <PaymentForm onSuccess={onSuccess} onError={onError} disabled={disabled} />
    </CheckoutElementsProvider>
  );
}
