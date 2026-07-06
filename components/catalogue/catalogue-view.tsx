"use client";

import { useState } from "react";

import { SortSelect } from "@/components/catalogue/sort-select";
import { ProductGrid } from "@/components/product/product-grid";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { routes } from "@/config/site";
import { useProducts } from "@/hooks/use-products";
import type { ProductCollectionKind } from "@/lib/product-collection";
import type { SortOption } from "@/types/domain";

interface CatalogueViewProps {
  category?: string;
  search?: string;
  kind?: ProductCollectionKind;
  initialSort?: SortOption;
}

const PAGE_SIZE = 24;

/**
 * Full catalogue browser: sort + progressive "load more".
 * Reusable for the main catalogue and for category pages.
 */
export function CatalogueView({
  category,
  search,
  kind,
  initialSort = "relevance",
}: CatalogueViewProps) {
  const [sort, setSort] = useState<SortOption>(initialSort);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const { data, isLoading, isFetching, isError } = useProducts({
    category,
    search,
    kind,
    sort,
    limit,
    page: 1,
  });

  const products = data?.items ?? [];
  const hasMore = data?.hasMore ?? false;
  const showEmpty = !isLoading && products.length === 0;

  return (
    <div>
      <div className="mb-10 flex items-center justify-between gap-4">
        <p className="text-sm text-ink/50">
          {isLoading ? "Chargement…" : `${products.length} produit${products.length > 1 ? "s" : ""}`}
        </p>
        <SortSelect
          value={sort}
          onChange={(value) => {
            setSort(value);
            setLimit(PAGE_SIZE);
          }}
        />
      </div>

      {showEmpty ? (
        <EmptyState
          title={isError ? "Catalogue indisponible" : "Aucun produit trouvé"}
          description={
            isError
              ? "La connexion au back office a échoué. Réessayez plus tard."
              : search
                ? `Aucun résultat pour « ${search} ».`
                : "Aucun produit n'est disponible dans cette sélection pour le moment."
          }
          action={{ label: "Retour à la boutique", href: routes.catalogue }}
        />
      ) : (
        <>
          <ProductGrid products={products} loading={isLoading} skeletonCount={limit > 12 ? 12 : limit} />

          {hasMore ? (
            <div className="mt-16 flex justify-center">
              <Button
                variant="outline"
                size="lg"
                disabled={isFetching}
                onClick={() => setLimit((l) => l + PAGE_SIZE)}
              >
                {isFetching ? <Spinner className="h-4 w-4" /> : "Charger plus"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
