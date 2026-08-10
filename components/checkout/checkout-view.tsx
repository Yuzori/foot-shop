"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { CheckoutFlocage } from "@/components/checkout/checkout-flocage";
import { CheckoutSteps } from "@/components/checkout/checkout-steps";
import { OrderSummary, CheckoutMobileStickyBar, summarySubtotal } from "@/components/checkout/order-summary";
import {
  shouldApplyWelcomePromo,
  useWelcomePromo,
} from "@/components/checkout/welcome-promo-banner";
import { StripePaymentForm } from "@/components/checkout/stripe-payment-form";
import { WelcomePromoGuestNudge } from "@/components/marketing/welcome-promo-guest-nudge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Spinner } from "@/components/ui/spinner";
import { routes } from "@/config/site";
import { publicConfig } from "@/config";
import {
  getCheckoutFieldErrors,
  validateCheckoutEmail,
  type CheckoutFieldErrors,
  type CheckoutFieldName,
  validateCheckoutContactForm,
} from "@/lib/checkout-contact-validation";
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
import {
  emptyCheckoutProfile,
  type CheckoutDeliveryProfile,
} from "@/lib/checkout-profile";
import { useCartStockGuard } from "@/hooks/use-cart-stock-guard";
import { useHydrated } from "@/hooks/use-hydrated";
import { useScrollToTop } from "@/hooks/use-scroll-to-top";
import { useSession } from "@/hooks/use-auth";
import { useCheckoutProfile } from "@/hooks/use-checkout-profile";
import { cartLineUnitPrice } from "@/hooks/use-cart-bogo";
import {
  resolveCartLinesForCheckout,
  useCartStore,
} from "@/store/cart-store";
import type { CartLine } from "@/types/domain";

