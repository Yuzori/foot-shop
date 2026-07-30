import { NextResponse } from "next/server";

import { catalogLeagues } from "@/config/catalog-leagues";
import {
  catalogDivisionFromLeague,
  findAdultDivisionCategoryId,
  findKidsDivisionCategoryId,
} from "@/lib/catalog-divisions";
import { resolveCatalogNavCategories } from "@/lib/resolve-catalog-nav";
import {
  filterProductsByAudience,
  getCategoryDescendantIds,
} from "@/lib/catalog-tree";
import { maybeRunCatalogNotifications } from "@/lib/catalog-notify";
import { sortProducts } from "@/lib/product-sort";
import { prestashop } from "@/services/prestashop";
import type { SortOption } from "@/types/domain";

const SORTS: SortOption[] = [
  "relevance",
  "newest",
  "price-asc",
  "price-desc",
  "name-asc",
];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const audienceParam = searchParams.get("audience");
  const leagueParam = searchParams.get("league");
  const kindParam = searchParams.get("kind");
  const sortParam = searchParams.get("sort");
  const sort = SORTS.includes(sortParam as SortOption)
    ? (sortParam as SortOption)
    : "newest";

  const category = await prestashop.getCategoryById(id);

  if (!category) {
    return NextResponse.json(
      { message: "Catégorie introuvable" },
      { status: 404 },
    );
  }

  const allCategories = await prestashop.getCategories();
  const nav = resolveCatalogNavCategories(allCategories);
  const collectionRoots = new Set(
    [
      nav.maillotsCategoryId,
      nav.shortsCategoryId,
      nav.kidsMaillotsCategoryId,
      nav.kidsShortsCategoryId,
    ].filter(Boolean),
  );

  let products: Awaited<ReturnType<typeof prestashop.getCategoryProducts>>;

  if (!leagueParam && collectionRoots.has(id)) {
    const scope = getCategoryDescendantIds(allCategories, id);
    products = await prestashop.getProductsInCategoryTree(id, [...scope], 500);
  } else {
    products = await prestashop.getCategoryProducts(id);
  }

  if (leagueParam) {
    const league = catalogLeagues.find((item) => item.id === leagueParam);
    if (league) {
      const division = catalogDivisionFromLeague(league);
      const kidsBase =
        kindParam === "short"
          ? nav.kidsShortsCategoryId
          : nav.kidsMaillotsCategoryId;
      const adultBase =
        kindParam === "short" ? nav.shortsCategoryId : nav.maillotsCategoryId;

      const divisionCategoryId =
        audienceParam === "kids"
          ? league.kidsCategoryId ||
            findKidsDivisionCategoryId(allCategories, kidsBase, division)
          : league.categoryId ||
            findAdultDivisionCategoryId(allCategories, adultBase, division);

      if (divisionCategoryId) {
        const scope = getCategoryDescendantIds(allCategories, divisionCategoryId);
        products = products.filter((product) => {
          const def = String(product.defaultCategoryId ?? "").trim();
          if (def && scope.has(def)) return true;
          return product.categoryIds.some((cid) =>
            scope.has(String(cid).trim()),
          );
        });
      }
    }
  }

  if (audienceParam === "kids") {
    products = filterProductsByAudience(products, "kids");
  } else if (audienceParam === "adult") {
    products = filterProductsByAudience(products, "adult");
  }

  products = sortProducts(products, sort);

  void maybeRunCatalogNotifications().catch((err) => {
    console.error("[notify] background catalog job failed", err);
  });

  return NextResponse.json({ category, products });
}
