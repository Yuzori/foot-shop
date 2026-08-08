"use client";

import { AnimatePresence, motion } from "framer-motion";

import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";
import {
  FAVORITES_DEFAULT_ACCENT,
  selectMenuAccent,
  useFavoritesStore,
} from "@/store/favorites-store";

interface MenuFavoriteBadgeProps {
  /** Anneau du compteur (coupe dans le cœur, fond header). */
  ringClassName?: string;
  className?: string;
}

/** Cœur incliné à 45° en coin droit + compteur centré dedans (menu mobile). */
export function MenuFavoriteBadge({
  ringClassName = "ring-paper",
  className,
}: MenuFavoriteBadgeProps) {
  const hydrated = useHydrated();
  const count = useFavoritesStore((s) => s.ids.length);
  const accent = useFavoritesStore(selectMenuAccent) || FAVORITES_DEFAULT_ACCENT;

  if (!hydrated || count <= 0) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key="menu-fav-badge"
        initial={{ scale: 0.35, rotate: 30, opacity: 0 }}
        animate={{ scale: 1, rotate: 45, opacity: 1 }}
        exit={{ scale: 0.35, rotate: 30, opacity: 0 }}
        transition={{ type: "spring", stiffness: 440, damping: 24 }}
        className={cn(
          "pointer-events-none absolute right-0 top-0 z-10 h-[18px] w-[18px]",
          className,
        )}
        aria-hidden
      >
        <motion.svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          className="absolute inset-0 drop-shadow-[0_1px_1px_rgba(0,0,0,0.18)]"
          animate={{ color: accent }}
          transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
        >
          <path
            d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
            fill="currentColor"
          />
        </motion.svg>

        <motion.span
          key={count}
          initial={{ scale: 1.4 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 520, damping: 20 }}
          className={cn(
            "absolute left-1/2 top-1/2 flex h-[11px] min-w-[11px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ink px-px text-[6.5px] font-bold leading-none text-paper ring-[1.5px]",
            ringClassName,
          )}
          style={{ rotate: "-45deg" }}
        >
          {count > 99 ? "99+" : count}
        </motion.span>
      </motion.span>
    </AnimatePresence>
  );
}
