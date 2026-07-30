"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";

import { FavoriteButton } from "@/components/product/favorite-button";
import { ProductImage } from "@/components/product/product-image";
import { buttonClasses } from "@/components/ui/button";
import { routes } from "@/config/site";
import { formatPrice } from "@/lib/format";
import { accentFromProductCover } from "@/lib/image-accent-client";
import { cn } from "@/lib/utils";
import { useRecentProductStore } from "@/store/recent-product-store";
import { useUIStore } from "@/store/ui-store";

export function RecentProductBar() {
  const pathname = usePathname();
  const menuOpen = useUIStore((s) => s.menuOpen);
  const recent = useRecentProductStore((s) => s.recent);
  const hidden = useRecentProductStore((s) => s.hidden);
  const hide = useRecentProductStore((s) => s.hide);

  const accent = useMemo(
    () => accentFromProductCover(recent?.accent ?? null),
    [recent?.accent],
  );

  const onSameProduct = recent && pathname === routes.product(recent.id);
  const visible = recent && !hidden && !onSameProduct && !menuOpen;

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-ink/10 bg-paper/95 shadow-lift backdrop-blur-md"
        >
          <div className="mx-auto flex max-w-4xl items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4">
            <Link
              href={routes.product(recent.id)}
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg sm:h-12 sm:w-12"
              style={{ boxShadow: `0 0 0 1.5px ${accent.rgb}` }}
              aria-label={recent.name}
            >
              <div className="relative h-[calc(100%-3px)] w-[calc(100%-3px)] overflow-hidden rounded-[5px] bg-paper">
                <ProductImage
                  src={recent.image}
                  alt={recent.name}
                  sizes="48px"
                  className="!object-contain object-center p-0.5"
                />
              </div>
            </Link>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-bold uppercase tracking-wide text-ink/45 sm:text-xs">
                Dernier article vu
              </p>
              <Link
                href={routes.product(recent.id)}
                className="inline-block max-w-full truncate text-xs font-semibold text-ink transition-colors duration-300 hover:text-accent sm:text-sm"
              >
                {recent.name}
              </Link>
              <p className="hidden text-xs tabular-nums text-ink/55 sm:block">
                {formatPrice(recent.price, recent.currency)}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <FavoriteButton
                productId={recent.id}
                accentColor={accent.rgb}
                className="!h-8 !w-8 !min-h-8 !min-w-8 border border-ink/10 bg-paper/95 sm:!h-9 sm:!w-9"
              />

              <Link
                href={routes.product(recent.id)}
                className={cn(
                  buttonClasses("primary", "sm", "whitespace-nowrap border px-3 text-xs text-white sm:px-4 sm:text-sm"),
                )}
                style={{
                  borderColor: accent.alpha(0.45),
                  background: `linear-gradient(135deg, ${accent.alpha(0.88)} 0%, ${accent.alpha(0.72)} 100%)`,
                  boxShadow: `0 6px 18px -6px ${accent.alpha(0.5)}`,
                }}
              >
                Voir
              </Link>

              <button
                type="button"
                onClick={hide}
                className="shrink-0 rounded-full px-1.5 text-xs text-ink/40 transition-all hover:scale-105 hover:text-ink active:scale-[0.98]"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
