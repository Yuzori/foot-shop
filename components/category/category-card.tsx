"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { ArrowIcon } from "@/components/layout/icons";
import { ProductImage } from "@/components/product/product-image";
import { routes } from "@/config/site";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/domain";

interface CategoryCardProps {
  category: Category;
  className?: string;
}

/** Generic category tile. Receives a domain Category via props only. */
export function CategoryCard({ category, className }: CategoryCardProps) {
  return (
    <motion.div whileHover="hover" className={cn("group relative", className)}>
      <Link href={routes.category(category.id)} className="block">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-ink">
          <motion.div
            variants={{ hover: { scale: 1.05 } }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 opacity-80"
          >
            <ProductImage
              src={category.image?.url ?? null}
              alt={category.image?.alt ?? category.name}
              sizes="(max-width: 768px) 50vw, 25vw"
            />
          </motion.div>
          <div className="absolute inset-0 bg-ink/5" />

          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5">
            <div>
              <h3 className="text-lg font-semibold tracking-tightest text-paper">
                {category.name}
              </h3>
              {category.productCount !== null ? (
                <p className="text-xs text-paper/70">
                  {category.productCount} article
                  {category.productCount > 1 ? "s" : ""}
                </p>
              ) : null}
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-paper text-ink transition-transform duration-300 group-hover:translate-x-1">
              <ArrowIcon />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
