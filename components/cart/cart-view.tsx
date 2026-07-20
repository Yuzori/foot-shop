"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { OrderSummary, summarySubtotal } from "@/components/checkout/order-summary";
import { ProductImage } from "@/components/product/product-image";
import { CartLinePricing } from "@/components/cart/cart-line-pricing";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Spinner } from "@/components/ui/spinner";
import { routes } from "@/config/site";
import { useHydrated } from "@/hooks/use-hydrated";
import { useCartPersistHydrated } from "@/hooks/use-cart-persist-hydrated";
import { useCartBogo, cartLineUnitPrice } from "@/hooks/use-cart-bogo";
import { useCartStockGuard } from "@/hooks/use-cart-stock-guard";
import { formatPrice } from "@/lib/format";
import { readPersistedCartLines, useCartStore } from "@/store/cart-store";

export function CartView() {
  const hydrated = useHydrated();
  const cartReady = useCartPersistHydrated();
  useCartStockGuard({ enabled: hydrated && cartReady });
  const storeLines = useCartStore((s) => s.lines);
  const recoveredRef = useRef(false);
  const lines =
    storeLines.length > 0 ? storeLines : readPersistedCartLines();

  useEffect(() => {
    if (!cartReady || recoveredRef.current || storeLines.length > 0) return;
    const backup = readPersistedCartLines();
    if (backup.length === 0) return;
    recoveredRef.current = true;
    useCartStore.setState({ lines: backup });
  }, [cartReady, storeLines.length]);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeLine = useCartStore((s) => s.removeLine);
  const { freePerLine, total, bogoLines } = useCartBogo();
  const subtotal = summarySubtotal(lines);
  const [promoCode, setPromoCode] = useState("");

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("footshop-promo-code");
      if (saved) setPromoCode(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const handlePromoCodeChange = (code: string) => {
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
  };

  if (!hydrated && lines.length === 0) {
    return (
      <Container className="flex min-h-[40vh] items-center justify-center py-24">
        <Spinner className="h-8 w-8" />
      </Container>
    );
  }

  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);

  if (lines.length === 0) {
    return (
      <Container className="py-12">
        <PageHeader title="Panier" />
        <EmptyState
          title="Votre panier est vide"
          description="Parcourez la boutique et ajoutez vos maillots préférés."
          action={{ label: "Découvrir la boutique", href: routes.catalogue }}
        />
      </Container>
    );
  }

  return (
    <Container className="py-12 lg:py-16">
      <PageHeader
        eyebrow="Commande"
        title="Panier"
        description={`${itemCount} article${itemCount > 1 ? "s" : ""} dans votre panier.`}
      />

      <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-12">
        <ul className="surface-card divide-y divide-ink/5 px-4 sm:px-6">
          <AnimatePresence initial={false}>
            {lines.map((line, index) => (
              <motion.li
                key={`${line.productId}-${line.variantId ?? "base"}`}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0 }}
                className="flex gap-4 py-6"
              >
                <Link
                  href={routes.product(line.productId)}
                  className="relative aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-xl bg-paper-soft"
                >
                  <ProductImage src={line.image} alt={line.name} sizes="96px" />
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        href={routes.product(line.productId)}
                        className="line-clamp-2 font-medium hover:text-accent"
                      >
                        {line.name}
                      </Link>
                      {line.optionsLabel ? (
                        <p className="mt-1 text-xs text-ink/50">
                          {line.optionsLabel}
                        </p>
                      ) : null}
                    </div>
                    <CartLinePricing
                      unitPrice={cartLineUnitPrice(line)}
                      quantity={line.quantity}
                      freeQuantity={freePerLine[index] ?? 0}
                    />
                  </div>

                  <div className="mt-auto flex items-center justify-between pt-4">
                    <div className="flex h-10 items-center rounded-full border border-ink/12 bg-paper">
                      <button
                        type="button"
                        onClick={() =>
                          setQuantity(
                            line.productId,
                            line.variantId,
                            line.quantity - 1,
                          )
                        }
                        className="flex h-full w-10 items-center justify-center text-ink/60 hover:text-ink"
                        aria-label="Diminuer"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm tabular-nums">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setQuantity(
                            line.productId,
                            line.variantId,
                            line.quantity + 1,
                          )
                        }
                        className="flex h-full w-10 items-center justify-center text-ink/60 hover:text-ink"
                        aria-label="Augmenter"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(line.productId, line.variantId)}
                      className="text-xs text-ink/50 underline-offset-2 hover:text-accent hover:underline"
                    >
                      Retirer
                    </button>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <div className="space-y-4">
          <OrderSummary
            lines={lines}
            freePerLine={freePerLine}
            bogoCartLines={bogoLines}
            subtotal={subtotal}
            orderTotal={total}
            promoCode={promoCode}
            onPromoCodeChange={handlePromoCodeChange}
            showEditCart={false}
          />
          <Link
            href={routes.checkout}
            className="flex h-14 w-full items-center justify-center rounded-full bg-accent text-sm font-semibold text-ink transition-colors hover:bg-accent-dark hover:shadow-glow-sm"
          >
            Passer au paiement — {formatPrice(total)}
          </Link>
          <Link
            href={routes.catalogue}
            className="block text-center text-sm text-ink/55 transition-colors hover:text-ink"
          >
            Continuer mes achats
          </Link>
        </div>
      </div>
    </Container>
  );
}
