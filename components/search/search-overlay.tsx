"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { CloseIcon, SearchIcon } from "@/components/layout/icons";
import { ProductImage } from "@/components/product/product-image";
import { Price } from "@/components/ui/price";
import { routes } from "@/config/site";
import { useDebounce } from "@/hooks/use-debounce";
import { useSearch } from "@/hooks/use-search";
import { overlayMotion, searchPanelMotion } from "@/lib/motion";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useUIStore } from "@/store/ui-store";

/**
 * Full-screen search overlay. Opens in place (blurred backdrop) instead of
 * navigating away. Live, debounced results from the back office.
 */
export function SearchOverlay() {
  const open = useUIStore((s) => s.searchOpen);
  const close = useUIStore((s) => s.closeSearch);
  const pathname = usePathname();

  const [term, setTerm] = useState("");
  const debounced = useDebounce(term, 300);
  const { data, isLoading, isError } = useSearch(open ? debounced : "");

  useEffect(() => {
    close();
  }, [pathname, close]);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) {
      const t = window.setTimeout(() => setTerm(""), 250);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const results = data ?? [];
  const hasQuery = debounced.trim().length >= 2;
  const showEmpty = hasQuery && !isLoading && results.length === 0;
  const showResults = hasQuery && !isLoading && results.length > 0;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          {...overlayMotion}
          className="fixed inset-0 z-[80]"
          role="dialog"
          aria-modal
          aria-label="Recherche"
        >
          <div
            className="absolute inset-0 bg-ink/25 backdrop-blur-md"
            onClick={close}
          />

          <motion.div
            {...searchPanelMotion}
            className="absolute inset-x-0 top-0 mx-auto max-h-full w-full max-w-3xl overflow-y-auto overscroll-contain px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-5 sm:pt-12"
            style={{ maxHeight: "100dvh" }}
          >
            <div className="overflow-hidden rounded-3xl border border-white/20 bg-paper shadow-panel">
              <div className="relative border-b border-accent/45 bg-accent/40">
                <SearchIcon className="pointer-events-none absolute left-5 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-white/90" />
                <input
                  autoFocus
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Rechercher un maillot, un club, une équipe…"
                  className="h-16 w-full bg-transparent pl-14 pr-16 text-base text-white outline-none placeholder:text-white/75"
                  aria-label="Rechercher un produit"
                />
                <button
                  onClick={close}
                  aria-label="Fermer la recherche"
                  className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white/75 transition-colors hover:bg-white/15 hover:text-white"
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="bg-paper px-4 py-5 sm:px-5 sm:py-6">
                {!hasQuery ? (
                  <div
                    role="status"
                    className="rounded-full border border-accent/20 bg-accent-muted/40 px-5 py-3.5 text-center text-sm text-ink/55"
                  >
                    Saisissez au moins 2 caractères pour lancer la recherche.
                  </div>
                ) : isLoading ? (
                  <p className="text-sm text-ink/40">Recherche en cours…</p>
                ) : showEmpty ? (
                  <div
                    role="status"
                    className="rounded-full border border-ink/[0.08] bg-paper-soft px-5 py-3.5 text-center text-sm text-ink/55"
                  >
                    {isError
                      ? "La connexion au back office a échoué."
                      : `Aucun résultat pour « ${debounced} ».`}
                  </div>
                ) : showResults ? (
                  <ul className="divide-y divide-ink/[0.05]">
                    {results.map((product) => (
                      <li key={product.id}>
                        <Link
                          href={routes.product(product.id)}
                          onClick={close}
                          className="group flex items-center gap-4 py-3 transition-colors hover:bg-accent-muted/40"
                        >
                          <div className="relative aspect-square w-14 shrink-0 overflow-hidden rounded-xl bg-paper-soft ring-1 ring-ink/[0.05]">
                            <ProductImage
                              src={product.cover?.url ?? null}
                              alt={product.cover?.alt ?? product.name}
                              sizes="56px"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium group-hover:text-accent-dark">
                              {product.name}
                            </p>
                          </div>
                          <Price
                            amount={product.price}
                            currency={product.currency}
                            showDiscount={false}
                            className="shrink-0 text-sm"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
