"use client";

import { AnimatePresence, motion } from "framer-motion";

import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";
import {
  FAVORITES_DEFAULT_ACCENT,
  useFavoritesStore,
} from "@/store/favorites-store";

interface MenuFavoriteBadgeProps {
  /** Couleur de l’anneau autour du compteur (fond header). */
  ringClassName?: string;
  className?: string;
}

/** Cœur tordu + compteur sur le bouton menu (mobile), couleur du dernier favori. */
export function MenuFavoriteBadge({
  ringClassName = "ring-paper",
  className,
}: MenuFavoriteBadgeProps) {
  const hydrated = useHydrated();
  const count = useFavoritesStore((s) => s.ids.length);
  const accent =
    useFavoritesStore((s) => s.lastAccentColor) || FAVORITES_DEFAULT_ACCENT;

  if (!hydrated || count <= 0) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key="menu-fav-badge"
        initial={{ scale: 0.4, rotate: -24, opacity: 0 }}
        animate={{ scale: 1, rotate: -14, opacity: 1 }}
        exit={{ scale: 0.4, rotate: -24, opacity: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 22 }}
        className={cn(
          "pointer-events-none absolute -right-2 -top-1.5 z-10 flex h-7 w-7 items-center justify-center",
          className,
        )}
        aria-hidden
      >
        <motion.svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
          style={{ transform: "skewX(-6deg) scaleX(0.94)" }}
          animate={{ color: accent }}
          transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
        >
          <path
            d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.6"
          />
        </motion.svg>

        <motion.span
          key={count}
          initial={{ scale: 1.45, opacity: 0.85 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 18 }}
          className={cn(
            "absolute -bottom-0.5 -right-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-ink px-0.5 text-[9px] font-bold leading-none text-paper ring-2",
            ringClassName,
          )}
        >
          {count > 99 ? "99+" : count}
        </motion.span>
      </motion.span>
    </AnimatePresence>
  );
}
