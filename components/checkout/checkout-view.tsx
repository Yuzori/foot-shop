"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { CheckoutFlocage } from "@/components/checkout/checkout-flocage";
import { CheckoutSteps } from "@/components/checkout/checkout-steps";
import { OrderSummary, summarySubtotal } from "@/components/checkout/order-summary";
import {
  shouldApplyWelcomePromo,
  useWelcomePromo,
} from "@/components/checkout/welcome-promo-banner";
import { StripePaymentForm } from "@/components/checkout/stripe-payment-form";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Spinner } from "@/components/ui/spinner";
import { routes } from "@/config/site";
import { api } from "@/lib/api";
import {
  clearCheckoutCartSnapshot,
  loadCheckoutCartSnapshot,
  saveCheckoutCartSnapshot,
} from "@/lib/checkout-cart-snapshot";
import {
  clearCheckoutSession,
  loadCheckoutSession,
  saveCheckoutSession,
} from "@/lib/checkout-session-storage";
import { getFlocageDisplay } from "@/lib/flocage";
import {
  getFlocageValidationError,
  isFlocageComplete,
} from "@/lib/flocage-validation";
import { formatPrice } from "@/lib/format";
import { getErrorMessage } from "@/lib/http";
import { preloadStripe } from "@/lib/stripe-client";
import { calculateWelcomeBogo, allocateBogoFreeQuantities } from "@/lib/welcome-bogo";
import { useHydrated } from "@/hooks/use-hydrated";
import { cartLineUnitPrice } from "@/hooks/use-cart-bogo";
import {
  resolveCartLinesForCheckout,
  useCartStore,
} from "@/store/cart-store";
import type { CartLine } from "@/types/domain";

function mapLineForApi(line: CartLine) {
  const flocageUnit = line.flocage?.enabled ? line.flocage.price : 0;
  return {
    productId: line.productId,
    variantId: line.variantId,
    quantity: line.quantity,
    unitPrice: line.unitPrice + flocageUnit,
    name: line.name,
    flocage:
      line.flocage?.enabled && isFlocageComplete(line)
        ? {
            name: line.flocage.name,
            number: line.flocage.number,
            text: getFlocageDisplay(line.flocage),
            price: line.flocage.price,
          }
        : undefined,
  };
}

type Step = "details" | "payment";

function mergeLiveFlocage(base: CartLine[], live: CartLine[]): CartLine[] {
  if (live.length === 0) return base;
  return base.map((line) => {
    const updated = live.find(
      (l) => l.productId === line.productId && l.variantId === line.variantId,
    );
    return updated ? { ...line, flocage: updated.flocage } : line;
  });
}

/**
 * Checkout. Coordonnées + flocage, puis paiement Stripe intégré.
 * Le panier est figé en session pour éviter les vidages intempestifs.
 */
