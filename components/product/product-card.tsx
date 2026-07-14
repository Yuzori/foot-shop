"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";

import { CardLaserFrame } from "@/components/product/card-laser-border";
import { FavoriteButton } from "@/components/product/favorite-button";
import { ProductImage } from "@/components/product/product-image";
import { QuickAddDialog } from "@/components/product/quick-add-dialog";
import { ProductBadges } from "@/components/product/product-badges";
import { Price } from "@/components/ui/price";
import { routes } from "@/config/site";
import { cardButtonClasses, useCardScale } from "@/hooks/use-card-scale";
import { useImageAccentColor } from "@/hooks/use-image-accent-color";
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
  const [hovered, setHovered] = useState(false);
  const { ref: cardRef, scale } = useCardScale();
  const imageUrl = product.cover?.url ?? product.images?.[0]?.url ?? null;
  const accent = useImageAccentColor(imageUrl);

  function handleQuickAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setQuickAddOpen(true);
  }

  return (
    <motion.article
      whileHover="hover"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className={cn("group relative flex flex-col", className)}
    >
      <div ref={cardRef} className="relative w-full">
        <CardLaserFrame accent={accent} hovered={hovered}>
          <div
            className={cn(
              "relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-paper-soft",
              !hovered && "ring-1 ring-ink/[0.04]",
            )}
          >
            <Link href={href} className="absolute inset-0 z-0 block">
              <motion.div
                variants={{ hover: { scale: 1.04 } }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0"
              >
                <ProductImage
                  src={imageUrl}
                  alt={product.cover?.alt ?? product.name}
                  priority={priority}
                />
              </motion.div>
            </Link>

            <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col gap-1.5">
              <ProductBadges product={product} className="flex flex-col gap-1.5" />
            </div>

            <div className="absolute right-3 top-3 z-10">
              <FavoriteButton productId={product.id} accentColor={accent.rgb} />
            </div>

            {product.inStock || product.variants.length > 0 || product.optionGroups.length > 0 ? (
              <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center px-3">
                <motion.button
                  type="button"
                  onClick={handleQuickAdd}
                  whileHover={{ scale: 1.04, y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  className={cn(
                    "inline-flex translate-y-2 items-center justify-center rounded-full font-bold uppercase text-white",
                    cardButtonClasses(scale),
                    "opacity-0 shadow-lg backdrop-blur-md transition-all duration-300 ease-premium",
                    "group-hover:translate-y-0 group-hover:opacity-100",
                    "max-sm:translate-y-0 max-sm:opacity-100",
                  )}
                  style={{
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: "rgba(255,255,255,0.38)",
                    background: `linear-gradient(135deg, ${accent.alpha(0.78)} 0%, ${accent.alpha(0.58)} 100%)`,
                    boxShadow: `0 10px 28px -8px ${accent.alpha(0.55)}, inset 0 1px 0 rgba(255,255,255,0.3)`,
                    textShadow: "0 1px 2px rgba(0,0,0,0.22)",
                  }}
                  aria-label={`Ajouter ${product.name} au panier`}
                >
                  Choisir options
                </motion.button>
              </div>
            ) : null}
          </div>
        </CardLaserFrame>
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
