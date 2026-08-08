"use client";

import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";

import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";
import {
  FAVORITES_DEFAULT_ACCENT,
  selectMenuAccent,
  useFavoritesStore,
} from "@/store/favorites-store";

const HEART =
  "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z";

/** Centre visuel du tracé cœur dans son viewBox 24×24 d'origine. */
const HEART_CX = 12;
const HEART_CY = 12.2;
/** Centre du cœur dans le viewBox de l'icône (36×30). */
const CX = 25;
const CY = 6.5;
/** Trou du compteur — bas-droite du cœur (coords locales 24×24). */
const BADGE_X = 17.8;
const BADGE_Y = 18.4;
const BADGE_R = 5.1;

/** Les barres se raccourcissent en escalier pour loger le cœur. */
const BAR_FULL = [20, 20, 20];
const BAR_NOTCHED = [12, 17, 20];
const BAR_Y = [8, 15, 22];

function withAlpha(color: string, alpha: number): string {
  const parts = color.match(/rgba?\(([^)]+)\)/);
  if (parts?.[1]) {
    const [r, g, b] = parts[1].split(",").map((v) => v.trim());
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

function fontSizeFor(label: string): number {
  if (label.length >= 3) return 4.8;
  if (label.length === 2) return 5.8;
  return 7;
}

interface MobileMenuIconProps {
  theme?: "light" | "dark";
  className?: string;
}

/** Icône menu : barres en escalier + cœur favoris incliné, compteur découpé en bas à droite. */
export function MobileMenuIcon({
  theme = "light",
  className,
}: MobileMenuIconProps) {
  const hydrated = useHydrated();
  const count = useFavoritesStore((s) => s.ids.length);
  const accent = useFavoritesStore(selectMenuAccent) || FAVORITES_DEFAULT_ACCENT;
  const maskId = useId().replace(/:/g, "");

  const beat = useAnimationControls();
  const previousCount = useRef(count);
  const [pulse, setPulse] = useState(0);

  const active = hydrated && count > 0;
  const bars = active ? BAR_NOTCHED : BAR_FULL;
  const numberColor = theme === "dark" ? "#ffffff" : "#0a0a0a";
  const ringColor = theme === "dark" ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.18)";
  const label = count > 99 ? "99+" : String(count);

  useEffect(() => {
    if (previousCount.current === count) return;
    const grew = count > previousCount.current;
    previousCount.current = count;
    if (!grew) return;
    setPulse((n) => n + 1);
    void beat.start({
      scale: [1, 1.32, 0.92, 1.1, 1],
      transition: { duration: 0.66, ease: [0.22, 1, 0.36, 1] },
    });
  }, [count, beat]);

  return (
    <svg
      width="36"
      height="30"
      viewBox="0 0 36 30"
      className={cn("block shrink-0 overflow-visible", className)}
      aria-hidden
    >
      {BAR_Y.map((y, i) => (
        <motion.line
          key={y}
          x1="2"
          y1={y}
          y2={y}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          initial={false}
          animate={{ x2: bars[i] }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      ))}

      <AnimatePresence>
        {active ? (
          <motion.g
            initial={{ scale: 0, rotate: -90, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0, rotate: -60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 480, damping: 22 }}
            style={{ transformOrigin: `${CX}px ${CY}px` }}
          >
            <AnimatePresence>
              {pulse > 0 ? (
                <motion.circle
                  key={pulse}
                  cx={CX}
                  cy={CY}
                  r="10"
                  fill="none"
                  strokeWidth="2"
                  initial={{ scale: 0.6, opacity: 0.9 }}
                  animate={{ scale: 2.1, opacity: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  style={{
                    transformOrigin: `${CX}px ${CY}px`,
                    stroke: accent,
                  }}
                />
              ) : null}
            </AnimatePresence>

            <motion.g animate={beat} style={{ transformOrigin: `${CX}px ${CY}px` }}>
              <g
                transform={`translate(${CX} ${CY}) rotate(45) scale(0.83) translate(${-HEART_CX} ${-HEART_CY})`}
              >
                <defs>
                  <mask id={maskId}>
                    <rect x="-2" y="-2" width="28" height="28" fill="white" />
                    <circle cx={BADGE_X} cy={BADGE_Y} r={BADGE_R} fill="black" />
                  </mask>
                </defs>

                <motion.g
                  animate={{
                    filter: `drop-shadow(0 1px 2.5px ${withAlpha(accent, 0.6)})`,
                  }}
                  transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                >
                  <motion.path
                    d={HEART}
                    mask={`url(#${maskId})`}
                    animate={{ fill: accent }}
                    transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
                  />
                </motion.g>

                <circle
                  cx={BADGE_X}
                  cy={BADGE_Y}
                  r={BADGE_R}
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="1.1"
                />

                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.text
                    key={label}
                    x={BADGE_X}
                    y={BADGE_Y + 0.3}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={numberColor}
                    fontSize={fontSizeFor(label)}
                    fontWeight="800"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    initial={{ opacity: 0, scale: 0.3 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.3 }}
                    transition={{ type: "spring", stiffness: 600, damping: 28 }}
                    style={{
                      transformOrigin: `${BADGE_X}px ${BADGE_Y}px`,
                    }}
                  >
                    {label}
                  </motion.text>
                </AnimatePresence>
              </g>
            </motion.g>
          </motion.g>
        ) : null}
      </AnimatePresence>
    </svg>
  );
}
