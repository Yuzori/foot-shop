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
import { api } from "@/lib/api";
import type { Product } from "@/types/domain";

const CATALOG_KEY = "footshop_catalog_ids";
const CREATED_KEY = "footshop_product_created";
const ABSENT_KEY = "footshop_absent_ids";

function readKnownIds(): string[] {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveKnownIds(ids: string[]) {
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

function readCreatedMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CREATED_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveCreatedMap(map: Record<string, string>) {
  try {
    localStorage.setItem(CREATED_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function readAbsentIds(): string[] {
  try {
    const raw = localStorage.getItem(ABSENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveAbsentIds(ids: string[]) {
  try {
    localStorage.setItem(ABSENT_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

/** Détecte les nouveautés : ID inconnu, ré-ajout PS (createdAt ou retour après suppression). */
function detectNewProducts(items: Product[]): Product[] {
  const known = readKnownIds();
  const createdMap = readCreatedMap();
  const absent = readAbsentIds();
  const currentIds = items.map((p) => p.id);

  const newlyAbsent = known.filter((id) => !currentIds.includes(id));
  if (newlyAbsent.length > 0) {
    saveAbsentIds([...new Set([...absent, ...newlyAbsent])]);
  }

  const cameBack = absent.filter((id) => currentIds.includes(id));

  if (known.length === 0) {
    saveKnownIds(currentIds);
    saveCreatedMap(
      Object.fromEntries(
        items.map((p) => [p.id, p.createdAt ?? ""]),
      ),
    );
    saveAbsentIds([]);
    return [];
  }

  return items.filter((p) => {
    if (!known.includes(p.id)) return true;
    if (cameBack.includes(p.id)) return true;
    const prev = createdMap[p.id];
    if (p.createdAt && prev && prev !== p.createdAt) return true;
    return false;
  });
}

function persistCatalog(items: Product[]) {
  const known = readKnownIds();
  const createdMap = readCreatedMap();
  const absent = readAbsentIds();
  const ids = items.map((p) => p.id);
  saveKnownIds([...new Set([...known, ...ids])]);
  const nextMap = { ...createdMap };
  for (const p of items) {
    if (p.createdAt) nextMap[p.id] = p.createdAt;
  }
  saveCreatedMap(nextMap);
  saveAbsentIds(absent.filter((id) => !ids.includes(id)));
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
 * Modale nouveautés — popup unique quand un nouveau maillot est publié.
 */
export function SiteModal() {
  const { data: catalog } = useQuery({
    queryKey: ["catalog-watch"],
    queryFn: () => api.getProducts({ sort: "newest", limit: 40, page: 1 }),
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
  });

  const [open, setOpen] = useState(false);
  const [newProducts, setNewProducts] = useState<Product[]>([]);
  const [slide, setSlide] = useState(0);

  const goPrev = useCallback(() => {
    setSlide((s) => (s - 1 + newProducts.length) % Math.max(newProducts.length, 1));
  }, [newProducts.length]);

  const goNext = useCallback(() => {
    setSlide((s) => (s + 1) % Math.max(newProducts.length, 1));
  }, [newProducts.length]);

  const swipe = useCarouselSwipe(
    newProducts.length > 1,
    goPrev,
    goNext,
  );

  useEffect(() => {
    if (!catalog?.items?.length) return;

    const fresh = detectNewProducts(catalog.items);
    if (fresh.length > 0) {
      setNewProducts(fresh);
      setOpen(true);
      setSlide(0);
    }
  }, [catalog?.items]);

  const dismiss = useCallback(() => {
    if (catalog?.items) persistCatalog(catalog.items);
    setNewProducts([]);
    setOpen(false);
  }, [catalog?.items]);

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

            {currentNew ? (
              <div className="overlay-scroll p-5 sm:p-8">
                <p className="eyebrow text-accent">Nouveauté</p>
                <h2 className="display-2 mt-2 text-2xl sm:text-3xl">{releaseTitle}</h2>
                <p className="mt-2 text-sm text-ink/55">
                  {newProducts.length} article{newProducts.length > 1 ? "s" : ""}{" "}
                  depuis votre dernière visite
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
                          amount={currentNew.price}
                          compareAt={currentNew.compareAtPrice}
                          currency={currentNew.currency}
                          className="mt-3 text-lg sm:mt-4 sm:text-xl"
                        />
                        <Link
                          href={routes.product(currentNew.id)}
                          onClick={dismiss}
                          className={buttonClasses(
                            "accent",
                            "md",
                            "mt-4 w-full sm:mt-6",
                          )}
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
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
