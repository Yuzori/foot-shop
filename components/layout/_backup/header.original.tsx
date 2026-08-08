"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { CatalogNavDropdown } from "@/components/layout/catalog-nav-dropdown";
import {
  BagIcon,
  HeartIcon,
  MenuIcon,
  SearchIcon,
  TrophyIcon,
  UserIcon,
} from "@/components/layout/icons";
import { Logo } from "@/components/layout/logo";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { Container } from "@/components/ui/container";
import { primaryNav, routes } from "@/config/site";
import { worldCupConfig } from "@/config/world-cup";
import { useCatalogNav } from "@/hooks/use-catalog-nav";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";
import { cartSelectors, useCartStore } from "@/store/cart-store";
import { useFavoritesStore } from "@/store/favorites-store";
import { useUIStore } from "@/store/ui-store";
import { useWorldCupNavStore } from "@/store/world-cup-nav-store";

export function Header() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const [scrolled, setScrolled] = useState(false);
  const menuOpen = useUIStore((s) => s.menuOpen);
  const setMenuOpen = useUIStore((s) => s.setMenuOpen);
  const cartCount = useCartStore(cartSelectors.count);
  const favCount = useFavoritesStore((s) => s.ids.length);
  const hasNewFavorite = useFavoritesStore((s) => s.hasNewFavorite);
  const openCart = useUIStore((s) => s.openCart);
  const openFavorites = useUIStore((s) => s.openFavorites);
  const openAccount = useUIStore((s) => s.openAccount);
  const openSearch = useUIStore((s) => s.openSearch);
  const catalogNav = useCatalogNav();
  const worldCupProductActive = useWorldCupNavStore((s) => s.productActive);
  const worldCupCategoryActive = pathname.includes(
    `/categories/${worldCupConfig.categoryId}`,
  );
  const worldCupActive = worldCupCategoryActive || worldCupProductActive;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 transition-all duration-500",
          scrolled
            ? "border-b border-ink/[0.06] bg-paper/90 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.08)] backdrop-blur-md"
            : "bg-paper/40 backdrop-blur-sm",
        )}
      >
        <Container className="relative flex h-16 items-center lg:h-[4.5rem]">
          <button
            type="button"
            className="relative lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <MenuIcon />
            {hydrated && hasNewFavorite ? (
              <span
                className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_0_2px_var(--color-paper)]"
                aria-hidden
              />
            ) : null}
          </button>

          <Link
            href={routes.home}
            aria-label="Accueil"
            className={cn(
              "shrink-0",
              "lg:static lg:translate-x-0",
              "absolute left-1/2 -translate-x-1/2 lg:left-auto",
            )}
          >
            <Logo priority className="h-12 w-auto sm:h-14 lg:h-[4.25rem]" />
          </Link>

          <nav className="ml-8 hidden flex-1 items-center justify-center gap-8 lg:flex">
            <CatalogNavDropdown
              label={catalogNav.maillots.label}
              categories={catalogNav.categories}
              allCategories={catalogNav.allCategories}
              active={
                (Boolean(catalogNav.maillots.categoryId) &&
                  pathname.includes(`/categories/${catalogNav.maillots.categoryId}`)) ||
                pathname.includes("kind=jersey")
              }
            />
            <Link
              href={catalogNav.shorts.href}
              prefetch={false}
              className={cn(
                "link-underline text-sm font-medium text-ink/65 transition-colors hover:text-ink",
                (Boolean(catalogNav.shorts.categoryId) &&
                  pathname.includes(`/categories/${catalogNav.shorts.categoryId}`)) ||
                  pathname.includes("kind=short")
                  ? "text-ink after:scale-x-100"
                  : "",
              )}
            >
              {catalogNav.shorts.label}
            </Link>
            {primaryNav.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                className={cn(
                  "link-underline text-sm font-medium text-ink/65 transition-colors hover:text-ink",
                  pathname === link.href && "text-ink after:scale-x-100",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="relative ml-auto shrink-0">
            <div className="header-cart-halo pointer-events-none absolute -right-3 top-1/2 h-14 w-28 -translate-y-1/2 sm:-right-4 sm:h-16 sm:w-32" aria-hidden />
            <div className="relative z-10 flex items-center gap-0.5 sm:gap-1">
            {worldCupConfig.enabled ? (
              <WorldCupNavLink
                href={worldCupConfig.href}
                label={worldCupConfig.label}
                active={worldCupActive}
              />
            ) : null}
            <IconButton label="Recherche" onClick={openSearch}>
              <SearchIcon />
            </IconButton>
            <IconButton
              label="Favoris"
              onClick={openFavorites}
              badge={hydrated ? favCount : 0}
            >
              <HeartIcon />
            </IconButton>
            <IconButton label="Compte" onClick={openAccount}>
              <UserIcon />
            </IconButton>
            <IconButton
              label="Panier"
              onClick={openCart}
              badge={hydrated ? cartCount : 0}
            >
              <BagIcon />
            </IconButton>
            </div>
          </div>
        </Container>
      </header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

function WorldCupNavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative mr-1 hidden items-center gap-2 overflow-hidden rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition-all duration-300 ease-premium lg:inline-flex",
        "backdrop-blur-md hover:scale-[1.04] hover:-translate-y-px active:scale-[0.97]",
        active
          ? "border-white/40 bg-accent text-ink ring-2 ring-amber-300/60 ring-offset-2 ring-offset-paper"
          : "border-white/35 bg-ink text-paper hover:border-white/40 hover:bg-accent hover:text-ink",
      )}
      style={
        active
          ? {
              boxShadow:
                "0 10px 28px -8px rgba(102,186,255,0.55), inset 0 1px 0 rgba(255,255,255,0.45)",
              textShadow: "0 1px 2px rgba(0,0,0,0.12)",
            }
          : {
              boxShadow:
                "0 10px 28px -8px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.28)",
              textShadow: "0 1px 2px rgba(0,0,0,0.28)",
            }
      }
    >
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/25 to-transparent opacity-90"
        aria-hidden
      />
      <TrophyIcon className="relative h-4 w-4 shrink-0 transition-transform duration-300 ease-premium group-hover:-rotate-12 group-hover:scale-110" />
      <span className="relative">{label}</span>
    </Link>
  );
}

const iconBase =
  "relative flex h-10 w-10 items-center justify-center rounded-full text-ink transition-all duration-300 hover:bg-accent-muted hover:text-accent-dark";

function Badge({ badge }: { badge?: number }) {
  if (!badge || badge <= 0) return null;
  return (
    <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-ink shadow-glow-sm">
      {badge > 99 ? "99+" : badge}
    </span>
  );
}

function IconButton({
  label,
  onClick,
  children,
  badge,
  className,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(iconBase, className)}
    >
      {children}
      <Badge badge={badge} />
    </button>
  );
}
