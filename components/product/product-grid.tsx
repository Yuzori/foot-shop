"use client";

import { ProductCard } from "@/components/product/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/domain";

interface ProductGridProps {
  products: Product[];
  loading?: boolean;
  skeletonCount?: number;
  className?: string;
}

/** Responsive grid of product cards with a loading skeleton state. */
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

  return (
    <div className={grid}>
      {products.map((product, i) => (
        <ProductCard key={product.id} product={product} priority={i < 4} />
      ))}
    </div>
  );
}
