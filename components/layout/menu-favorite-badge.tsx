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
  /** Contour du compteur (fond header, effet découpé). */
  ringColor?: string;
  className?: string;
}

const HEART =
  "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z";

/** Cœur compact en coin haut-droite, chiffre centré dedans (menu mobile). */
export function MenuFavoriteBadge({
  ringColor = "#ffffff",
  className,
}: MenuFavoriteBadgeProps) {
  const hydrated = useHydrated();
  const count = useFavoritesStore((s) => s.ids.length);
  const accent = useFavoritesStore(selectMenuAccent) || FAVORITES_DEFAULT_ACCENT;
  const label = count > 99 ? "99+" : String(count);

  if (!hydrated || count <= 0) return null;

  return (
    <AnimatePresence>
      <motion.svg
        key="menu-fav-badge"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: "spring", stiffness: 480, damping: 22 }}
        className={cn(
          "pointer-events-none absolute right-[5px] top-[3px] z-20 overflow-visible",
          className,
        )}
        aria-hidden
      >
        <g transform="rotate(45 12 12)">
          <motion.path
            d={HEART}
            animate={{ fill: accent }}
            transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
          />
          <circle
            cx="12"
            cy="12"
            r="4.25"
            fill="#0a0a0a"
            stroke={ringColor}
            strokeWidth="1.35"
          />
          <text
            x="12"
            y="12.3"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#ffffff"
            fontSize={label.length > 1 ? "4.8" : "5.6"}
            fontWeight="700"
            fontFamily="system-ui, sans-serif"
            transform="rotate(-45 12 12)"
          >
            {label}
          </text>
        </g>
      </motion.svg>
    </AnimatePresence>
  );
}
