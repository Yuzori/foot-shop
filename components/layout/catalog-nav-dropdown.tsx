"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { LeagueIcon } from "@/components/layout/league-icon";
import {
  buildCatalogHref,
  catalogAudiences,
  catalogLeagues,
  type CatalogKind,
  type CatalogNavCategories,
} from "@/config/catalog-leagues";
import { cn } from "@/lib/utils";

import type { Category } from "@/types/domain";

interface CatalogNavDropdownProps {
  kind: CatalogKind;
  label: string;
  categories: CatalogNavCategories;
  allCategories?: Category[];
  active?: boolean;
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

export function CatalogNavDropdown({
  kind,
  label,
  categories,
  allCategories = [],
  active,
}: CatalogNavDropdownProps) {
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<(typeof catalogAudiences)[number] | null>(
    null,
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
        setAudience(null);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function close() {
    setOpen(false);
    setAudience(null);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setAudience(null);
        }}
        className={cn(
          "link-underline inline-flex items-center gap-1 text-sm font-medium text-ink/70 transition-colors hover:text-ink",
          active && "text-ink",
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
            className="absolute left-1/2 top-full z-50 mt-3 w-[min(92vw,22rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-ink/10 bg-paper shadow-lift"
          >
            <div className="p-3">
              <AnimatePresence mode="wait" initial={false}>
                {!audience ? (
                  <motion.div
                    key="audience"
                    {...listMotion}
                    className="grid grid-cols-2 gap-2"
                  >
                    {catalogAudiences.map((item, index) => (
                      <motion.button
                        key={item.id}
                        type="button"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: index * 0.05,
                          duration: 0.22,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        onClick={() => setAudience(item)}
                        className="group relative overflow-hidden rounded-xl border border-ink/10 px-4 py-3.5 text-left transition-colors hover:border-ink hover:bg-paper-soft"
                      >
                        <span className="relative z-10 text-sm font-semibold">
                          {item.label}
                        </span>
                        <span
                          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/0 to-accent/10 opacity-0 transition-opacity group-hover:opacity-100"
                          aria-hidden
                        />
                      </motion.button>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div key="leagues" {...listMotion}>
                    <button
                      type="button"
                      onClick={() => setAudience(null)}
                      className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-ink/45 transition-colors hover:text-ink"
                    >
                      <motion.span
                        initial={{ x: 4 }}
                        animate={{ x: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        ←
                      </motion.span>
                      {label} · {audience.label}
                    </button>
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
                            href={buildCatalogHref(
                              kind,
                              audience.id,
                              league,
                              categories,
                              allCategories,
                            )}
                            onClick={close}
                            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-paper-soft"
                          >
                            <LeagueIcon src={league.icon} label={league.label} />
                            <span className="font-medium transition-transform group-hover:translate-x-0.5">
                              {league.label}
                            </span>
                          </Link>
                        </motion.li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
