"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { CloseIcon, SearchIcon } from "@/components/layout/icons";
import { ProductImage } from "@/components/product/product-image";
import { Price } from "@/components/ui/price";
import { routes } from "@/config/site";
import { useDebounce } from "@/hooks/use-debounce";
import { useSearch } from "@/hooks/use-search";
import { overlayMotion, searchPanelMotion } from "@/lib/motion";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui-store";

const searchBubbleShell =
  "relative w-full overflow-hidden border border-ink/[0.08] bg-paper shadow-panel";

/** Même rayon que le h-16 du champ (demi-hauteur = 2rem). */
const searchBubbleCap = "rounded-[2rem]";

/**
 * Recherche plein écran — deux bulles distinctes : champ de saisie + panneau résultats.
 */
export function SearchOverlay() {
  const open = useUIStore((s) => s.searchOpen);
  const close = useUIStore((s) => s.closeSearch);
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [scrollLocked, setScrollLocked] = useState(false);

  const [term, setTerm] = useState("");
  const debounced = useDebounce(term, 300);
  const { data, isLoading, isError } = useSearch(open ? debounced : "");

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (open) {
      setScrollLocked(true);
    }
  }, [open]);

  useBodyScrollLock(scrollLocked);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) {
      const t = window.setTimeout(() => setTerm(""), 250);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const handleExitComplete = () => {
    if (!useUIStore.getState().searchOpen) {
      setScrollLocked(false);
    }
  };

  const results = data ?? [];
  const hasQuery = debounced.trim().length >= 2;
  const showEmpty = hasQuery && !isLoading && results.length === 0;
  const showResults = hasQuery && !isLoading && results.length > 0;

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {open ? (
        <motion.div
          {...overlayMotion}
          className="fixed inset-0 z-[80]"
          role="dialog"
          aria-modal
          aria-label="Recherche"
        >
          <div
            className="absolute inset-0 touch-none bg-ink/25 backdrop-blur-md"
            onClick={close}
          />

          <motion.div
            {...searchPanelMotion}
            className="absolute inset-x-0 top-0 mx-auto w-full max-w-3xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-5 sm:pt-12"
          >
            {/* Bulle 1 — champ de recherche */}
            <div className={cn(searchBubbleShell, "rounded-full")}>
              <SearchIcon className="pointer-events-none absolute left-5 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-accent-dark" />
              <input
                ref={inputRef}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Rechercher un maillot, un club, une équipe…"
                className="h-16 w-full bg-transparent pl-14 pr-16 text-base text-ink outline-none placeholder:text-ink/35"
                aria-label="Rechercher un produit"
                enterKeyHint="search"
                inputMode="search"
              />
              <button
                type="button"
                onClick={close}
                aria-label="Fermer la recherche"
                className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-ink/50 transition-colors hover:bg-accent-muted hover:text-ink"
              >
                <CloseIcon />
              </button>
            </div>

            {/* Bulle 2 — même forme, texte ou résultats */}
            <div
              className={cn(
                searchBubbleShell,
                "mt-3",
                showResults
                  ? cn(
                      searchBubbleCap,
                      "max-h-[min(70dvh,28rem)] overflow-y-auto overscroll-contain px-2 py-2",
                    )
                  : "flex min-h-16 items-center justify-center rounded-full px-6",
              )}
            >
              {!hasQuery ? (
                <p role="status" className="text-center text-sm text-ink/55">
                  Saisissez au moins 2 caractères pour lancer la recherche.
                </p>
              ) : isLoading ? (
                <p className="text-center text-sm text-ink/40">
                  Recherche en cours…
                </p>
              ) : showEmpty ? (
                <p role="status" className="text-center text-sm text-ink/55">
                  {isError
                    ? "La connexion au back office a échoué."
                    : `Aucun résultat pour « ${debounced} ».`}
                </p>
              ) : showResults ? (
                <ul className="w-full divide-y divide-ink/[0.05]">
                  {results.map((product) => (
                    <li key={product.id}>
                      <Link
                        href={routes.product(product.id)}
                        onClick={close}
                        className="group flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors hover:bg-accent-muted/50"
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
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
