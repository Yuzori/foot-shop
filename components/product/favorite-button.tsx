"use client";

import { AnimatePresence, motion } from "framer-motion";

import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";
import { useFavoritesStore } from "@/store/favorites-store";

interface FavoriteButtonProps {
  productId: string;
  className?: string;
}

const BURST = Array.from({ length: 6 });

/** Heart toggle — bouton strictement circulaire. */
export function FavoriteButton({ productId, className }: FavoriteButtonProps) {
  const hydrated = useHydrated();
  const ids = useFavoritesStore((s) => s.ids);
  const toggle = useFavoritesStore((s) => s.toggle);
  const active = hydrated && ids.includes(productId);

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.85 }}
      whileHover={{ scale: 1.06 }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(productId);
      }}
      aria-pressed={active}
      aria-label={active ? "Retirer des favoris" : "Ajouter aux favoris"}
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full bg-paper text-ink shadow-soft backdrop-blur transition-colors hover:bg-paper-soft",
        "aspect-square h-11 w-11 min-h-11 min-w-11 p-0",
        className,
      )}
    >
      <AnimatePresence>
        {active ? (
          <motion.span
            key="ring"
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-accent"
            initial={{ scale: 0.7, opacity: 0.8 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        ) : null}
      </AnimatePresence>

      {active
        ? BURST.map((_, i) => (
            <motion.span
              key={`p-${i}`}
              className="pointer-events-none absolute h-1 w-1 rounded-full bg-accent"
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{
                x: Math.cos((i / BURST.length) * Math.PI * 2) * 14,
                y: Math.sin((i / BURST.length) * Math.PI * 2) * 14,
                opacity: 0,
                scale: 0,
              }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          ))
        : null}

      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        className={cn(
          "relative block shrink-0 transition-colors",
          active && "text-accent",
        )}
        aria-hidden
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </motion.button>
  );
}
