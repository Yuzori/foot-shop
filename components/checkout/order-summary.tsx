"use client";

import Link from "next/link";

import { CartLinePricing } from "@/components/cart/cart-line-pricing";
import { WelcomePromoCheckoutBanner } from "@/components/checkout/welcome-promo-banner";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { SummaryCard } from "@/components/ui/summary-card";
import { routes } from "@/config/site";
import { shopConfig } from "@/config/shop";
import { cartLineUnitPrice } from "@/hooks/use-cart-bogo";
import { getFlocageDisplay } from "@/lib/flocage";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BogoLine } from "@/lib/welcome-bogo";
import type { CartLine } from "@/types/domain";

export type CheckoutShippingAddress = {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  postcode: string;
  city: string;
  country: string;
};

interface OrderSummaryProps {
  lines: CartLine[];
  freePerLine: number[];
  bogoCartLines: BogoLine[];
  subtotal: number;
  orderTotal: number;
  welcomeBogoDiscount?: number;
  stripeBogoDiscount?: number;
  stripeFreeUnits?: number;
  shippingFee?: number;
  shippingLabel?: string;
  promoDiscount?: number;
  promoCode?: string;
  onPromoCodeChange?: (code: string) => void;
  promoError?: string | null;
  promoPending?: boolean;
  showEditCart?: boolean;
  orderReference?: string | null;
  shippingAddress?: CheckoutShippingAddress | null;
  /** Coller le récap seul au scroll - false si le parent englobe récap + boutons. */
  pinSummary?: boolean;
  /** `mobile` = récap compact en haut sur petit écran ; `sidebar` = panneau latéral desktop */
  variant?: "mobile" | "sidebar";
  welcomePromoEligible?: boolean;
}

function itemCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

function LineItems({
  lines,
  freePerLine,
}: {
  lines: CartLine[];
  freePerLine: number[];
}) {
  return (
    <ul className="space-y-4">
      {lines.map((line, index) => {
        const unitPrice = cartLineUnitPrice(line);
        return (
          <li
            key={`${line.productId}-${line.variantId ?? "base"}`}
            className="flex justify-between gap-4 text-sm"
          >
            <span className="min-w-0 text-ink/70">
              <span className="line-clamp-2 font-medium text-ink">{line.name}</span>
              {line.optionsLabel ? (
                <span className="mt-0.5 block text-xs text-ink/45">
                  {line.optionsLabel}
                </span>
              ) : null}
              {line.flocage?.enabled ? (
                <span className="mt-0.5 block text-xs text-accent">
                  Flocage: {getFlocageDisplay(line.flocage)}
                </span>
              ) : null}
              <span className="text-ink/40"> × {line.quantity}</span>
            </span>
            <CartLinePricing
              unitPrice={unitPrice}
              quantity={line.quantity}
              freeQuantity={freePerLine[index] ?? 0}
              flocageUnitPrice={
                line.flocage?.enabled ? line.flocage.price : 0
              }
            />
          </li>
        );
      })}
    </ul>
  );
}

function ShippingAddressBlock({
  address,
}: {
  address: CheckoutShippingAddress;
}) {
  return (
    <div className="mb-4 rounded-xl border border-ink/10 bg-paper-soft/50 px-3 py-2.5 text-sm">
      <p className="text-[10px] font-bold uppercase tracking-widest text-ink/45">
        Livraison
      </p>
      <p className="mt-1 font-medium text-ink">
        {address.firstName} {address.lastName}
      </p>
      <p className="text-ink/60">
        {address.address1}
        {address.address2 ? `, ${address.address2}` : ""}
      </p>
      <p className="text-ink/60">
        {address.postcode} {address.city}, {address.country}
      </p>
    </div>
  );
}

