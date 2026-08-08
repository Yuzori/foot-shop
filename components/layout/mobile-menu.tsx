"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { LeagueIcon } from "@/components/layout/league-icon";
import {
  buildJerseyLeagueHref,
  buildShortsCatalogHref,
  catalogLeagues,
  type CatalogNavCategories,
} from "@/config/catalog-leagues";
import { CloseIcon, HeartIcon, TrophyIcon } from "@/components/layout/icons";
import { primaryNav, routes } from "@/config/site";
import { worldCupConfig } from "@/config/world-cup";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useCatalogNav } from "@/hooks/use-catalog-nav";
import { useHydrated } from "@/hooks/use-hydrated";
import { drawerPanelMotion, overlayMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useFavoritesStore } from "@/store/favorites-store";
import { useUIStore } from "@/store/ui-store";
import { useWorldCupNavStore } from "@/store/world-cup-nav-store";

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

const accountLinks = [
  { label: "Connexion", href: routes.login },
  { label: "Mon compte", href: routes.account },
  { label: "Suivi de commande", href: routes.tracking },
];

export function MobileMenu({ open, onClose }: MobileMenuProps) {
  const catalogNav = useCatalogNav();
  const hydrated = useHydrated();
  const pathname = usePathname();
  const favCount = useFavoritesStore((s) => s.ids.length);
  const openFavorites = useUIStore((s) => s.openFavorites);
  const worldCupProductActive = useWorldCupNavStore((s) => s.productActive);
  const worldCupActive =
    pathname.includes(`/categories/${worldCupConfig.categoryId}`) ||
    worldCupProductActive;

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          {...overlayMotion}
          className="fixed inset-0 z-[60] lg:hidden"
        >
          <div
            className="absolute inset-0 bg-ink/30 backdrop-blur-md touch-none"
            onClick={onClose}
            aria-hidden
          />

          <motion.nav
            {...drawerPanelMotion}
            className="absolute right-0 top-0 flex h-[100dvh] w-[85%] max-w-sm flex-col overflow-hidden bg-paper will-change-transform drawer-safe-top drawer-safe-bottom"
            aria-label="Menu principal"
          >
            <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-5 sm:px-6 sm:pt-6">
              <span className="text-lg font-semibold tracking-tightest">Menu</span>
              <button
                onClick={onClose}
                aria-label="Fermer le menu"
                className="overlay-close text-ink/60 transition-colors hover:bg-paper-soft hover:text-ink"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 [-webkit-overflow-scrolling:touch]">
              <div className="flex flex-col gap-1">
                {worldCupConfig.enabled ? (
                <Link
                  href={worldCupConfig.href}
                  onClick={onClose}
                  className={cn(
                    "group relative mb-4 flex w-full items-center justify-center gap-2 overflow-hidden rounded-full border px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-all duration-300",
                    "backdrop-blur-md hover:scale-[1.02] hover:-translate-y-px active:scale-[0.98]",
                    worldCupActive
                      ? "border-white/40 bg-accent text-ink ring-2 ring-amber-300/60"
                      : "border-white/35 bg-ink text-paper hover:border-white/40 hover:bg-accent hover:text-ink",
                  )}
                  style={{
                    boxShadow: worldCupActive
                      ? "0 10px 28px -8px rgba(102,186,255,0.55), inset 0 1px 0 rgba(255,255,255,0.45)"
                      : "0 10px 28px -8px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.28)",
                  }}
                >
                  <span
                    className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/25 to-transparent"
                    aria-hidden
                  />
                  <TrophyIcon className="relative h-4 w-4 shrink-0 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" />
                  <span className="relative">{worldCupConfig.label}</span>
                </Link>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    openFavorites();
                    onClose();
                  }}
                  className={cn(
                    "mb-4 flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-all",
                    favCount > 0
                      ? "border-accent/35 bg-accent-muted/80 shadow-sm hover:border-accent/50"
                      : "border-ink/10 bg-paper-soft hover:border-ink/20",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                      favCount > 0 ? "bg-accent text-ink" : "bg-paper text-ink/45",
                    )}
                  >
                    <HeartIcon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold tracking-tight">
                      Mes favoris
                    </span>
                    <span className="mt-0.5 block text-xs text-ink/55">
                      {hydrated && favCount > 0
                        ? `${favCount} article${favCount > 1 ? "s" : ""} enregistré${favCount > 1 ? "s" : ""}`
                        : "Retrouvez les maillots que vous aimez"}
                    </span>
                  </span>
                  {hydrated && favCount > 0 ? (
                    <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-ink px-2 text-xs font-bold text-paper">
                      {favCount > 99 ? "99+" : favCount}
                    </span>
                  ) : null}
                </button>

                <MobileCatalogGroup
                  label={catalogNav.maillots.label}
                  kind="jersey"
                  categories={catalogNav.categories}
                  allCategories={catalogNav.allCategories}
                  onClose={onClose}
                />
                <MobileCatalogGroup
                  label={catalogNav.shorts.label}
                  kind="short"
                  categories={catalogNav.categories}
                  allCategories={catalogNav.allCategories}
                  onClose={onClose}
                />

                {primaryNav.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    prefetch={false}
                    onClick={onClose}
                    className="border-b border-ink/5 py-4 text-2xl font-medium tracking-tightest"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="shrink-0 border-t border-ink/8 px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-3">
                {accountLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onClose}
                    className="text-sm text-ink/60 transition-colors hover:text-ink"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </motion.nav>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function MobileCatalogGroup({
  label,
  kind,
  categories,
  allCategories = [],
  onClose,
}: {
  label: string;
  kind: "jersey" | "short";
  categories: CatalogNavCategories;
  allCategories?: import("@/types/domain").Category[];
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (kind === "short") {
    return (
      <Link
        href={buildShortsCatalogHref(categories)}
        onClick={onClose}
        className="border-b border-ink/5 py-4 text-2xl font-medium tracking-tightest"
      >
        {label}
      </Link>
    );
  }

  return (
    <div className="border-b border-ink/5 py-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-3 text-2xl font-medium tracking-tightest"
      >
        {label}
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-lg text-ink/40"
        >
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <ul className="space-y-2 pb-4 pl-1">
              {catalogLeagues.map((league) => (
                <li key={league.id}>
                  <Link
                    href={buildJerseyLeagueHref(
                      league,
                      categories,
                      allCategories,
                    )}
                    onClick={onClose}
                    className="flex items-center gap-2 text-sm text-ink/75"
                  >
                    <LeagueIcon
                      src={league.icon}
                      label={league.label}
                      useInitials={league.useInitials}
                    />
                    {league.label}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
