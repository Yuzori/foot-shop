"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import { FavoriteButton } from "@/components/product/favorite-button";
import { ProductImage } from "@/components/product/product-image";
import { QuickAddDialog } from "@/components/product/quick-add-dialog";
import { ProductBadges } from "@/components/product/product-badges";
import { Price } from "@/components/ui/price";
import { routes } from "@/config/site";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/domain";

interface ProductCardProps {
  product: Product;
  priority?: boolean;
  className?: string;
}

/** Generic product card — receives a domain Product via props only. */
export function ProductCard({ product, priority, className }: ProductCardProps) {
  const href = routes.product(product.id);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  function handleQuickAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setQuickAddOpen(true);
  }

  return (
    <motion.article
      whileHover="hover"
      className={cn("group relative flex flex-col", className)}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-paper-soft">
        <Link href={href} className="absolute inset-0 z-0 block">
          <motion.div
            variants={{ hover: { scale: 1.04 } }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0"
          >
            <ProductImage
              src={product.cover?.url ?? null}
              alt={product.cover?.alt ?? product.name}
              priority={priority}
            />
          </motion.div>
        </Link>

        <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col gap-1.5">
          <ProductBadges product={product} className="flex flex-col gap-1.5" />
        </div>

        <div className="absolute right-3 top-3 z-10">
          <FavoriteButton productId={product.id} />
        </div>

        {product.inStock || product.variants.length > 0 || product.optionGroups.length > 0 ? (
          <div className="absolute inset-x-3 bottom-3 z-10 flex justify-center">
            <motion.button
              type="button"
              onClick={handleQuickAdd}
              whileTap={{ scale: 0.97 }}
              className="w-full translate-y-2 rounded-full bg-ink/95 px-5 py-3 text-xs font-medium text-paper opacity-0 shadow-lift backdrop-blur transition-all duration-300 ease-premium hover:bg-ink group-hover:translate-y-0 group-hover:opacity-100 max-sm:translate-y-0 max-sm:opacity-100"
              aria-label={`Ajouter ${product.name} au panier`}
            >
              Choisir options
            </motion.button>
          </div>
        ) : null}
      </div>

      <QuickAddDialog
        product={product}
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
      />

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={href}>
            <h3 className="truncate text-sm font-medium text-ink">
              {product.name}
            </h3>
          </Link>
        </div>
        <Price
          amount={product.price}
          compareAt={product.compareAtPrice}
          currency={product.currency}
          showDiscount={false}
          className="shrink-0 text-sm"
        />
      </div>
    </motion.article>
  );
}
