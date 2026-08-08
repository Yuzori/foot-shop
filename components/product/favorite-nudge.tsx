"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

import { CloseIcon } from "@/components/layout/icons";
import { buttonClasses } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import { useProductEngagementStore } from "@/store/product-engagement-store";
import { useFavoritesStore } from "@/store/favorites-store";
import { useRecentProductStore } from "@/store/recent-product-store";
import { cn } from "@/lib/utils";

/**
 * Rappel passif sur la page produit — apparaît après 10 s, pas au départ.
 */
export function FavoriteNudge() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const nudgeVisible = useProductEngagementStore((s) => s.nudgeVisible);
  const viewedId = useProductEngagementStore((s) => s.viewedProductId);
  const dismissNudge = useProductEngagementStore((s) => s.dismissNudge);
  const ids = useFavoritesStore((s) => s.ids);
  const toggle = useFavoritesStore((s) => s.toggle);
  const recent = useRecentProductStore((s) => s.recent);

  const onProductPage = /\/produit\/([^/]+)/.test(pathname);
  const pageProductId = pathname.match(/\/produit\/([^/]+)/)?.[1];
  const show =
    onProductPage &&
    nudgeVisible &&
    viewedId &&
    pageProductId === viewedId;

  const isFavorite = hydrated && viewedId ? ids.includes(viewedId) : false;

  function handleFavorite() {
    if (!viewedId) return;
    if (!isFavorite) {
      const accent =
        recent?.id === viewedId && recent.accent
          ? `rgb(${recent.accent.r}, ${recent.accent.g}, ${recent.accent.b})`
          : undefined;
      toggle(viewedId, accent);
    }
    dismissNudge(viewedId);
  }

  return (
    <AnimatePresence>
      {show ? (
        <motion.aside
          initial={{ opacity: 0, y: 12, x: 8 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="fixed bottom-[max(4.5rem,env(safe-area-inset-bottom))] left-3 right-3 z-[55] rounded-xl border border-ink/10 bg-paper p-3 shadow-lift sm:bottom-5 sm:left-auto sm:right-4 sm:max-w-[17rem] sm:p-3.5"
          role="dialog"
          aria-label="Rappel favoris"
        >
          <button
            type="button"
            onClick={() => dismissNudge(viewedId)}
            aria-label="Fermer"
            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-ink/35 transition-colors hover:text-ink/70"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>

          <p className="pr-7 text-[11px] font-bold uppercase tracking-wide text-accent">
            Pas encore décidé ?
          </p>
          <p className="mt-1 pr-1 text-xs leading-snug text-ink/60 sm:text-[13px]">
            Gardez ce maillot sous la main et revenez quand vous voulez.
          </p>

          <div className="mt-3 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={handleFavorite}
              disabled={isFavorite}
              className={cn(
                buttonClasses("primary", "sm"),
                "w-full gap-1.5 text-xs",
                isFavorite && "opacity-70",
              )}
            >
              <HeartIcon filled={isFavorite} />
              {isFavorite ? "Déjà dans vos favoris" : "Ajouter aux favoris"}
            </button>
            <button
              type="button"
              onClick={() => dismissNudge(viewedId)}
              className={buttonClasses(
                "ghost",
                "sm",
                "h-9 w-full text-xs text-ink/50",
              )}
            >
              Non merci
            </button>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
