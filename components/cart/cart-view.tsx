"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { OrderSummary, summarySubtotal } from "@/components/checkout/order-summary";
import { ProductImage } from "@/components/product/product-image";
import { CartLinePricing } from "@/components/cart/cart-line-pricing";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Spinner } from "@/components/ui/spinner";
import { routes } from "@/config/site";
import { useHydrated } from "@/hooks/use-hydrated";
import { useCartPersistHydrated } from "@/hooks/use-cart-persist-hydrated";
import { useCartBogo, cartLineUnitPrice } from "@/hooks/use-cart-bogo";
import { WelcomePromoGuestNudge } from "@/components/marketing/welcome-promo-guest-nudge";
import { useCartStockGuard } from "@/hooks/use-cart-stock-guard";
import { useScrollToTop } from "@/hooks/use-scroll-to-top";
import { formatPrice } from "@/lib/format";
import { readPersistedCartLines, useCartStore } from "@/store/cart-store";

export function CartView() {
  useScrollToTop();
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

  const summaryProps = {
    lines,
    freePerLine,
    bogoCartLines: bogoLines,
    subtotal,
    orderTotal: total,
    promoCode,
    onPromoCodeChange: handlePromoCodeChange,
    showEditCart: false as const,
    pinSummary: false as const,
  };

  return (
    <Container className="pb-28 pt-12 lg:pb-16 lg:pt-16">
      <PageHeader
        eyebrow="Commande"
        title="Panier"
        description={`${itemCount} article${itemCount > 1 ? "s" : ""} dans votre panier.`}
      />

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px] lg:items-start lg:gap-12">
        <ul className="surface-card h-fit divide-y divide-ink/5 self-start px-4 sm:px-6">
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

        <aside className="space-y-4">
          <WelcomePromoGuestNudge totalUnits={itemCount} />
          <div className="lg:hidden">
            <OrderSummary {...summaryProps} variant="mobile" />
          </div>
          <div className="hidden lg:block">
            <OrderSummary {...summaryProps} variant="sidebar" />
          </div>
          <Link
            href={routes.checkout}
            className={buttonClasses(
              "accent",
              "lg",
              "hidden w-full bg-accent text-ink hover:bg-accent-dark hover:shadow-glow-sm lg:inline-flex",
            )}
          >
            Passer au paiement — {formatPrice(total)}
          </Link>
          <Link
            href={routes.catalogue}
            className="hidden text-center text-sm text-ink/55 transition-colors hover:text-ink lg:block"
          >
            Continuer mes achats
          </Link>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-paper/95 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:hidden">
        <Container className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/45">
              Total
            </p>
            <p className="text-lg font-bold tabular-nums text-accent">
              {formatPrice(total)}
            </p>
          </div>
          <Link
            href={routes.checkout}
            className={buttonClasses(
              "accent",
              "lg",
              "shrink-0 bg-accent px-6 text-ink hover:bg-accent-dark",
            )}
          >
            Paiement
          </Link>
        </Container>
      </div>
    </Container>
  );
}
