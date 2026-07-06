"use client";

import { ProductGrid } from "@/components/product/product-grid";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { routes } from "@/config/site";
import { useHydrated } from "@/hooks/use-hydrated";
import { useFavoriteProducts } from "@/hooks/use-favorite-products";

export function FavoritesView() {
  const hydrated = useHydrated();
  const { products, isLoading, ids } = useFavoriteProducts();

  if (!hydrated) {
    return (
      <Container className="py-24">
        <span className="sr-only">Chargement</span>
      </Container>
    );
  }

  return (
    <Container className="py-12">
      <h1 className="display-2 mb-10">Favoris</h1>

      {ids.length === 0 ? (
        <EmptyState
          title="Aucun favori"
          description="Cliquez sur le cœur d'un produit pour le retrouver ici."
          action={{ label: "Explorer la boutique", href: routes.catalogue }}
        />
      ) : (
        <ProductGrid
          products={products}
          loading={isLoading}
          skeletonCount={ids.length}
        />
      )}
    </Container>
  );
}
