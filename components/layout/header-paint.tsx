"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CatalogNavDropdown } from "@/components/layout/catalog-nav-dropdown";
import {
  BagIcon,
  HeartIcon,
  SearchIcon,
  TrophyIcon,
  UserIcon,
} from "@/components/layout/icons";
import { Logo } from "@/components/layout/logo";
import { MobileMenuIcon } from "@/components/layout/mobile-menu-icon";
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

/** Header sombre — style maquette (brush, peinture, dégradés). */
export function HeaderPaint() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const menuOpen = useUIStore((s) => s.menuOpen);
  const setMenuOpen = useUIStore((s) => s.setMenuOpen);
  const cartCount = useCartStore(cartSelectors.count);
  const favCount = useFavoritesStore((s) => s.ids.length);
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

  return (
    <>
      <header className="header-paint sticky top-0 z-40 border-b border-white/[0.06] bg-[#050505]">
        <div className="header-paint__splatter pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="header-paint__stroke header-paint__stroke--1" />
          <div className="header-paint__stroke header-paint__stroke--2" />
          <div className="header-paint__stroke header-paint__stroke--3" />
        </div>

        <Container className="relative flex h-[4.25rem] items-center lg:h-[5rem]">
          <button
            type="button"
            className="header-paint-icon-btn relative !mr-0.5 lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <MobileMenuIcon ringColor="#050505" />
          </button>

          <Link
            href={routes.home}
            aria-label="Accueil"
            className={cn(
              "header-paint-logo shrink-0 transition-transform duration-300 hover:scale-[1.02]",
              "lg:static lg:translate-x-0",
              "absolute left-1/2 -translate-x-1/2 lg:left-auto",
            )}
          >
            <Logo
              priority
              variant="footer"
              className="h-11 w-auto sm:h-12 lg:h-[3.75rem]"
            />
          </Link>

          <nav className="ml-6 hidden flex-1 items-center justify-center gap-7 xl:gap-9 lg:flex">
            <CatalogNavDropdown
              theme="dark"
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
                "header-paint-nav-link",
                ((Boolean(catalogNav.shorts.categoryId) &&
                  pathname.includes(`/categories/${catalogNav.shorts.categoryId}`)) ||
                  pathname.includes("kind=short")) &&
                  "header-paint-nav-link--active",
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
                  "header-paint-nav-link",
                  pathname === link.href && "header-paint-nav-link--active",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
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
              className="hidden sm:flex"
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
        "header-paint-wc-btn group mr-1 hidden lg:inline-flex",
        active && "header-paint-wc-btn--active",
      )}
    >
      <TrophyIcon className="relative h-4 w-4 shrink-0 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" />
      <span className="relative">{label}</span>
    </Link>
  );
}

function Badge({ badge }: { badge?: number }) {
  if (!badge || badge <= 0) return null;
  return (
    <span className="absolute right-0.5 top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-ink shadow-glow-sm">
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
      className={cn("header-paint-icon-btn", className)}
    >
      {children}
      <Badge badge={badge} />
    </button>
  );
}
