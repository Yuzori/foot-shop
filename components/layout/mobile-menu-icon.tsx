"use client";

import { motion } from "framer-motion";

import { MenuIcon } from "@/components/layout/icons";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";
import {
  FAVORITES_DEFAULT_ACCENT,
  selectMenuAccent,
  useFavoritesStore,
} from "@/store/favorites-store";

const HEART =
  "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z";

interface MobileMenuIconProps {
  ringColor?: string;
  className?: string;
}

/**
 * Icône menu unique : barres à gauche + cœur favoris intégré en haut à droite.
 */
export function MobileMenuIcon({
  ringColor = "#ffffff",
  className,
}: MobileMenuIconProps) {
  const hydrated = useHydrated();
  const count = useFavoritesStore((s) => s.ids.length);
  const accent = useFavoritesStore(selectMenuAccent) || FAVORITES_DEFAULT_ACCENT;

  if (!hydrated || count <= 0) {
    return <MenuIcon className={className} />;
  }

  const label = count > 99 ? "99+" : String(count);

  return (
    <motion.svg
      width="28"
      height="28"
      viewBox="0 0 36 28"
      className={cn("block shrink-0", className)}
      aria-hidden
    >
      <path
        d="M2 6h15M2 14h15M2 22h15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <g transform="translate(26 7.5) rotate(45) scale(0.58) translate(-12 -12)">
        <motion.path
          d={HEART}
          animate={{ fill: accent }}
          transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
        />
        <circle
          cx="12"
          cy="12"
          r="5.2"
          fill="#0a0a0a"
          stroke={ringColor}
          strokeWidth="1.6"
        />
        <motion.text
          key={label}
          x="12"
          y="12.5"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ffffff"
          fontSize={label.length > 1 ? "6.5" : "7.8"}
          fontWeight="700"
          fontFamily="system-ui, sans-serif"
          transform="rotate(-45 12 12)"
          initial={{ scale: 1.35 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 520, damping: 20 }}
        >
          {label}
        </motion.text>
      </g>
    </motion.svg>
  );
}
