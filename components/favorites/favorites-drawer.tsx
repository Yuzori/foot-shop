"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

import { CloseIcon } from "@/components/layout/icons";
import { FavoriteButton } from "@/components/product/favorite-button";
import { ProductImage } from "@/components/product/product-image";
import { buttonClasses } from "@/components/ui/button";
import { routes } from "@/config/site";
import { useHydrated } from "@/hooks/use-hydrated";
import { useFavoriteProducts } from "@/hooks/use-favorite-products";
import { formatPrice } from "@/lib/format";
import { useFavoritesStore } from "@/store/favorites-store";
import { useUIStore } from "@/store/ui-store";

const EASE = [0.16, 1, 0.3, 1] as const;

export function FavoritesDrawer() {
  const hydrated = useHydrated();
  const pathname = usePathname();
  const open = useUIStore((s) => s.favoritesOpen);
  const close = useUIStore((s) => s.closeFavorites);
  const ids = useFavoritesStore((s) => s.ids);
  const { products, isLoading } = useFavoriteProducts({ enabled: open });

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

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
          aria-label="Favoris"
        >
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={close}
          />

          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.45, ease: EASE }}
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-paper shadow-lift"
          >
            <header className="flex items-center justify-between border-b border-ink/8 px-6 py-5">
              <h2 className="text-lg font-semibold tracking-tightest">
                Favoris{hydrated && ids.length > 0 ? ` (${ids.length})` : ""}
              </h2>
              <button
                onClick={close}
                aria-label="Fermer les favoris"
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink/60 transition-colors hover:bg-paper-soft hover:text-ink"
              >
                <CloseIcon />
              </button>
            </header>

            {!hydrated || ids.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <p className="text-base font-medium">Aucun favori</p>
                <p className="mt-2 text-sm text-ink/55">
                  Cliquez sur le cœur d&apos;un produit pour le retrouver ici.
                </p>
                <Link
                  href={routes.catalogue}
                  onClick={close}
                  className={buttonClasses("primary", "md", "mt-8")}
                >
                  Explorer la boutique
                </Link>
              </div>
            ) : isLoading ? (
              <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-ink/55">
                Chargement de vos favoris…
              </div>
            ) : (
              <ul className="flex-1 divide-y divide-ink/5 overflow-y-auto px-6">
                {products.map((product) => (
                  <li key={product.id} className="flex gap-4 py-5">
                    <Link
                      href={routes.product(product.id)}
                      onClick={close}
                      className="relative aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-xl bg-paper-soft"
                    >
                      <ProductImage
                        src={product.cover?.url ?? null}
                        alt={product.name}
                        sizes="80px"
                      />
                    </Link>
                    <div className="flex flex-1 flex-col">
                      <div className="flex justify-between gap-2">
                        <Link
                          href={routes.product(product.id)}
                          onClick={close}
                          className="text-sm font-medium leading-snug hover:text-accent"
                        >
                          {product.name}
                        </Link>
                        <FavoriteButton
                          productId={product.id}
                          className="!h-8 !w-8 shrink-0"
                        />
                      </div>
                      <p className="mt-2 text-sm font-medium tabular-nums">
                        {formatPrice(product.price, product.currency)}
                      </p>
                      <Link
                        href={routes.product(product.id)}
                        onClick={close}
                        className="mt-auto pt-3 text-xs font-semibold text-ink underline-offset-2 hover:underline"
                      >
                        Voir le produit
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
