"use client";

import { useSearchParams } from "next/navigation";

import { CatalogueView } from "@/components/catalogue/catalogue-view";
import { Container } from "@/components/ui/container";
import type { ProductCollectionKind } from "@/lib/product-collection";
import type { SortOption } from "@/types/domain";

const VALID_SORTS: SortOption[] = [
  "relevance",
  "newest",
  "price-asc",
  "price-desc",
  "name-asc",
];

const VALID_KINDS: ProductCollectionKind[] = ["jersey", "short"];

export function CatalogueClient() {
  const params = useSearchParams();
  const sortParam = params.get("sort");
  const kindParam = params.get("kind");
  const initialSort = VALID_SORTS.includes(sortParam as SortOption)
    ? (sortParam as SortOption)
    : "relevance";
  const kind = VALID_KINDS.includes(kindParam as ProductCollectionKind)
    ? (kindParam as ProductCollectionKind)
    : undefined;

  const title =
    kind === "short"
      ? "Shorts"
      : kind === "jersey"
        ? "Maillots"
        : "La boutique";

  return (
    <Container className="py-12 lg:py-16">
      <header className="mb-12 max-w-2xl">
        <p className="eyebrow mb-3">Collection</p>
        <h1 className="display-2">{title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink/55">
          {kind === "short"
            ? "Shorts officiels et éditions premium."
            : kind === "jersey"
              ? "Maillots et éditions premium."
              : "Maillots et éditions premium. Tous nos produits proviennent directement de notre catalogue officiel."}
        </p>
      </header>

      <CatalogueView initialSort={initialSort} kind={kind} />
    </Container>
  );
}