function mapLineForApi(line: CartLine) {
  const flocageUnit = line.flocage?.enabled ? line.flocage.price : 0;
  return {
    productId: String(line.productId),
    variantId: line.variantId != null ? String(line.variantId) : null,
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

const CHECKOUT_FIELD_NAMES: CheckoutFieldName[] = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "address1",
  "postcode",
  "city",
  "country",
];

function normalizeDeliveryForm(form: CheckoutDeliveryProfile) {
  const contact = {
    firstName: form.contact.firstName.trim(),
    lastName: form.contact.lastName.trim(),
    email: form.contact.email.trim(),
    phone: form.contact.phone?.trim() || undefined,
  };
  const address = {
    address1: form.address.address1.trim(),
    address2: form.address.address2?.trim() || undefined,
    postcode: form.address.postcode.trim(),
    city: form.address.city.trim(),
    country: form.address.country.trim() || "France",
  };
  return { contact, address };
}

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
  const sessionQuery = useSession();
  const { profile: savedProfile, hasProfile, saveProfile } = useCheckoutProfile();

  const [deliveryForm, setDeliveryForm] = useState(() => emptyCheckoutProfile());
  const [usingSavedProfile, setUsingSavedProfile] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  const [touchedFields, setTouchedFields] = useState<
    Partial<Record<CheckoutFieldName, boolean>>
  >({});
  const emailVerifyRequest = useRef(0);

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
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoPending, setPromoPending] = useState(false);
  const [shippingPreview, setShippingPreview] = useState<{
    fee: number;
    label: string;
  } | null>(null);
  const paymentRestoredRef = useRef(false);
  const detailsFormRef = useRef<HTMLFormElement>(null);
  const paymentSectionRef = useRef<HTMLElement>(null);
  const accountPrefilled = useRef(false);

  useScrollToTop();

  const markFieldTouched = useCallback((field: CheckoutFieldName) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  }, []);

  const validateCheckoutField = useCallback(
    async (field: CheckoutFieldName, form: CheckoutDeliveryProfile) => {
      const { contact, address } = normalizeDeliveryForm(form);
      const errors = getCheckoutFieldErrors(contact, address);
      const message = errors[field] ?? null;
      setFieldErrors((prev) => ({ ...prev, [field]: message }));
      const valid = !message;

      if (field === "email" && valid && contact.email) {
        const formatError = validateCheckoutEmail(contact.email);
        if (formatError) {
          setFieldErrors((prev) => ({ ...prev, email: formatError }));
          return false;
        }

        const requestId = ++emailVerifyRequest.current;
        try {
          const res = await fetch("/api/checkout/verify-contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: contact.email }),
          });
          const data = (await res.json()) as {
            valid?: boolean;
            message?: string;
          };
          if (requestId !== emailVerifyRequest.current) return valid;
          if (!data.valid) {
            setFieldErrors((prev) => ({
              ...prev,
              email: data.message ?? "Adresse email introuvable.",
            }));
            return false;
          }
        } catch {
          /* réseau : format OK suffit côté client */
        }
      }

      if (field === "phone" && valid && contact.phone) {
        try {
          const res = await fetch("/api/checkout/verify-contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: contact.phone,
              country: address.country,
            }),
          });
          const data = (await res.json()) as {
            valid?: boolean;
            message?: string;
          };
          if (!data.valid) {
            setFieldErrors((prev) => ({
              ...prev,
              phone: data.message ?? "Numéro de téléphone invalide.",
            }));
            return false;
          }
        } catch {
          /* ignore */
        }
      }

      return valid;
    },
    [],
  );

  const touchAllCheckoutFields = useCallback(() => {
    setTouchedFields(
      Object.fromEntries(
        CHECKOUT_FIELD_NAMES.map((field) => [field, true]),
      ) as Partial<Record<CheckoutFieldName, boolean>>,
    );
  }, []);

  const updateDeliveryField = useCallback(
    (
      field: CheckoutFieldName,
      updater: (form: CheckoutDeliveryProfile) => CheckoutDeliveryProfile,
    ) => {
      setDeliveryForm((prev) => {
        const next = updater(prev);
        if (touchedFields[field]) {
          void validateCheckoutField(field, next);
        }
        return next;
      });
    },
    [touchedFields, validateCheckoutField],
  );

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

  useEffect(() => {
    if (step !== "payment") return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    paymentSectionRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [step]);

  const checkoutLines = frozenLines ?? [];

  const stockGuard = useCartStockGuard({
    enabled: hydrated && checkoutLines.length > 0 && step === "details",
  });

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
    if (!sessionQuery.data?.id || welcomePromoQuery.data?.status !== "eligible") {
      return lines.map(() => 0);
    }
    return allocateBogoFreeQuantities(bogoCartLines);
  }, [bogoCartLines, lines, sessionQuery.data?.id, welcomePromoQuery.data?.status]);

  const subtotal = useMemo(() => summarySubtotal(lines), [lines]);

  const bogoPreview = useMemo(() => {
    if (!sessionQuery.data?.id || welcomePromoQuery.data?.status !== "eligible") {
      return null;
    }
    return calculateWelcomeBogo(bogoCartLines);
  }, [bogoCartLines, sessionQuery.data?.id, welcomePromoQuery.data?.status]);

  const bogoDiscount =
    stripeBogoDiscount > 0
      ? stripeBogoDiscount
      : (bogoPreview?.discountTotal ?? 0);

  const orderTotal = Math.max(
    0,
    subtotal - bogoDiscount - promoDiscount + (shippingPreview?.fee ?? 0),
  );

  const refreshShippingPreview = useCallback(
    async (email: string) => {
      if (!email.trim()) return;
      const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
      try {
        const res = await fetch("/api/checkout/shipping-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            customerId: sessionQuery.data?.id,
            itemCount,
          }),
        });
        const data = (await res.json()) as { fee?: number; label?: string };
        if (typeof data.fee === "number") {
          setShippingPreview({ fee: data.fee, label: data.label ?? "" });
        }
      } catch {
        /* ignore */
      }
    },
    [sessionQuery.data?.id, lines],
  );

  const refreshPromoPreview = useCallback(
    async (code: string, email?: string) => {
      const trimmed = code.trim();
      if (!trimmed) {
        setPromoDiscount(0);
        setPromoError(null);
        return;
      }

      setPromoPending(true);
      try {
        const res = await fetch("/api/checkout/promo-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: trimmed,
            email: email?.trim() ?? "",
            customerId: sessionQuery.data?.id,
            subtotal: subtotal - bogoDiscount,
          }),
        });
        const data = (await res.json()) as {
          valid?: boolean;
          discount?: number;
          message?: string;
        };
        if (data.valid && typeof data.discount === "number") {
          setPromoDiscount(data.discount);
          setPromoError(null);
        } else {
          setPromoDiscount(0);
          setPromoError(data.message || "Code promo invalide.");
        }
      } catch {
        setPromoDiscount(0);
        setPromoError("Impossible de vérifier le code promo.");
      } finally {
        setPromoPending(false);
      }
    },
    [bogoDiscount, sessionQuery.data?.id, subtotal],
  );

  const handlePromoCodeChange = useCallback(
    (code: string) => {
      setPromoCode(code);
      try {
        if (code.trim()) {
          sessionStorage.setItem("footshop-promo-code", code);
        } else {
          sessionStorage.removeItem("footshop-promo-code");
        }
      } catch {
        /* ignore */
      }
    },
    [],
  );

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
    if (params.get("canceled") === "1" || params.get("payment_failed") === "1") {
      setPaymentCanceled(true);
      window.history.replaceState({}, "", routes.checkout);
    }
    try {
      const savedPromo = sessionStorage.getItem("footshop-promo-code");
      if (savedPromo) {
        setPromoCode(savedPromo);
        void refreshPromoPreview(savedPromo);
      }
    } catch {
      /* ignore */
    }
    void preloadStripe();
  }, [refreshPromoPreview]);

  useEffect(() => {
    if (!promoCode.trim()) return;
    const timer = window.setTimeout(() => {
      void refreshPromoPreview(promoCode);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [promoCode, refreshPromoPreview]);

  useEffect(() => {
    const email = sessionQuery.data?.email?.trim();
    if (!email) return;
    void refreshShippingPreview(email);
  }, [refreshShippingPreview, sessionQuery.data?.email]);

  useEffect(() => {
    if (!savedProfile) return;
    setDeliveryForm((current) => {
      const hasUserInput = Boolean(
        current.contact.firstName.trim() ||
          current.contact.lastName.trim() ||
          current.contact.email.trim() ||
          current.address.address1.trim(),
      );
      if (hasUserInput) return current;
      return savedProfile;
    });
    setUsingSavedProfile(true);
  }, [savedProfile]);

  useEffect(() => {
    const user = sessionQuery.data;
    if (!user || accountPrefilled.current) return;
    accountPrefilled.current = true;
    setDeliveryForm((current) => ({
      ...current,
      contact: {
        ...current.contact,
        firstName: current.contact.firstName || user.firstName,
        lastName: current.contact.lastName || user.lastName,
        email: current.contact.email || user.email,
      },
    }));
  }, [sessionQuery.data]);

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

  if (
    step === "details" &&
    checkoutLines.length > 0 &&
    stockGuard.status === "checking"
  ) {
    return (
      <Container className="flex min-h-[50vh] flex-col items-center justify-center gap-4 py-24">
        <Spinner className="h-8 w-8" />
        <p className="text-sm text-ink/55">Vérification de la disponibilité…</p>
      </Container>
    );
  }

  if (
    step === "details" &&
    checkoutLines.length > 0 &&
    stockGuard.status === "invalid"
  ) {
    return (
      <Container className="py-12">
        <PageHeader title="Paiement" />
        <EmptyState
          title="Articles indisponibles"
          description={
            stockGuard.message ??
            "Certains articles ne sont plus en stock et ont été retirés de votre panier."
          }
          action={{ label: "Retour au panier", href: routes.cart }}
        />
      </Container>
    );
  }

  async function handleDetailsSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPaymentCanceled(false);

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

    const { contact, address } = normalizeDeliveryForm(deliveryForm);

    if (
      !contact.firstName ||
      !contact.lastName ||
      !contact.email ||
      !contact.phone ||
      !address.address1 ||
      !address.postcode ||
      !address.city
    ) {
      touchAllCheckoutFields();
      setFieldErrors(getCheckoutFieldErrors(contact, address));
      return;
    }

    touchAllCheckoutFields();
    const errors = getCheckoutFieldErrors(contact, address);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const emailOk = await validateCheckoutField("email", deliveryForm);
    const phoneOk = await validateCheckoutField("phone", deliveryForm);
    if (!emailOk || !phoneOk) {
      return;
    }

    const validationError = validateCheckoutContactForm(contact, address);
    if (validationError) {
      setError(validationError);
      return;
    }

    const profileToSave: CheckoutDeliveryProfile = {
      contact,
      address: {
        address1: address.address1,
        address2: address.address2,
        postcode: address.postcode,
        city: address.city,
        country: address.country,
      },
      updatedAt: new Date().toISOString(),
    };
    void saveProfile(profileToSave);

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
        message?: string | null;
        invalid?: { productId: string; variantId: string | null; message?: string }[];
      };
      if (!validateData.ok) {
        if (!useCartStore.getState().checkoutLocked) {
          for (const row of validateData.invalid ?? []) {
            removeLine(row.productId, row.variantId);
          }
        }
        setError(
          validateData.message ??
            validateData.invalid?.[0]?.message ??
            "Certains articles ne sont plus disponibles et ont été retirés du panier.",
        );
        return;
      }
    } catch {
      setError("Impossible de vérifier le stock. Réessayez.");
      return;
    }

    if (promoCode.trim() && promoError) {
      setError(promoError);
      return;
    }

    setPending(true);

    const apiLines = snapshot.map(mapLineForApi);
    const payload = {
      contact,
      address,
      lines: apiLines,
      promoCode: promoCode.trim() || undefined,
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
          promoCode: promoCode.trim() || undefined,
        });
        const bogoDisc = session.bogoDiscount ?? 0;
        const freeUnits = session.freeUnits ?? 0;
        setStripeBogoDiscount(bogoDisc);
        setStripeFreeUnits(freeUnits);
        if (session.shippingFee != null) {
          setShippingPreview({
            fee: session.shippingFee,
            label: session.shippingLabel ?? "",
          });
        }
        if (typeof session.promoDiscount === "number") {
          setPromoDiscount(session.promoDiscount);
        }
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
    clearCheckoutSession();
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
    <Container className="pb-12 pt-12 lg:pb-16 lg:pt-16">
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

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_380px] lg:gap-12">
        <div className="lg:hidden">
        <OrderSummary
          variant="mobile"
          lines={lines}
          freePerLine={freePerLine}
          bogoCartLines={bogoCartLines}
          subtotal={subtotal}
          orderTotal={orderTotal}
          welcomeBogoDiscount={bogoDiscount}
          stripeBogoDiscount={stripeBogoDiscount}
          stripeFreeUnits={stripeFreeUnits}
          shippingFee={shippingPreview?.fee}
          shippingLabel={shippingPreview?.label}
          promoDiscount={promoDiscount}
          promoCode={promoCode}
          onPromoCodeChange={handlePromoCodeChange}
          promoError={promoError}
          promoPending={promoPending}
        />
        </div>

        {step === "details" ? (
          <form
            ref={detailsFormRef}
            onSubmit={handleDetailsSubmit}
            className="space-y-8 pb-24 lg:pb-0"
          >
            <WelcomePromoGuestNudge
              totalUnits={lines.reduce((sum, line) => sum + line.quantity, 0)}
            />
            {hasProfile && savedProfile ? (
              <section className="rounded-2xl border border-ink/10 bg-paper-soft/60 p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">
                      Profil enregistré
                    </p>
                    <p className="mt-1 font-medium text-ink">
                      {savedProfile.contact.firstName} {savedProfile.contact.lastName}
                    </p>
                    <p className="text-sm text-ink/60">
                      {savedProfile.address.address1}, {savedProfile.address.postcode}{" "}
                      {savedProfile.address.city}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => {
                      setDeliveryForm(savedProfile);
                      setUsingSavedProfile(true);
                      void refreshShippingPreview(savedProfile.contact.email);
                    }}
                  >
                    {usingSavedProfile ? "Profil appliqué" : "Utiliser ce profil"}
                  </Button>
                </div>
              </section>
            ) : null}

            <section className="surface-card p-6 sm:p-8">
              <h2 className="section-title mb-5">Coordonnées</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Prénom"
                  name="firstName"
                  required
                  autoComplete="given-name"
                  value={deliveryForm.contact.firstName}
                  error={touchedFields.firstName ? fieldErrors.firstName : null}
                  onChange={(e) =>
                    updateDeliveryField("firstName", (f) => ({
                      ...f,
                      contact: { ...f.contact, firstName: e.target.value },
                    }))
                  }
                  onBlur={() => {
                    markFieldTouched("firstName");
                    void validateCheckoutField("firstName", deliveryForm);
                  }}
                />
                <Field
                  label="Nom"
                  name="lastName"
                  required
                  autoComplete="family-name"
                  value={deliveryForm.contact.lastName}
                  error={touchedFields.lastName ? fieldErrors.lastName : null}
                  onChange={(e) =>
                    updateDeliveryField("lastName", (f) => ({
                      ...f,
                      contact: { ...f.contact, lastName: e.target.value },
                    }))
                  }
                  onBlur={() => {
                    markFieldTouched("lastName");
                    void validateCheckoutField("lastName", deliveryForm);
                  }}
                />
                <Field
                  label="Email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="sm:col-span-2"
                  value={deliveryForm.contact.email}
                  error={touchedFields.email ? fieldErrors.email : null}
                  onChange={(e) =>
                    updateDeliveryField("email", (f) => ({
                      ...f,
                      contact: { ...f.contact, email: e.target.value },
                    }))
                  }
                  onBlur={async (e) => {
                    markFieldTouched("email");
                    const email = e.currentTarget.value.trim();
                    const ok = await validateCheckoutField("email", deliveryForm);
                    if (!ok || !email) return;
                    await refreshShippingPreview(email);
                    if (promoCode.trim()) {
                      await refreshPromoPreview(promoCode, email);
                    }
                  }}
                />
                <p className="sm:col-span-2 text-xs text-ink/45">
                  Les confirmations de commande seront envoyées à cette adresse
                  (pas forcément celle du compte).
                </p>
                <Field
                  label="Téléphone"
                  name="phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  className="sm:col-span-2"
                  value={deliveryForm.contact.phone ?? ""}
                  error={touchedFields.phone ? fieldErrors.phone : null}
                  onChange={(e) =>
                    updateDeliveryField("phone", (f) => ({
                      ...f,
                      contact: { ...f.contact, phone: e.target.value },
                    }))
                  }
                  onBlur={() => {
                    markFieldTouched("phone");
                    void validateCheckoutField("phone", deliveryForm);
                  }}
                />
              </div>
            </section>

            <section className="surface-card p-6 sm:p-8">
              <h2 className="section-title mb-5">Adresse de livraison</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Adresse"
                  name="address1"
                  required
                  autoComplete="address-line1"
                  className="sm:col-span-2"
                  value={deliveryForm.address.address1}
                  error={touchedFields.address1 ? fieldErrors.address1 : null}
                  onChange={(e) =>
                    updateDeliveryField("address1", (f) => ({
                      ...f,
                      address: { ...f.address, address1: e.target.value },
                    }))
                  }
                  onBlur={() => {
                    markFieldTouched("address1");
                    void validateCheckoutField("address1", deliveryForm);
                  }}
                />
                <Field
                  label="Complément"
                  name="address2"
                  autoComplete="address-line2"
                  className="sm:col-span-2"
                  value={deliveryForm.address.address2 ?? ""}
                  onChange={(e) =>
                    setDeliveryForm((f) => ({
                      ...f,
                      address: { ...f.address, address2: e.target.value },
                    }))
                  }
                />
                <Field
                  label="Code postal"
                  name="postcode"
                  required
                  autoComplete="postal-code"
                  value={deliveryForm.address.postcode}
                  error={touchedFields.postcode ? fieldErrors.postcode : null}
                  onChange={(e) =>
                    updateDeliveryField("postcode", (f) => ({
                      ...f,
                      address: { ...f.address, postcode: e.target.value },
                    }))
                  }
                  onBlur={() => {
                    markFieldTouched("postcode");
                    void validateCheckoutField("postcode", deliveryForm);
                  }}
                />
                <Field
                  label="Ville"
                  name="city"
                  required
                  autoComplete="address-level2"
                  value={deliveryForm.address.city}
                  error={touchedFields.city ? fieldErrors.city : null}
                  onChange={(e) =>
                    updateDeliveryField("city", (f) => ({
                      ...f,
                      address: { ...f.address, city: e.target.value },
                    }))
                  }
                  onBlur={() => {
                    markFieldTouched("city");
                    void validateCheckoutField("city", deliveryForm);
                  }}
                />
                <Field
                  label="Pays"
                  name="country"
                  required
                  autoComplete="country-name"
                  className="sm:col-span-2"
                  value={deliveryForm.address.country}
                  error={touchedFields.country ? fieldErrors.country : null}
                  onChange={(e) =>
                    updateDeliveryField("country", (f) => ({
                      ...f,
                      address: { ...f.address, country: e.target.value },
                    }))
                  }
                  onBlur={() => {
                    markFieldTouched("country");
                    void validateCheckoutField("country", deliveryForm);
                    if (touchedFields.phone || deliveryForm.contact.phone?.trim()) {
                      void validateCheckoutField("phone", deliveryForm);
                    }
                  }}
                />
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

            <CheckoutMobileStickyBar
              orderTotal={orderTotal}
              step={step}
              pending={pending}
              onContinue={() => detailsFormRef.current?.requestSubmit()}
            />

            <Button
              type="submit"
              size="lg"
              disabled={pending}
              className="hidden w-full bg-accent text-ink hover:bg-accent-dark hover:shadow-glow-sm sm:inline-flex lg:w-auto"
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
          <section
            ref={paymentSectionRef}
            className="surface-card scroll-mt-28 space-y-6 p-6 sm:p-8"
          >
            <div>
              <h2 className="section-title">Paiement sécurisé</h2>
              <p className="mt-2 text-sm text-ink/55">
                Apple Pay, Google Pay, PayPal, Link, Samsung Pay ou carte — traité par Stripe
                pour {publicConfig.siteName}.
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
          variant="sidebar"
          lines={lines}
          freePerLine={freePerLine}
          bogoCartLines={bogoCartLines}
          subtotal={subtotal}
          orderTotal={orderTotal}
          welcomeBogoDiscount={bogoDiscount}
          stripeBogoDiscount={stripeBogoDiscount}
          stripeFreeUnits={stripeFreeUnits}
          shippingFee={shippingPreview?.fee}
          shippingLabel={shippingPreview?.label}
          promoDiscount={promoDiscount}
          promoCode={promoCode}
          onPromoCodeChange={handlePromoCodeChange}
          promoError={promoError}
          promoPending={promoPending}
        />
      </div>
    </Container>
  );
}
