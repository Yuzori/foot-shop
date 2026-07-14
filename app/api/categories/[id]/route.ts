import { NextResponse } from "next/server";

import { catalogLeagues } from "@/config/catalog-leagues";
import {
  catalogDivisionFromLeague,
  findAdultDivisionCategoryId,
  findKidsDivisionCategoryId,
} from "@/lib/catalog-divisions";
import {
  filterProductsByAudience,
  filterProductsByCategoryScope,
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
    : undefined;

  const category = await prestashop.getCategoryById(id);

  if (!category) {
    return NextResponse.json(
      { message: "Catégorie introuvable" },
      { status: 404 },
    );
  }

  let products = await prestashop.getCategoryProducts(id);
  const allCategories = await prestashop.getCategories();
  const isParentCategory = allCategories.some(
    (item) => item.parentId === id,
  );

  if (isParentCategory) {
    products = filterProductsByCategoryScope(products, id, allCategories);
  }

  if (leagueParam) {
    const league = catalogLeagues.find((item) => item.id === leagueParam);
    if (league) {
      const division = catalogDivisionFromLeague(league);
      const kidsBase =
        kindParam === "short"
          ? process.env.NEXT_PUBLIC_ENFANT_SHORTS_CATEGORY_ID ??
            process.env.NEXT_PUBLIC_KIDS_SHORTS_CATEGORY_ID ??
            ""
          : process.env.NEXT_PUBLIC_ENFANT_MAILLOTS_CATEGORY_ID ??
            process.env.NEXT_PUBLIC_KIDS_MAILLOTS_CATEGORY_ID ??
            "";
      const adultBase =
        kindParam === "short"
          ? process.env.NEXT_PUBLIC_SHORTS_CATEGORY_ID ?? ""
          : process.env.NEXT_PUBLIC_MAILLOTS_CATEGORY_ID ?? "";

      const divisionCategoryId =
        audienceParam === "kids"
          ? findKidsDivisionCategoryId(allCategories, kidsBase, division)
          : findAdultDivisionCategoryId(allCategories, adultBase, division);

      if (divisionCategoryId) {
        const scope = getCategoryDescendantIds(allCategories, divisionCategoryId);
        products = products.filter((product) =>
          product.categoryIds.some((cid) => scope.has(String(cid))),
        );
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
