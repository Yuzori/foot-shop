"use client";

import Link from "next/link";
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

const SHOWN_KEY = "footshop_shown_new_ids";

function readShownIds(): string[] {
  try {
    const raw = localStorage.getItem(SHOWN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveShownIds(ids: string[]) {
  try {
    localStorage.setItem(SHOWN_KEY, JSON.stringify([...new Set(ids)]));
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

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || e.pointerType === "touch") return;
      startRef.current = { x: e.clientX, y: e.clientY };
    },
    [enabled],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || e.pointerType === "touch" || !startRef.current) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      startRef.current = null;
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      if (dx < 0) onNext();
      else onPrev();
    },
    [enabled, onNext, onPrev],
  );

  return { onTouchStart, onTouchEnd, onPointerDown, onPointerUp };
}

/**
 * Modale nouveautés — s'appuie sur le snapshot serveur (pas une heuristique locale).
 */
export function SiteModal() {
  const { data: arrivals = [] } = useQuery({
    queryKey: ["marketing-new-arrivals"],
    queryFn: fetchNewArrivals,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const [open, setOpen] = useState(false);
  const [newProducts, setNewProducts] = useState<Product[]>([]);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (!arrivals.length) return;
    const shown = readShownIds();
    const fresh = arrivals.filter((product) => !shown.includes(product.id));
    if (fresh.length === 0) return;
    setNewProducts(fresh);
    setOpen(true);
    setSlide(0);
  }, [arrivals]);

  const goPrev = useCallback(() => {
    setSlide((s) => (s - 1 + newProducts.length) % Math.max(newProducts.length, 1));
  }, [newProducts.length]);

  const goNext = useCallback(() => {
    setSlide((s) => (s + 1) % Math.max(newProducts.length, 1));
  }, [newProducts.length]);

  const swipe = useCarouselSwipe(newProducts.length > 1, goPrev, goNext);

  const dismiss = useCallback(() => {
    const shown = readShownIds();
    saveShownIds([...shown, ...newProducts.map((product) => product.id)]);
    setNewProducts([]);
    setOpen(false);
  }, [newProducts]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, dismiss]);

  if (!open) return null;

  const currentNew = newProducts[slide];
  const hasMultiple = newProducts.length > 1;
  const releaseTitle = hasMultiple
    ? "Voici les nouveaux articles"
    : "Voici le nouvel article";

  return (
    <AnimatePresence>
      {open && currentNew ? (
        <motion.div
          key="site-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="overlay-root z-[70]"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-ink/35 backdrop-blur-xl"
            onClick={dismiss}
            aria-hidden
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 12 }}
            transition={{ type: "spring", stiffness: 400, damping: 34 }}
            className="overlay-panel max-w-lg text-ink"
          >
            <div className="h-1 w-full shrink-0 bg-accent" />

            <button
              onClick={dismiss}
              aria-label="Fermer"
              className="overlay-close absolute right-3 top-3 bg-paper-soft text-ink/50 transition-colors hover:bg-ink hover:text-paper"
            >
              <CloseIcon className="h-5 w-5" />
            </button>

            <div className="overlay-scroll p-5 sm:p-8">
              <p className="eyebrow text-accent">Nouveauté</p>
              <h2 className="display-2 mt-2 text-2xl sm:text-3xl">{releaseTitle}</h2>
              <p className="mt-2 text-sm text-ink/55">
                {newProducts.length} article{newProducts.length > 1 ? "s" : ""} tout
                juste publié{newProducts.length > 1 ? "s" : ""}
              </p>

              <div
                className="relative mt-5 touch-pan-y overflow-hidden rounded-2xl border border-ink/8 bg-paper-soft sm:mt-6"
                onTouchStart={swipe.onTouchStart}
                onTouchEnd={swipe.onTouchEnd}
                onPointerDown={swipe.onPointerDown}
                onPointerUp={swipe.onPointerUp}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentNew.id}
                    initial={{ opacity: 0, x: 28 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -28 }}
                    transition={{ duration: 0.28 }}
                    className="grid grid-cols-1"
                  >
                    <div className="relative aspect-square w-full overflow-hidden rounded-t-2xl bg-[#161616]">
                      <ProductImage
                        src={currentNew.cover?.url ?? null}
                        alt={currentNew.name}
                        sizes="(max-width: 640px) 92vw, 480px"
                        className="object-contain p-1.5 sm:p-2"
                      />
                    </div>
                    <div className="flex flex-col justify-center p-4 sm:p-6">
                      <h3 className="text-base font-semibold leading-snug sm:text-lg">
                        {currentNew.name}
                      </h3>
                      <Price
                        amount={effectiveProductPrice(currentNew)}
                        compareAt={currentNew.compareAtPrice}
                        currency={currentNew.currency}
                        className="mt-3 text-lg sm:mt-4 sm:text-xl"
                      />
                      <Link
                        href={routes.product(currentNew.id)}
                        onClick={dismiss}
                        className={buttonClasses("accent", "md", "mt-4 w-full sm:mt-6")}
                      >
                        Voir le produit
                      </Link>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {hasMultiple ? (
                  <div className="border-t border-ink/8 py-3">
                    <p className="text-center text-[10px] text-ink/40 sm:hidden">
                      Glissez sur la carte pour voir l&apos;article suivant
                    </p>
                    <div className="mt-2 flex items-center justify-center gap-4 sm:mt-0">
                      <button
                        type="button"
                        onClick={goPrev}
                        className="overlay-close bg-paper-soft text-sm hover:bg-ink hover:text-paper"
                        aria-label="Précédent"
                      >
                        ‹
                      </button>
                      <span className="text-xs font-medium tabular-nums text-ink/50">
                        {slide + 1} / {newProducts.length}
                      </span>
                      <button
                        type="button"
                        onClick={goNext}
                        className="overlay-close bg-paper-soft text-sm hover:bg-ink hover:text-paper"
                        aria-label="Suivant"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
