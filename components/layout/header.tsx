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

export function Header() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const [scrolled, setScrolled] = useState(false);
  const menuOpen = useUIStore((s) => s.menuOpen);
  const setMenuOpen = useUIStore((s) => s.setMenuOpen);
  const cartCount = useCartStore(cartSelectors.count);
  const favCount = useFavoritesStore((s) => s.ids.length);
  const openCart = useUIStore((s) => s.openCart);
  const openFavorites = useUIStore((s) => s.openFavorites);
  const openAccount = useUIStore((s) => s.openAccount);
  const openSearch = useUIStore((s) => s.openSearch);
  const catalogNav = useCatalogNav();

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
            ? "border-b border-ink/5 bg-paper/80 backdrop-blur-xl"
            : "bg-transparent",
        )}
      >
        <Container className="relative flex h-16 items-center lg:h-[4.5rem]">
          <button
            className="lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <MenuIcon />
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
              kind="jersey"
              label={catalogNav.maillots.label}
              categories={catalogNav.categories}
              allCategories={catalogNav.allCategories}
              active={
                [catalogNav.maillots.categoryId, catalogNav.kidsMaillots.categoryId]
                  .filter(Boolean)
                  .some((id) => pathname.includes(`/categories/${id}`)) ||
                pathname.includes("kind=jersey")
              }
            />
            <CatalogNavDropdown
              kind="short"
              label={catalogNav.shorts.label}
              categories={catalogNav.categories}
              allCategories={catalogNav.allCategories}
              active={
                [catalogNav.shorts.categoryId, catalogNav.kidsShorts.categoryId]
                  .filter(Boolean)
                  .some((id) => pathname.includes(`/categories/${id}`)) ||
                pathname.includes("kind=short")
              }
            />
            {primaryNav.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                className={cn(
                  "link-underline text-sm font-medium text-ink/70 transition-colors hover:text-ink",
                  pathname === link.href && "text-ink",
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
                active={pathname === worldCupConfig.href}
              />
            ) : null}
            <IconButton label="Recherche" onClick={openSearch}>
              <SearchIcon />
            </IconButton>
            <IconButton label="Favoris" onClick={openFavorites} badge={hydrated ? favCount : 0}>
              <HeartIcon />
            </IconButton>
            <IconButton
              label="Compte"
              onClick={openAccount}
              className="hidden sm:flex"
            >
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
        "group relative mr-1 hidden items-center gap-2 overflow-hidden rounded-full bg-ink px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-paper transition-[transform,background-color,box-shadow] duration-300 ease-premium lg:flex",
        "hover:scale-[1.04] hover:bg-accent active:scale-[0.97]",
        "hover:shadow-[0_10px_28px_-6px_rgba(226,0,26,0.45)]",
        active && "bg-accent ring-2 ring-accent/30 ring-offset-2",
      )}
    >
      <span
        className="absolute inset-0 -translate-x-full bg-paper/10 transition-transform duration-500 ease-premium group-hover:translate-x-full"
        aria-hidden
      />
      <TrophyIcon className="relative h-4 w-4 shrink-0 transition-transform duration-300 ease-premium group-hover:-rotate-12 group-hover:scale-110" />
      <span className="relative">{label}</span>
    </Link>
  );
}

const iconBase =
  "relative flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-paper-soft";

function Badge({ badge }: { badge?: number }) {
  if (!badge || badge <= 0) return null;
  return (
    <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
      {badge > 99 ? "99+" : badge}
    </span>
  );
}

function IconLink({
  href,
  label,
  children,
  badge,
  className,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
  badge?: number;
  className?: string;
}) {
  return (
    <Link href={href} aria-label={label} className={cn(iconBase, className)}>
      {children}
      <Badge badge={badge} />
    </Link>
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
