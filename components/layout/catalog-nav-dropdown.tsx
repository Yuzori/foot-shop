"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { LeagueIcon } from "@/components/layout/league-icon";
import {
  buildJerseyLeagueHref,
  catalogLeagues,
  type CatalogNavCategories,
} from "@/config/catalog-leagues";
import { cn } from "@/lib/utils";

import type { Category } from "@/types/domain";

interface CatalogNavDropdownProps {
  label: string;
  categories: CatalogNavCategories;
  allCategories?: Category[];
  active?: boolean;
  theme?: "light" | "dark";
}

const panelMotion = {
  initial: { opacity: 0, y: 10, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 8, scale: 0.97 },
  transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
} as const;

const listMotion = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
  transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
} as const;

/** Menu déroulant maillots — divisions directement (adulte uniquement). */
export function CatalogNavDropdown({
  label,
  categories,
  allCategories = [],
  active,
  theme = "light",
}: CatalogNavDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function close() {
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          theme === "dark"
            ? "header-paint-nav-link"
            : "link-underline inline-flex items-center gap-1 text-sm font-medium text-ink/70 transition-colors hover:text-ink",
          theme === "dark" && active && "header-paint-nav-link--active",
          theme === "light" && active && "text-ink",
        )}
        aria-expanded={open}
      >
        {label}
        <motion.svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="shrink-0 translate-y-px"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            {...panelMotion}
            className="absolute left-1/2 top-full z-50 mt-3 w-[min(92vw,22rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-ink/[0.06] bg-paper/95 shadow-panel backdrop-blur-xl"
          >
            <div className="p-3">
              <motion.div key="leagues" {...listMotion}>
                <ul className="max-h-72 space-y-1 overflow-y-auto">
                  {catalogLeagues.map((league, index) => (
                    <motion.li
                      key={league.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: index * 0.035,
                        duration: 0.2,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      <Link
                        href={buildJerseyLeagueHref(
                          league,
                          categories,
                          allCategories,
                        )}
                        onClick={close}
                        className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-paper-soft"
                      >
                        <LeagueIcon
                          src={league.icon}
                          label={league.label}
                          useInitials={league.useInitials}
                        />
                        <span className="font-medium transition-transform group-hover:translate-x-0.5">
                          {league.label}
                        </span>
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
