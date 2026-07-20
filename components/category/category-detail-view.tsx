"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { SortSelect } from "@/components/catalogue/sort-select";
import { ProductGrid } from "@/components/product/product-grid";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { catalogLeagues } from "@/config/catalog-leagues";
import { routes } from "@/config/site";
import { useCatalogNav } from "@/hooks/use-catalog-nav";
import { useCategory } from "@/hooks/use-categories";
import { getDivisionForCategoryId } from "@/lib/catalog-divisions";
import { filterProductsByAudience } from "@/lib/catalog-tree";
import type { Product, SortOption } from "@/types/domain";
import {
  collectionKindFromCategory,
  filterProductsByKind,
  type ProductCollectionKind,
} from "@/lib/product-collection";

const VALID_KINDS: ProductCollectionKind[] = ["jersey", "short"];
const VALID_AUDIENCES = ["adult", "kids"] as const;

function applyKindFilter(
  products: Product[],
  kind: ProductCollectionKind | null,
): Product[] {
  if (!kind) return products;
  const filtered = filterProductsByKind(products, kind);
  return filtered.length > 0 ? filtered : products;
}

function audienceLabel(audience: "adult" | "kids" | null): string | null {
  if (audience === "kids") return "Enfant";
  if (audience === "adult") return "Adulte";
  return null;
}

/** A single category page: header + filtered catalogue. */
export function CategoryDetailView({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const kindParam = searchParams.get("kind");
  const audienceParam = searchParams.get("audience");
  const leagueParam = searchParams.get("league");
  const forcedKind = VALID_KINDS.includes(kindParam as ProductCollectionKind)
    ? (kindParam as ProductCollectionKind)
    : null;
  const audience = VALID_AUDIENCES.includes(
    audienceParam as (typeof VALID_AUDIENCES)[number],
  )
    ? (audienceParam as (typeof VALID_AUDIENCES)[number])
    : null;

  const [sort, setSort] = useState<SortOption>("relevance");

  const catalogNav = useCatalogNav();
  const { data, isLoading, isError } = useCategory(id, {
    audience,
    kind: forcedKind,
    league: leagueParam,
    sort,
  });
  const category = data?.category;
  const rawProducts = data?.products ?? [];

  const leagueFromUrl = catalogLeagues.find((item) => item.id === leagueParam);
  const divisionFromCategory = getDivisionForCategoryId(
    id,
    catalogNav.allCategories,
  );

  const collectionKind =
    forcedKind ??
    (category
      ? category.id === catalogNav.shorts.categoryId ||
          category.id === catalogNav.kidsShorts.categoryId
        ? "short"
        : category.id === catalogNav.maillots.categoryId ||
            category.id === catalogNav.kidsMaillots.categoryId
          ? "jersey"
          : collectionKindFromCategory(
              category.name,
              category.id,
              catalogNav.categories.maillotsCategoryId,
              catalogNav.categories.shortsCategoryId,
              catalogNav.categories.kidsMaillotsCategoryId,
              catalogNav.categories.kidsShortsCategoryId,
            )
      : null);

  const products = useMemo(() => {
    let list = applyKindFilter(rawProducts, collectionKind);
    if (audience === "kids") {
      list = filterProductsByAudience(list, "kids");
    } else if (audience === "adult") {
      list = filterProductsByAudience(list, "adult");
    }
    return list;
  }, [audience, collectionKind, rawProducts]);

  const pageTitle = useMemo(() => {
    const aud = audienceLabel(audience);
    const divisionLabel =
      leagueFromUrl?.label ?? divisionFromCategory?.label ?? null;

    if (divisionLabel && aud) return `${divisionLabel} · ${aud}`;
    if (divisionLabel) return divisionLabel;

    if (collectionKind === "short") {
      return audience === "kids" ? "Shorts · Enfant" : "Shorts";
    }
    if (collectionKind === "jersey") {
      return audience === "kids" ? "Maillots · Enfant" : "Maillots";
    }
    return category?.name ?? "";
  }, [
    audience,
    category?.name,
    collectionKind,
    divisionFromCategory?.label,
    leagueFromUrl?.label,
  ]);

  const showCategorySubtitle = useMemo(() => {
    if (!category?.name || category.name === pageTitle) return false;
    if (pageTitle.includes(category.name)) return false;
    if (audience === "adult" && /enfant/i.test(category.name)) return false;
    return true;
  }, [audience, category?.name, pageTitle]);

  if (isLoading) {
    return (
      <Container className="py-12 lg:py-16">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-4 h-4 w-96" />
      </Container>
    );
  }

  if (isError || !category) {
    return (
      <Container className="py-12">
        <EmptyState
          title="Catégorie introuvable"
          description="Cette catégorie n'existe pas ou n'est plus disponible."
          action={{ label: "Explorer les collections", href: routes.categories }}
        />
      </Container>
    );
  }

  const emptyTitle =
    collectionKind === "short"
      ? "Aucun short pour le moment"
      : collectionKind === "jersey"
        ? "Aucun maillot pour le moment"
        : "Aucun produit dans cette catégorie";

  return (
    <Container className="py-12 lg:py-16">
      <header className="mb-12 max-w-2xl">
        <Link
          href={routes.catalogHub({
            kind: collectionKind ?? undefined,
            audience: audience ?? undefined,
          })}
          className="mb-6 inline-flex items-center gap-1 text-xs font-medium text-ink/45 transition-colors hover:text-ink"
        >
          ← Changer de division
        </Link>
        <p className="eyebrow mb-3">Collection</p>
        <h1 className="display-2">{pageTitle}</h1>
        {showCategorySubtitle ? (
          <p className="mt-3 text-sm font-medium text-ink/55">{category.name}</p>
        ) : null}
      </header>

      {products.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description="Les produits correspondants apparaîtront ici dès publication."
          action={{
            label: "Changer de division",
            href: routes.catalogHub({
              kind: collectionKind ?? undefined,
              audience: audience ?? undefined,
            }),
          }}
        />
      ) : (
        <>
          <div className="mb-10 flex items-center justify-between gap-4">
            <p className="text-sm text-ink/50">
              {products.length} produit{products.length > 1 ? "s" : ""}
            </p>
            <SortSelect value={sort} onChange={setSort} />
          </div>
          <ProductGrid products={products} />
        </>
      )}
    </Container>
  );
}
