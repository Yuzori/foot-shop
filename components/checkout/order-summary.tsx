"use client";

import Link from "next/link";

import { CartLinePricing } from "@/components/cart/cart-line-pricing";
import { WelcomePromoCheckoutBanner } from "@/components/checkout/welcome-promo-banner";
import { SummaryCard } from "@/components/ui/summary-card";
import { routes } from "@/config/site";
import { shopConfig } from "@/config/shop";
import { cartLineUnitPrice } from "@/hooks/use-cart-bogo";
import { getFlocageDisplay } from "@/lib/flocage";
import { formatPrice } from "@/lib/format";
import type { BogoLine } from "@/lib/welcome-bogo";
import type { CartLine } from "@/types/domain";

interface OrderSummaryProps {
  lines: CartLine[];
  freePerLine: number[];
  bogoCartLines: BogoLine[];
  subtotal: number;
  orderTotal: number;
  stripeBogoDiscount?: number;
  stripeFreeUnits?: number;
  showEditCart?: boolean;
}

/** Récapitulatif commande partagé panier / checkout. */
export function OrderSummary({
  lines,
  freePerLine,
  bogoCartLines,
  subtotal,
  orderTotal,
  stripeBogoDiscount = 0,
  stripeFreeUnits = 0,
  showEditCart = true,
}: OrderSummaryProps) {
  const bogoDiscount = subtotal - orderTotal;

  return (
    <SummaryCard
      badge={
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-center text-xs font-semibold text-emerald-800">
          {shopConfig.freeShippingLabel}
        </p>
      }
      title="Votre commande"
    >
      <ul className="mt-6 space-y-4">
        {lines.map((line, index) => {
          const unitPrice = cartLineUnitPrice(line);
          return (
            <li
              key={`${line.productId}-${line.variantId ?? "base"}`}
              className="flex justify-between gap-4 text-sm"
            >
              <span className="min-w-0 text-ink/70">
                <span className="line-clamp-2 font-medium text-ink">
                  {line.name}
                </span>
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

      <div className="mt-6 space-y-2 border-t border-ink/8 pt-6 text-sm">
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
        <div className="flex justify-between">
          <span className="text-ink/55">Livraison</span>
          <span className="text-ink/55">Gratuite</span>
        </div>
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
