"use client";



import Link from "next/link";

import { usePathname } from "next/navigation";

import { AnimatePresence, motion } from "framer-motion";



import { FavoriteButton } from "@/components/product/favorite-button";

import { ProductImage } from "@/components/product/product-image";

import { buttonClasses } from "@/components/ui/button";

import { routes } from "@/config/site";

import { formatPrice } from "@/lib/format";

import { useRecentProductStore } from "@/store/recent-product-store";

import { useUIStore } from "@/store/ui-store";



export function RecentProductBar() {

  const pathname = usePathname();

  const menuOpen = useUIStore((s) => s.menuOpen);

  const recent = useRecentProductStore((s) => s.recent);

  const hidden = useRecentProductStore((s) => s.hidden);

  const hide = useRecentProductStore((s) => s.hide);



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

              className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-paper-soft sm:h-12 sm:w-12"

            >

              <ProductImage

                src={recent.image}

                alt={recent.name}

                sizes="48px"

                className="object-contain p-1"

              />

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

                className="!h-8 !w-8 !min-h-8 !min-w-8 sm:!h-9 sm:!w-9"

              />

              <Link

                href={routes.product(recent.id)}

                className={buttonClasses(

                  "primary",

                  "sm",

                  "whitespace-nowrap bg-accent px-3 text-xs text-ink hover:bg-accent-dark sm:px-4 sm:text-sm",

                )}

              >

                Voir

              </Link>

              <button

                type="button"

                onClick={hide}

                className="shrink-0 px-1.5 text-xs text-ink/40 hover:text-ink"

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

