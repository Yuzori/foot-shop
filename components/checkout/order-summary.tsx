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
  /** `mobile` = récap compact en haut sur petit écran ; `sidebar` = panneau latéral desktop */
  variant?: "mobile" | "sidebar";
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
            />
          </li>
        );
      })}
    </ul>
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
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-ink/55">Sous-total</span>
        <span className="tabular-nums">{formatPrice(subtotal)}</span>
      </div>
      {bogoDiscount > 0 ? (
        <div className="flex justify-between text-accent">
          <span>Offre de bienvenue</span>
          <span className="tabular-nums">−{formatPrice(bogoDiscount)}</span>
        </div>
      ) : null}
      {promoDiscount > 0 ? (
        <div className="flex justify-between text-accent">
          <span>Code promo</span>
          <span className="tabular-nums">−{formatPrice(promoDiscount)}</span>
        </div>
      ) : null}
      <div className="flex justify-between">
        <span className="text-ink/55">Livraison</span>
        <span className="text-ink/55">
          {shippingFee != null
            ? shippingFee <= 0
              ? "Offerte"
              : formatPrice(shippingFee)
            : "Calculée au paiement"}
        </span>
      </div>
    </div>
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
  variant = "sidebar",
}: OrderSummaryProps) {
  const units = itemCount(lines);
  const bogoDiscount =
    stripeBogoDiscount > 0 ? stripeBogoDiscount : welcomeBogoDiscount;
  const shippingBadge = shippingLabel ?? shopConfig.freeShippingLabel;

  const promoField =
    onPromoCodeChange ? (
      <div className="pb-4">
        <Field
          label="Code promo"
          name="promoCode"
          value={promoCode}
          onChange={(e) => onPromoCodeChange(e.target.value.toUpperCase())}
          autoComplete="off"
          disabled={promoPending}
        />
        {promoError ? (
          <p className="mt-2 text-xs text-accent" role="alert">
            {promoError}
          </p>
        ) : null}
      </div>
    ) : null;

  if (variant === "mobile") {
    return (
      <aside className="rounded-2xl border border-ink/10 bg-paper p-4 shadow-soft">
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink/45">
            Votre commande
          </p>
          <p className="mt-1 text-xs text-ink/50">
            {units} article{units > 1 ? "s" : ""}
          </p>
        </div>

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
      className="hidden lg:block"
    >
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

/** Barre sticky mobile — total toujours visible en bas. */
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
        "fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-paper/95 p-4 backdrop-blur-md lg:hidden",
        "pb-[max(1rem,env(safe-area-inset-bottom))]",
      )}
    >
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="font-medium text-ink/60">Total</span>
        <span className="text-lg font-bold tabular-nums text-accent">
          {formatPrice(orderTotal)}
        </span>
      </div>
      <Button
        type="button"
        size="lg"
        disabled={pending}
        onClick={onContinue}
        className="w-full bg-accent text-ink hover:bg-accent-dark hover:shadow-glow-sm"
      >
        {pending ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner className="h-4 w-4 border-paper/30 border-t-paper" />
            Préparation…
          </span>
        ) : (
          `Continuer — ${formatPrice(orderTotal)}`
        )}
      </Button>
    </div>
  );
}