function TotalsBreakdown({
  subtotal,
  bogoDiscount,
  promoDiscount,
  shippingFee,
}: {
  subtotal: number;
  bogoDiscount: number;
  promoDiscount: number;
  shippingFee?: number;
}) {
  return (
    <>
      <div className="flex justify-between text-sm">
        <span className="text-ink/55">Sous-total</span>
        <span className="tabular-nums">{formatPrice(subtotal)}</span>
      </div>
      {bogoDiscount > 0 ? (
        <div className="flex justify-between text-sm text-accent">
          <span>Offre 2+1</span>
          <span className="tabular-nums">−{formatPrice(bogoDiscount)}</span>
        </div>
      ) : null}
      {promoDiscount > 0 ? (
        <div className="flex justify-between text-sm text-accent">
          <span>Code promo</span>
          <span className="tabular-nums">−{formatPrice(promoDiscount)}</span>
        </div>
      ) : null}
      <div className="flex justify-between text-sm">
        <span className="text-ink/55">Livraison</span>
        <span className="tabular-nums">
          {shippingFee != null && shippingFee > 0
            ? formatPrice(shippingFee)
            : shippingFee === 0
              ? "Offerte"
              : "Calculée au paiement"}
        </span>
      </div>
    </>
  );
}

/** Récapitulatif commande partagé panier / checkout. */
export function OrderSummary({
  lines,
  freePerLine,
  bogoCartLines,
  subtotal,
  orderTotal,
  welcomeBogoDiscount = 0,
  stripeBogoDiscount = 0,
  stripeFreeUnits = 0,
  shippingFee,
  shippingLabel,
  promoDiscount = 0,
  promoCode = "",
  onPromoCodeChange,
  promoError,
  promoPending = false,
  showEditCart = true,
  orderReference = null,
  shippingAddress = null,
  pinSummary = true,
  variant = "sidebar",
  welcomePromoEligible = false,
}: OrderSummaryProps) {
  const units = itemCount(lines);
  const bogoDiscount =
    stripeBogoDiscount > 0 ? stripeBogoDiscount : welcomeBogoDiscount;
  const shippingBadge = shippingLabel ?? shopConfig.freeShippingLabel;

  const referenceBlock = orderReference ? (
    <div className="mb-4 rounded-xl border border-accent/20 bg-accent/5 px-3 py-2.5 text-sm">
      <p className="text-[10px] font-bold uppercase tracking-widest text-accent/80">
        Numéro de commande
      </p>
      <p className="mt-1 font-display text-lg font-semibold tracking-wide text-ink">
        {orderReference}
      </p>
      <p className="mt-1 text-xs text-ink/50">
        Conservez ce numéro pour le suivi de votre commande.
      </p>
    </div>
  ) : null;

  const addressBlock = shippingAddress ? (
    <ShippingAddressBlock address={shippingAddress} />
  ) : null;

  const promoField =
    onPromoCodeChange ? (
      <div className="pb-4">
        <Field
          label="Code promo"
          name="promoCode"
          value={promoCode}
          onChange={(e) => onPromoCodeChange(e.target.value)}
          placeholder="Ex. FOOTSHOP10"
          autoComplete="off"
        />
        {promoPending ? (
          <p className="mt-1 text-xs text-ink/45">Vérification…</p>
        ) : promoError ? (
          <p className="mt-1 text-xs text-accent">{promoError}</p>
        ) : null}
      </div>
    ) : null;

  if (variant === "mobile") {
    return (
      <aside className="mb-6 rounded-2xl border border-ink/10 bg-paper p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-ink/45">
              Votre commande
            </p>
            <p className="mt-1 text-xs text-ink/50">
              {units} article{units > 1 ? "s" : ""}
            </p>
          </div>
          <p className="text-lg font-bold tabular-nums text-accent">
            {formatPrice(orderTotal)}
          </p>
        </div>

        {referenceBlock}
        {addressBlock}

        <LineItems lines={lines} freePerLine={freePerLine} />

        <div className="mt-4 space-y-4 border-t border-ink/8 pt-4">
          {promoField}
          <TotalsBreakdown
            subtotal={subtotal}
            bogoDiscount={bogoDiscount}
            promoDiscount={promoDiscount}
            shippingFee={shippingFee}
          />
          <WelcomePromoCheckoutBanner
            subtotal={subtotal}
            lines={bogoCartLines}
            appliedBogoDiscount={stripeBogoDiscount}
            appliedFreeUnits={stripeFreeUnits}
            promoEligible={welcomePromoEligible}
          />
        </div>

        <div className="mt-4 rounded-xl bg-sky-50 px-3 py-2 text-center text-[11px] font-semibold leading-snug text-sky-900">
          {shippingBadge}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-ink/10 pt-4">
          <span className="text-sm font-medium text-ink/60">Total à payer</span>
          <span className="text-xl font-bold tabular-nums text-accent">
            {formatPrice(orderTotal)}
          </span>
        </div>

        {showEditCart ? (
          <Link
            href={routes.cart}
            className="mt-3 block text-center text-sm text-ink/55 transition-colors hover:text-ink"
          >
            Modifier le panier
          </Link>
        ) : null}
      </aside>
    );
  }

  return (
    <SummaryCard
      badge={
        <p className="rounded-xl bg-sky-50 px-3 py-2 text-center text-xs font-semibold text-sky-900">
          {shippingBadge}
        </p>
      }
      title="Votre commande"
      sticky={pinSummary}
      className="hidden lg:block"
    >
      {referenceBlock}
      {addressBlock}
      <div className="mt-6">
        <LineItems lines={lines} freePerLine={freePerLine} />
      </div>

      <div className="mt-6 space-y-2 border-t border-ink/8 pt-6">
        {promoField}
        <TotalsBreakdown
          subtotal={subtotal}
          bogoDiscount={bogoDiscount}
          promoDiscount={promoDiscount}
          shippingFee={shippingFee}
        />
      </div>

      <div className="mt-4">
        <WelcomePromoCheckoutBanner
          subtotal={subtotal}
          lines={bogoCartLines}
          appliedBogoDiscount={stripeBogoDiscount}
          appliedFreeUnits={stripeFreeUnits}
          promoEligible={welcomePromoEligible}
        />
      </div>

      <div className="mt-6 flex justify-between border-t border-ink/10 pt-6 text-base font-bold">
        <span>Total</span>
        <span className="tabular-nums text-accent">{formatPrice(orderTotal)}</span>
      </div>

      {showEditCart ? (
        <Link
          href={routes.cart}
          className="mt-4 block text-center text-sm text-ink/55 transition-colors hover:text-ink"
        >
          Modifier le panier
        </Link>
      ) : null}
    </SummaryCard>
  );
}

/** Sous-total calculé depuis des lignes figées (checkout en cours). */
export function summarySubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => {
    const flocageUnit = line.flocage?.enabled ? line.flocage.price : 0;
    return sum + (line.unitPrice + flocageUnit) * line.quantity;
  }, 0);
}

/** Barre mobile fixe en bas pendant le formulaire (sans bascule dock/fixed). */
export function CheckoutMobileStickyBar({
  orderTotal,
  step,
  pending,
  onContinue,
}: {
  orderTotal: number;
  step: "details" | "payment";
  pending?: boolean;
  onContinue?: () => void;
}) {
  if (step !== "details") return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-paper/95 backdrop-blur-md lg:hidden",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3",
      )}
    >
      <div className="mx-auto w-full max-w-8xl px-4 sm:px-8">
        <Button
          type="button"
          size="lg"
          disabled={pending}
          onClick={onContinue}
          className="w-full bg-accent text-center text-ink hover:bg-accent-dark hover:shadow-glow-sm"
        >
          {pending ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner className="h-4 w-4 border-paper/30 border-t-paper" />
              Préparation…
            </span>
          ) : (
            `Continuer - ${formatPrice(orderTotal)}`
          )}
        </Button>
      </div>
    </div>
  );
}
