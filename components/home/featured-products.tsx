"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ArrowIcon } from "@/components/layout/icons";
import { Reveal } from "@/components/motion/reveal";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { ProductCard } from "@/components/product/product-card";
import { ProductGrid } from "@/components/product/product-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { Container } from "@/components/ui/container";
import { useCatalogNav } from "@/hooks/use-catalog-nav";
import { useProducts } from "@/hooks/use-products";
import { filterProductsByKind } from "@/lib/product-collection";
import { BRAND_BUTTON_BASE, brandButtonStyle } from "@/lib/brand-button";
import { toImageAccent } from "@/lib/image-accent-client";
import { cn } from "@/lib/utils";

const siteAccent = toImageAccent();

import type { Product } from "@/types/domain";

type DropTab = "jersey" | "short";

const ease = [0.16, 1, 0.3, 1] as const;

function CollectionLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="group relative inline-flex items-center gap-2 text-sm font-semibold"
    >
      <span className="text-ink transition-opacity duration-500 ease-out group-hover:opacity-0">
        Explorer la collection
      </span>
      <span
        className="absolute left-0 text-accent opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100"
        aria-hidden
      >
        Explorer la collection
      </span>
      <ArrowIcon className="relative shrink-0 text-ink transition-[color,transform,opacity] duration-500 ease-out group-hover:translate-x-1 group-hover:text-accent" />
    </Link>
  );
}

function FeaturedGrid({ products }: { products: Product[] }) {
  return (
    <Stagger className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product, i) => (
        <StaggerItem key={product.id}>
          <ProductCard product={product} priority={i < 4} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}

/** Derniers arrivages — layout éditorial avec onglets (évite la succession de titres). */
export function FeaturedProducts() {
  const catalogNav = useCatalogNav();
  const [tab, setTab] = useState<DropTab>("jersey");

  const productsQuery = useProducts({
    sort: "newest",
    limit: 120,
  });

  const jerseys = useMemo(
    () => filterProductsByKind(productsQuery.data?.items ?? [], "jersey").slice(0, 4),
    [productsQuery.data],
  );
  const shorts = useMemo(
    () => filterProductsByKind(productsQuery.data?.items ?? [], "short").slice(0, 4),
    [productsQuery.data],
  );

  const isLoading = productsQuery.isLoading;
  const isError = productsQuery.isError;

  const activeProducts = tab === "jersey" ? jerseys : shorts;
  const activeHref =
    tab === "jersey" ? catalogNav.maillots.href : catalogNav.shorts.href;
  const activeEmpty =
    tab === "jersey"
      ? "Aucun maillot pour le moment"
      : "Aucun short pour le moment";

  if (!isLoading && isError) {
    return (
      <section className="border-y border-ink/6 bg-paper-soft/35">
        <Container className="py-24">
          <EmptyState
            title="Catalogue momentanément indisponible"
            description="Impossible de joindre la boutique pour le moment. Vérifiez que PrestaShop est démarré, puis rechargez la page."
          />
        </Container>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden border-y border-ink/6 bg-paper-soft/35">
      <div
        className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-accent/5 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-ink/[0.03] blur-3xl"
        aria-hidden
      />

      <Container className="relative py-20 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.55fr)] lg:items-start lg:gap-16">
          <Reveal className="lg:sticky lg:top-28">
            <p className="eyebrow text-accent">Fresh drops</p>
            <h2 className="display-2 mt-4 max-w-sm">Derniers arrivages</h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink/55">
              Les pièces les plus récentes de la saison, sélectionnées pour vous.
              Basculez entre maillots et shorts sans quitter la page.
            </p>

            <div
              className="mt-8 inline-flex w-fit max-w-full gap-1 self-start rounded-full border border-ink/10 bg-paper p-1 shadow-sm"
              role="tablist"
              aria-label="Type de produit"
            >
              {(
                [
                  ["jersey", "Maillots"],
                  ["short", "Shorts"],
                ] as const
              ).map(([id, label]) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(id)}
                    className={cn(
                      "relative shrink-0 rounded-full px-5 py-2.5 text-sm transition-all duration-300",
                      active
                        ? cn(BRAND_BUTTON_BASE, "normal-case !shadow-lg")
                        : "font-semibold text-ink/55 hover:text-ink",
                    )}
                    style={active ? brandButtonStyle(siteAccent) : undefined}
                  >
                    {active ? (
                      <span
                        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/35 to-transparent"
                        aria-hidden
                      />
                    ) : null}
                    <span className="relative z-10">{label}</span>
                  </button>
                );
              })}
            </div>
          </Reveal>

          <Reveal delay={0.08} className="flex min-w-0 flex-col">
            {(isLoading || activeProducts.length > 0) ? (
              <div className="mb-5 flex justify-end sm:mb-6">
                <CollectionLink href={activeHref} />
              </div>
            ) : null}

            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.32, ease }}
              >
                {!isLoading && activeProducts.length === 0 ? (
                  <EmptyState
                    title={activeEmpty}
                    description="Revenez bientôt ou parcourez le catalogue complet."
                    action={{ label: "Voir le catalogue", href: activeHref }}
                  />
                ) : (
                  <>
                    {isLoading ? (
                      <ProductGrid
                        products={activeProducts}
                        loading
                        skeletonCount={4}
                      />
                    ) : (
                      <FeaturedGrid products={activeProducts} />
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
