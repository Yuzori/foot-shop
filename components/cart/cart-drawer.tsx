"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

import { CloseIcon } from "@/components/layout/icons";
import { CartLinePricing } from "@/components/cart/cart-line-pricing";
import { ProductImage } from "@/components/product/product-image";
import { buttonClasses } from "@/components/ui/button";
import { routes } from "@/config/site";
import { useHydrated } from "@/hooks/use-hydrated";
import { useCartBogo, cartLineUnitPrice } from "@/hooks/use-cart-bogo";
import { formatPrice } from "@/lib/format";
import { getFlocageDisplay } from "@/lib/flocage";
import { cartSelectors, useCartStore } from "@/store/cart-store";
import { useUIStore } from "@/store/ui-store";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Right-side slide-in cart. Mounted once globally; opened via the UI store. */
export function CartDrawer() {
  const hydrated = useHydrated();
  const pathname = usePathname();
  const open = useUIStore((s) => s.cartOpen);
  const close = useUIStore((s) => s.closeCart);

  const lines = useCartStore((s) => s.lines);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeLine = useCartStore((s) => s.removeLine);
  const subtotal = useCartStore(cartSelectors.subtotal);
  const count = useCartStore(cartSelectors.count);
  const { freePerLine, total } = useCartBogo();

  // Close whenever the route changes (e.g. after clicking a product link).
  useEffect(() => {
    close();
  }, [pathname, close]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70]"
          aria-modal
          role="dialog"
          aria-label="Panier"
        >
          <div
            className="absolute inset-0 bg-ink/30 backdrop-blur-xl"
            onClick={close}
          />

          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.45, ease: EASE }}
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-paper shadow-panel drawer-safe-top drawer-safe-bottom"
          >
            <header className="flex items-center justify-between border-b border-ink/8 px-5 py-4 sm:px-6 sm:py-5">
              <h2 className="text-lg font-semibold tracking-tightest">
                Panier{hydrated && count > 0 ? ` (${count})` : ""}
              </h2>
              <button
                onClick={close}
                aria-label="Fermer le panier"
                className="overlay-close text-ink/60 transition-colors hover:bg-paper-soft hover:text-ink"
              >
                <CloseIcon />
              </button>
            </header>

            {!hydrated ? (
              <div className="flex-1" />
            ) : lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <p className="text-base font-medium">Votre panier est vide</p>
                <p className="mt-2 text-sm text-ink/55">
                  Parcourez la boutique et ajoutez vos maillots préférés.
                </p>
                <Link
                  href={routes.catalogue}
                  onClick={close}
                  className={buttonClasses("primary", "md", "mt-8")}
                >
                  Découvrir la boutique
                </Link>
              </div>
            ) : (
              <>
                <ul className="flex-1 divide-y divide-ink/5 overflow-y-auto px-6">
                  <AnimatePresence initial={false}>
                    {lines.map((line, index) => (
                      <motion.li
                        key={`${line.productId}-${line.variantId ?? "base"}`}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex gap-4 py-5"
                      >
                        <Link
                          href={routes.product(line.productId)}
                          onClick={close}
                          className="relative aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-xl bg-paper-soft"
                        >
                          <ProductImage
                            src={line.image}
                            alt={line.name}
                            sizes="80px"
                          />
                        </Link>

                        <div className="flex flex-1 flex-col">
                          <div className="flex justify-between gap-2">
                            <Link
                              href={routes.product(line.productId)}
                              onClick={close}
                              className="text-sm font-medium leading-snug"
                            >
                              {line.name}
                            </Link>
                            <CartLinePricing
                              unitPrice={cartLineUnitPrice(line)}
                              quantity={line.quantity}
                              freeQuantity={freePerLine[index] ?? 0}
                            />
                          </div>
                          {line.optionsLabel ? (
                            <p className="mt-1 text-xs text-ink/50">
                              {line.optionsLabel}
                            </p>
                          ) : null}
                          {line.flocage?.enabled ? (
                            <p className="mt-1 text-xs font-medium text-accent">
                              Flocage: {getFlocageDisplay(line.flocage)}
                            </p>
                          ) : null}

                          <div className="mt-auto flex items-center justify-between pt-3">
                            <div className="flex h-9 items-center rounded-full border border-ink/15">
                              <button
                                onClick={() =>
                                  setQuantity(
                                    line.productId,
                                    line.variantId,
                                    line.quantity - 1,
                                  )
                                }
                                className="flex h-full w-9 items-center justify-center"
                                aria-label="Diminuer"
                              >
                                −
                              </button>
                              <span className="w-7 text-center text-sm tabular-nums">
                                {line.quantity}
                              </span>
                              <button
                                onClick={() =>
                                  setQuantity(
                                    line.productId,
                                    line.variantId,
                                    line.quantity + 1,
                                  )
                                }
                                className="flex h-full w-9 items-center justify-center"
                                aria-label="Augmenter"
                              >
                                +
                              </button>
                            </div>
                            <button
                              onClick={() =>
                                removeLine(line.productId, line.variantId)
                              }
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

                <footer className="border-t border-ink/8 px-6 py-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-ink/55">Sous-total</span>
                    <span className="font-medium tabular-nums">
                      {formatPrice(subtotal)}
                    </span>
                  </div>
                  {total < subtotal ? (
                    <div className="mt-1 flex justify-between text-sm text-accent">
                      <span>Offre de bienvenue</span>
                      <span className="tabular-nums">
                        −{formatPrice(subtotal - total)}
                      </span>
                    </div>
                  ) : null}
                  <div className="mt-2 flex justify-between text-sm font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">{formatPrice(total)}</span>
                  </div>
                  <p className="mt-1 text-xs text-ink/45">
                    Livraison calculée au paiement.
                  </p>
                  <Link
                    href={routes.checkout}
                    onClick={close}
                    className={buttonClasses("accent", "lg", "mt-5 w-full")}
                  >
                    Passer au paiement
                  </Link>
                  <Link
                    href={routes.cart}
                    onClick={close}
                    className="mt-3 block text-center text-sm text-ink/55 hover:text-ink"
                  >
                    Voir le panier
                  </Link>
                </footer>
              </>
            )}
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
