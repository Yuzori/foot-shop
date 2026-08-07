"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { CloseIcon } from "@/components/layout/icons";
import { ProductImage } from "@/components/product/product-image";
import { buttonClasses } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { routes } from "@/config/site";
import { effectiveProductPrice } from "@/lib/product-price";
import type { Product } from "@/types/domain";

const SHOWN_KEY = "footshop_shown_new_ids_session";

function readShownIds(): string[] {
  try {
    const raw = sessionStorage.getItem(SHOWN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveShownIds(ids: string[]) {
  try {
    sessionStorage.setItem(SHOWN_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    /* ignore */
  }
}

async function fetchNewArrivals(): Promise<Product[]> {
  const res = await fetch("/api/marketing/new-arrivals", { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: Product[] };
  return Array.isArray(data.items) ? data.items : [];
}

async function dismissOnServer(productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;
  await fetch("/api/marketing/new-arrivals/dismiss", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productIds }),
  }).catch(() => {});
}

const SWIPE_MIN_PX = 48;

function useCarouselSwipe(
  enabled: boolean,
  onPrev: () => void,
  onNext: () => void,
) {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;
      const t = e.touches[0];
      if (!t) return;
      startRef.current = { x: t.clientX, y: t.clientY };
    },
    [enabled],
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !startRef.current) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startRef.current.x;
      const dy = t.clientY - startRef.current.y;
      startRef.current = null;
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      if (dx < 0) onNext();
      else onPrev();
    },
    [enabled, onNext, onPrev],
  );

  return { onTouchStart, onTouchEnd };
}

/**
 * Toast nouveautés — coin bas-droit, non bloquant.
 */
export function SiteModal() {
  const pathname = usePathname();
  const onProductPage = pathname.startsWith("/produit/");

  const { data: arrivals = [] } = useQuery({
    queryKey: ["marketing-new-arrivals"],
    queryFn: fetchNewArrivals,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    enabled: !onProductPage,
  });

  const [open, setOpen] = useState(false);
  const [newProducts, setNewProducts] = useState<Product[]>([]);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (onProductPage || !arrivals.length) return;
    const shown = readShownIds();
    const fresh = arrivals.filter((product) => !shown.includes(product.id));
    if (fresh.length === 0) return;
    setNewProducts(fresh);
    setOpen(true);
    setSlide(0);
  }, [arrivals, onProductPage]);

  const goPrev = useCallback(() => {
    setSlide((s) => (s - 1 + newProducts.length) % Math.max(newProducts.length, 1));
  }, [newProducts.length]);

  const goNext = useCallback(() => {
    setSlide((s) => (s + 1) % Math.max(newProducts.length, 1));
  }, [newProducts.length]);

  const swipe = useCarouselSwipe(newProducts.length > 1, goPrev, goNext);

  const dismiss = useCallback(() => {
    const ids = newProducts.map((product) => product.id);
    const shown = readShownIds();
    saveShownIds([...shown, ...ids]);
    void dismissOnServer(ids);
    setNewProducts([]);
    setOpen(false);
  }, [newProducts]);

  if (!open || onProductPage) return null;

  const currentNew = newProducts[slide];
  const hasMultiple = newProducts.length > 1;

  return (
    <AnimatePresence>
      {open && currentNew ? (
        <motion.aside
          key="site-modal"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          className="fixed bottom-4 right-4 z-[70] w-[min(calc(100vw-2rem),20rem)] overflow-hidden rounded-2xl border border-ink/10 bg-paper shadow-lift sm:bottom-6 sm:right-6"
          style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
          role="dialog"
          aria-modal="false"
          aria-label="Nouveautés"
        >
          <div className="h-1 w-full bg-accent" />

          <button
            type="button"
            onClick={dismiss}
            aria-label="Fermer"
            className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-paper-soft text-ink/50 transition-colors hover:bg-ink hover:text-paper"
          >
            <CloseIcon className="h-4 w-4" />
          </button>

          <div
            className="p-4 pt-5"
            onTouchStart={swipe.onTouchStart}
            onTouchEnd={swipe.onTouchEnd}
          >
            <p className="pr-8 text-[10px] font-bold uppercase tracking-widest text-accent">
              Nouveauté
            </p>
            <p className="mt-1 text-sm font-semibold leading-snug">
              {hasMultiple ? "Nouveaux maillots" : "Nouveau maillot"}
            </p>

            <div className="relative mt-3 aspect-square overflow-hidden rounded-xl bg-[#161616]">
              <ProductImage
                src={currentNew.cover?.url ?? null}
                alt={currentNew.name}
                sizes="320px"
                className="object-contain p-1.5"
              />
            </div>

            <h3 className="mt-3 line-clamp-2 text-sm font-medium leading-snug">
              {currentNew.name}
            </h3>
            <Price
              amount={effectiveProductPrice(currentNew)}
              compareAt={currentNew.compareAtPrice}
              currency={currentNew.currency}
              className="mt-2 text-base"
            />

            <Link
              href={routes.product(currentNew.id)}
              onClick={dismiss}
              className={buttonClasses("accent", "sm", "mt-3 w-full")}
            >
              Voir le produit
            </Link>

            {hasMultiple ? (
              <div className="mt-3 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={goPrev}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-soft text-sm hover:bg-ink hover:text-paper"
                  aria-label="Précédent"
                >
                  ‹
                </button>
                <span className="text-xs tabular-nums text-ink/50">
                  {slide + 1} / {newProducts.length}
                </span>
                <button
                  type="button"
                  onClick={goNext}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-soft text-sm hover:bg-ink hover:text-paper"
                  aria-label="Suivant"
                >
                  ›
                </button>
              </div>
            ) : null}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
