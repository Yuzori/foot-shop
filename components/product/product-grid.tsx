"use client";

import { useEffect, useRef, useState } from "react";

import { ProductCard } from "@/components/product/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/domain";

const INITIAL_BATCH = 24;
const LOAD_BATCH = 24;

interface ProductGridProps {
  products: Product[];
  loading?: boolean;
  skeletonCount?: number;
  className?: string;
}

/** Responsive grid with progressive rendering (comme les grands catalogues e-commerce). */
export function ProductGrid({
  products,
  loading,
  skeletonCount = 8,
  className,
}: ProductGridProps) {
  const grid = cn(
    "grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4",
    className,
  );
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(INITIAL_BATCH);
  }, [products]);

  useEffect(() => {
    if (visibleCount >= products.length) return;

    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((count) =>
            Math.min(count + LOAD_BATCH, products.length),
          );
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [products.length, visibleCount]);

  if (loading) {
    return (
      <div className={grid}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className="flex flex-col">
            <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
            <Skeleton className="mt-4 h-4 w-2/3" />
            <Skeleton className="mt-2 h-3 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  const visibleProducts = products.slice(0, visibleCount);
  const hasMore = visibleCount < products.length;

  return (
    <>
      <div className={grid}>
        {visibleProducts.map((product, i) => (
          <div
            key={product.id}
            className="[content-visibility:auto] [contain-intrinsic-size:320px_420px]"
          >
            <ProductCard product={product} priority={i < 4} />
          </div>
        ))}
      </div>

      {hasMore ? (
        <div ref={sentinelRef} className="flex justify-center py-12" aria-hidden>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/10 border-t-ink/40" />
        </div>
      ) : null}
    </>
  );
}
