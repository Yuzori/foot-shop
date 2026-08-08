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
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { effectiveProductPrice } from "@/lib/product-price";
import { overlayMotion } from "@/lib/motion";
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

/** Modale nouveautés — centrée, fond flouté. */
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

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open || onProductPage) return null;

  const currentNew = newProducts[slide];
  const hasMultiple = newProducts.length > 1;

  return (
    <AnimatePresence>
      {open && currentNew ? (
        <motion.div
          key="site-modal-overlay"
          {...overlayMotion}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Nouveautés"
        >
          <button
            type="button"
            className="absolute inset-0 bg-ink/40 backdrop-blur-md"
            onClick={dismiss}
            aria-label="Fermer"
          />

          <motion.aside
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="relative z-10 flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-ink/10 bg-paper shadow-lift"
            onTouchStart={swipe.onTouchStart}
            onTouchEnd={swipe.onTouchEnd}
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

            <div className="p-5 pt-6">
              <p className="pr-8 text-[10px] font-bold uppercase tracking-widest text-accent">
                Nouveauté
              </p>
              <p className="mt-1 text-sm font-semibold leading-snug">
                {hasMultiple ? "Nouveaux maillots" : "Nouveau maillot"}
              </p>

              <div className="relative mt-4 aspect-square overflow-hidden rounded-xl bg-[#161616]">
                <ProductImage
                  src={currentNew.cover?.url ?? null}
                  alt={currentNew.name}
                  sizes="360px"
                  className="object-contain p-2"
                />
              </div>

              <h3 className="mt-4 line-clamp-2 text-base font-medium leading-snug">
                {currentNew.name}
              </h3>
              <Price
                amount={effectiveProductPrice(currentNew)}
                compareAt={currentNew.compareAtPrice}
                currency={currentNew.currency}
                className="mt-2 text-lg"
              />

              <Link
                href={routes.product(currentNew.id)}
                onClick={dismiss}
                className={buttonClasses("accent", "md", "mt-4 w-full")}
              >
                Voir le produit
              </Link>

              {hasMultiple ? (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={goPrev}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-paper-soft text-sm hover:bg-ink hover:text-paper"
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
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-paper-soft text-sm hover:bg-ink hover:text-paper"
                    aria-label="Suivant"
                  >
                    ›
                  </button>
                </div>
              ) : null}
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