export function CheckoutView() {
  const router = useRouter();
  const qc = useQueryClient();
  const hydrated = useHydrated();
  const storeLines = useCartStore((s) => s.lines);
  const removeLine = useCartStore((s) => s.removeLine);
  const clear = useCartStore((s) => s.clear);
  const welcomePromoQuery = useWelcomePromo();

  const [frozenLines, setFrozenLines] = useState<CartLine[] | null>(null);
  const [step, setStep] = useState<Step>("details");
  const [sessionLines, setSessionLines] = useState<CartLine[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [paymentCanceled, setPaymentCanceled] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [orderReference, setOrderReference] = useState<string | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [stripeBogoDiscount, setStripeBogoDiscount] = useState(0);
  const [stripeFreeUnits, setStripeFreeUnits] = useState(0);
  const paymentRestoredRef = useRef(false);

  useLayoutEffect(() => {
    const snapshot = resolveCartLinesForCheckout();
    if (snapshot.length > 0) {
      saveCheckoutCartSnapshot(snapshot);
      setFrozenLines(snapshot);
      if (useCartStore.getState().lines.length === 0) {
        useCartStore.setState({ lines: snapshot });
      }
    } else {
      const saved = loadCheckoutCartSnapshot();
      if (saved.length > 0) {
        setFrozenLines(saved);
      }
    }
  }, []);

  const checkoutLines = frozenLines ?? [];

  const lines = useMemo(() => {
    if (step === "payment" && sessionLines.length > 0) {
      return sessionLines;
    }
    const base =
      checkoutLines.length > 0
        ? checkoutLines
        : storeLines.length > 0
          ? storeLines
          : loadCheckoutCartSnapshot();
    return mergeLiveFlocage(base, storeLines);
  }, [step, sessionLines, checkoutLines, storeLines]);

  useEffect(() => {
    if (!hydrated) return;

    const saved = loadCheckoutSession();
    if (!saved) return;

    const hasCart = lines.length > 0;

    if (!hasCart && saved.step === "payment") {
      if (paymentRestoredRef.current) return;
      paymentRestoredRef.current = true;
      setSessionLines(saved.lines);
      setClientSecret(saved.clientSecret);
      setPublishableKey(saved.publishableKey);
      setOrderReference(saved.orderReference);
      setStripeBogoDiscount(saved.stripeBogoDiscount);
      setStripeFreeUnits(saved.stripeFreeUnits);
      setStep("payment");
      return;
    }

    if (hasCart && saved.step === "payment") {
      clearCheckoutSession();
      paymentRestoredRef.current = false;
    }
  }, [hydrated, lines.length]);

  useEffect(() => {
    if (step === "details" && checkoutLines.length > 0) {
      setSessionLines(checkoutLines);
    }
  }, [step, checkoutLines]);

  const bogoCartLines = useMemo(
    () =>
      lines.map((line) => ({
        name: line.name,
        unitPrice: cartLineUnitPrice(line),
        quantity: line.quantity,
      })),
    [lines],
  );

  const freePerLine = useMemo(() => {
    if (welcomePromoQuery.data?.status !== "eligible") {
      return lines.map(() => 0);
    }
    return allocateBogoFreeQuantities(bogoCartLines);
  }, [bogoCartLines, lines, welcomePromoQuery.data?.status]);

  const subtotal = useMemo(() => summarySubtotal(lines), [lines]);

  const bogoPreview = useMemo(() => {
    if (welcomePromoQuery.data?.status !== "eligible") return null;
    return calculateWelcomeBogo(bogoCartLines);
  }, [bogoCartLines, welcomePromoQuery.data?.status]);

  const bogoDiscount =
    stripeBogoDiscount > 0
      ? stripeBogoDiscount
      : (bogoPreview?.discountTotal ?? 0);

  const orderTotal = Math.max(0, subtotal - bogoDiscount);

  const persistPaymentSession = useCallback(
    (
      secret: string,
      pubKey: string,
      ref: string | null,
      snapshot: CartLine[],
      bogoDisc: number,
      freeUnits: number,
    ) => {
      saveCheckoutSession({
        step: "payment",
        clientSecret: secret,
        publishableKey: pubKey,
        orderReference: ref,
        lines: snapshot,
        stripeBogoDiscount: bogoDisc,
        stripeFreeUnits: freeUnits,
      });
    },
    [],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("canceled") === "1") {
      setPaymentCanceled(true);
      window.history.replaceState({}, "", routes.checkout);
    }
    void preloadStripe();
  }, []);

  if (!hydrated) {
    return (
      <Container className="flex min-h-[50vh] items-center justify-center py-24">
        <Spinner className="h-8 w-8" />
      </Container>
    );
  }

  const checkoutActive = step === "payment" && Boolean(clientSecret);

  if (
    lines.length === 0 &&
    !reference &&
    !checkoutActive &&
    !pending
  ) {
    return (
      <Container className="py-12">
        <PageHeader title="Paiement" />
        <EmptyState
          title="Votre panier est vide"
          description="Ajoutez des articles avant de passer au paiement."
          action={{ label: "Voir la boutique", href: routes.catalogue }}
        />
      </Container>
    );
  }

  if (reference) {
    return (
      <Container className="py-12">
        <PageHeader title="Commande enregistrée" />
        <EmptyState
          title={`Merci ! Référence ${reference}`}
          description="Votre commande a bien été enregistrée et apparaît dans votre espace client."
          action={{ label: "Suivre ma commande", href: routes.tracking }}
        />
      </Container>
    );
  }

  async function handleDetailsSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPaymentCanceled(false);

    const formEl = e.currentTarget;
    const formData = new FormData(formEl);
    const value = (k: string) => String(formData.get(k) ?? "").trim();

    const activeLines = mergeLiveFlocage(
      frozenLines && frozenLines.length > 0
        ? frozenLines
        : sessionLines.length > 0
          ? sessionLines
          : resolveCartLinesForCheckout(),
      useCartStore.getState().lines,
    );
    if (activeLines.length === 0) {
      setError("Votre panier est vide.");
      return;
    }

    const flocageError = getFlocageValidationError(activeLines);
    if (flocageError) {
      setError(flocageError);
      return;
    }

    const snapshot = activeLines.map((line) => ({ ...line }));
    setSessionLines(snapshot);

    try {
      const validateRes = await fetch("/api/cart/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: snapshot.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            name: l.name,
            quantity: l.quantity,
          })),
        }),
      });
      const validateData = (await validateRes.json()) as {
        ok?: boolean;
        invalid?: { productId: string; variantId: string | null; message?: string }[];
      };
      if (!validateData.ok) {
        if (!useCartStore.getState().checkoutLocked) {
          for (const row of validateData.invalid ?? []) {
            removeLine(row.productId, row.variantId);
          }
        }
        setError(
          validateData.invalid?.[0]?.message ??
            "Certains articles ne sont plus disponibles et ont été retirés du panier.",
        );
        return;
      }
    } catch {
      setError("Impossible de vérifier le stock. Réessayez.");
      return;
    }

    setPending(true);

    const apiLines = snapshot.map(mapLineForApi);
    const payload = {
      contact: {
        firstName: value("firstName"),
        lastName: value("lastName"),
        email: value("email"),
        phone: value("phone"),
      },
      address: {
        address1: value("address1"),
        address2: value("address2"),
        postcode: value("postcode"),
        city: value("city"),
        country: value("country"),
      },
      lines: apiLines,
    };

    const stripeItems = snapshot.map((l) => ({
      name:
        l.name +
        (l.flocage?.enabled && isFlocageComplete(l)
          ? ` + Flocage (${getFlocageDisplay(l.flocage!)})`
          : ""),
      unitPrice: l.unitPrice + (l.flocage?.enabled ? l.flocage.price : 0),
      quantity: l.quantity,
    }));

    try {
      try {
        await welcomePromoQuery.refetch();
        const session = await api.checkoutStripeSession({
          ...payload,
          items: stripeItems,
          applyWelcomePromo: shouldApplyWelcomePromo(welcomePromoQuery.data),
        });
        const bogoDisc = session.bogoDiscount ?? 0;
        const freeUnits = session.freeUnits ?? 0;
        setStripeBogoDiscount(bogoDisc);
        setStripeFreeUnits(freeUnits);
        if (session.bogoApplied) {
          await welcomePromoQuery.refetch();
        }
        if (session.clientSecret && session.publishableKey) {
          setClientSecret(session.clientSecret);
          setPublishableKey(session.publishableKey);
          setOrderReference(session.reference);
          setStep("payment");
          persistPaymentSession(
            session.clientSecret,
            session.publishableKey,
            session.reference,
            snapshot,
            bogoDisc,
            freeUnits,
          );
          return;
        }
      } catch (stripeErr) {
        const status = (stripeErr as { response?: { status?: number } })?.response
          ?.status;
        if (status !== 503) throw stripeErr;
      }

      const result = await api.checkout(payload);
      useCartStore.getState().unlockCheckout();
      clear();
      clearCheckoutSession();
      clearCheckoutCartSnapshot();
      setReference(result.reference);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function handlePaymentSuccess(checkoutSessionId: string) {
    setConfirmingPayment(true);
    setError(null);
    try {
      await api.confirmStripePayment(checkoutSessionId);
    } catch (err) {
      setError(
        getErrorMessage(err) ||
          "Paiement reçu mais la commande n'a pas pu être finalisée. Contactez le support avec votre référence.",
      );
      setConfirmingPayment(false);
      return;
    }

    useCartStore.getState().unlockCheckout();
    clear();
    clearCheckoutSession();
    clearCheckoutCartSnapshot();
    void qc.invalidateQueries({ queryKey: ["session"] });
    void qc.invalidateQueries({ queryKey: ["my-orders"] });
    void welcomePromoQuery.refetch();
    const ref = orderReference ?? "";
    const params = new URLSearchParams();
    if (ref) params.set("ref", ref);
    params.set("session_id", checkoutSessionId);
    router.push(`/paiement/succes?${params.toString()}`);
  }

  function handleBackToDetails() {
    setStep("details");
    setClientSecret(null);
    setPublishableKey(null);
    setError(null);
    clearCheckoutSession();
  }

  return (
    <Container className="py-12 lg:py-16">
      <PageHeader
        eyebrow="Commande"
        title="Paiement"
        description={
          step === "details"
            ? "Renseignez vos coordonnées pour continuer vers le paiement sécurisé."
            : "Finalisez votre commande en toute sécurité avec Stripe."
        }
      />

      <CheckoutSteps current={step} />

      {paymentCanceled ? (
        <div
          className="mb-8 rounded-2xl border border-amber-200/80 bg-amber-50 px-5 py-4"
          role="alert"
        >
          <p className="font-semibold text-amber-950">Paiement annulé</p>
          <p className="mt-1 text-sm text-amber-900/80">
            Votre panier est intact. Vous pouvez réessayer quand vous voulez.
          </p>
        </div>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-12">
        {step === "details" ? (
          <form onSubmit={handleDetailsSubmit} className="space-y-8">
            <section className="surface-card p-6 sm:p-8">
              <h2 className="section-title mb-5">Coordonnées</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Prénom" name="firstName" required autoComplete="given-name" />
                <Field label="Nom" name="lastName" required autoComplete="family-name" />
                <Field label="Email" name="email" type="email" required autoComplete="email" className="sm:col-span-2" />
                <Field label="Téléphone" name="phone" type="tel" autoComplete="tel" className="sm:col-span-2" />
              </div>
            </section>

            <section className="surface-card p-6 sm:p-8">
              <h2 className="section-title mb-5">Adresse de livraison</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Adresse" name="address1" required autoComplete="address-line1" className="sm:col-span-2" />
                <Field label="Complément" name="address2" autoComplete="address-line2" className="sm:col-span-2" />
                <Field label="Code postal" name="postcode" required autoComplete="postal-code" />
                <Field label="Ville" name="city" required autoComplete="address-level2" />
                <Field label="Pays" name="country" required defaultValue="France" autoComplete="country-name" className="sm:col-span-2" />
              </div>
            </section>

            <div className="surface-card p-6 sm:p-8">
              <CheckoutFlocage />
            </div>

            {error ? (
              <p className="rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-accent" role="alert">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              size="lg"
              disabled={pending}
              className="w-full bg-accent hover:bg-accent-dark sm:w-auto"
            >
              {pending ? (
                <span className="flex items-center gap-2">
                  <Spinner className="h-4 w-4 border-paper/30 border-t-paper" />
                  Préparation du paiement…
                </span>
              ) : (
                `Continuer — ${formatPrice(orderTotal)}`
              )}
            </Button>
          </form>
        ) : (
          <section className="surface-card space-y-6 p-6 sm:p-8">
            <div>
              <h2 className="section-title">Paiement sécurisé</h2>
              <p className="mt-2 text-sm text-ink/55">
                Saisissez vos coordonnées bancaires ci-dessous. Paiement traité
                par Stripe.
              </p>
            </div>

            {clientSecret && publishableKey ? (
              <StripePaymentForm
                clientSecret={clientSecret}
                publishableKey={publishableKey}
                onSuccess={handlePaymentSuccess}
                onError={setError}
                disabled={confirmingPayment}
              />
            ) : (
              <div className="flex justify-center py-10">
                <Spinner className="h-6 w-6" />
              </div>
            )}

            {confirmingPayment ? (
              <p className="text-center text-sm text-ink/55">
                Finalisation de la commande…
              </p>
            ) : null}

            {error ? (
              <p className="rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-accent" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleBackToDetails}
              disabled={confirmingPayment}
              className="text-sm text-ink/50 underline-offset-2 hover:text-ink hover:underline disabled:opacity-40"
            >
              ← Modifier mes informations
            </button>
          </section>
        )}

        <OrderSummary
          lines={lines}
          freePerLine={freePerLine}
          bogoCartLines={bogoCartLines}
          subtotal={subtotal}
          orderTotal={orderTotal}
          stripeBogoDiscount={stripeBogoDiscount}
          stripeFreeUnits={stripeFreeUnits}
        />
      </div>
    </Container>
  );
}
