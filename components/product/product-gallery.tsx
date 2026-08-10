"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useState } from "react";

import { ProductImage } from "@/components/product/product-image";
import { ArrowIcon } from "@/components/layout/icons";
import { useCarouselSwipe } from "@/hooks/use-carousel-swipe";
import { cn } from "@/lib/utils";
import type { ProductImage as ProductImageType } from "@/types/domain";

interface ProductGalleryProps {
  images: ProductImageType[];
  name: string;
}

/** Galerie multi-images : swipe, vignettes et indicateurs. */
export function ProductGallery({ images, name }: ProductGalleryProps) {
  const [active, setActive] = useState(0);
  const list = images.length ? images : [];
  const current = list[active] ?? list[0] ?? null;
  const count = list.length;

  const goPrev = useCallback(() => {
    setActive((i) => (i - 1 + count) % count);
  }, [count]);

  const goNext = useCallback(() => {
    setActive((i) => (i + 1) % count);
  }, [count]);

  const swipe = useCarouselSwipe(count > 1, goPrev, goNext);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl bg-paper-soft">
        <div
          className="absolute inset-0 touch-pan-y select-none"
          onTouchStart={swipe.onTouchStart}
          onTouchEnd={swipe.onTouchEnd}
          onPointerDown={swipe.onPointerDown}
          onPointerUp={swipe.onPointerUp}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={current?.id ?? "empty"}
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0"
            >
              <ProductImage
                src={current?.url ?? null}
                alt={current?.alt ?? name}
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
                className="pointer-events-none object-contain p-2 sm:p-4"
              />
            </motion.div>
          </AnimatePresence>

          {count > 1 ? (
            <div className="pointer-events-none absolute bottom-4 left-0 right-0 flex items-center justify-center gap-2">
              {list.map((img, i) => (
                <span
                  key={img.id}
                  aria-hidden
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    active === i ? "w-6 bg-accent" : "w-1.5 bg-paper/60",
                  )}
                />
              ))}
            </div>
          ) : null}

          {count > 1 ? (
            <span className="pointer-events-none absolute right-4 top-4 rounded-full bg-ink/70 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-paper">
              {active + 1} / {count}
            </span>
          ) : null}
        </div>

        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Image précédente"
              className="absolute left-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-ink/10 bg-paper/95 text-ink/60 shadow-panel backdrop-blur-sm transition hover:border-accent/40 hover:text-accent"
            >
              <ArrowIcon className="h-4 w-4 rotate-180" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Image suivante"
              className="absolute right-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-ink/10 bg-paper/95 text-ink/60 shadow-panel backdrop-blur-sm transition hover:border-accent/40 hover:text-accent"
            >
              <ArrowIcon className="h-4 w-4" />
            </button>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-4">
          {list.map((image, i) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Voir l'image ${i + 1}`}
              className={cn(
                "relative aspect-square overflow-hidden rounded-xl bg-paper-soft transition-all",
                active === i
                  ? "ring-2 ring-accent ring-offset-2"
                  : "opacity-55 hover:opacity-100",
              )}
            >
              <ProductImage
                src={image.url}
                alt={image.alt}
                sizes="80px"
                className="object-contain p-1"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
