"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

import { CloseIcon } from "@/components/layout/icons";
import { FavoriteButton } from "@/components/product/favorite-button";
import { buttonClasses } from "@/components/ui/button";
import { routes } from "@/config/site";
import { useProductEngagementStore } from "@/store/product-engagement-store";

/**
 * Rappel passif sur la page produit — apparaît après 10 s, pas au départ.
 */
export function FavoriteNudge() {
  const pathname = usePathname();
  const nudgeVisible = useProductEngagementStore((s) => s.nudgeVisible);
  const viewedId = useProductEngagementStore((s) => s.viewedProductId);
  const dismissNudge = useProductEngagementStore((s) => s.dismissNudge);
  const hideNudge = useProductEngagementStore((s) => s.hideNudge);

  const onProductPage = /\/produit\/([^/]+)/.test(pathname);
  const pageProductId = pathname.match(/\/produit\/([^/]+)/)?.[1];
  const show =
    onProductPage &&
    nudgeVisible &&
    viewedId &&
    pageProductId === viewedId;

  return (
    <AnimatePresence>
      {show ? (
        <motion.aside
          initial={{ opacity: 0, y: 16, x: 16 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="fixed bottom-[max(5rem,env(safe-area-inset-bottom))] left-4 right-4 z-[55] rounded-2xl border border-ink/10 bg-paper p-5 shadow-lift sm:bottom-6 sm:left-auto sm:right-4 sm:max-w-xs"
          role="dialog"
          aria-label="Rappel favoris"
        >
          <button
            type="button"
            onClick={() => dismissNudge(viewedId)}
            aria-label="Fermer"
            className="overlay-close absolute right-2 top-2 text-ink/45 transition-colors hover:bg-paper-soft hover:text-ink"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
          <p className="pr-8 text-xs font-bold uppercase tracking-wide text-accent">
            Pas encore décidé ?
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink/65">
            Ajoutez ce maillot à vos favoris pour le retrouver et l&apos;acheter plus
            tard.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <FavoriteButton productId={viewedId} />
            <Link
              href={routes.product(viewedId)}
              className={buttonClasses("outline", "sm")}
              onClick={hideNudge}
            >
              Revoir
            </Link>
          </div>
          <button
            type="button"
            onClick={() => dismissNudge(viewedId)}
            className="mt-3 block w-full text-center text-xs text-ink/45 hover:text-ink"
          >
            Non merci
          </button>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
