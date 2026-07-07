import { NextResponse } from "next/server";

import {
  filterProductsByAudience,
  filterProductsByCategoryScope,
} from "@/lib/catalog-tree";
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

  if (audienceParam === "kids") {
    products = filterProductsByAudience(products, "kids");
  } else if (audienceParam === "adult") {
    products = filterProductsByAudience(products, "adult");
  }

  products = sortProducts(products, sort);

  return NextResponse.json({ category, products });
}
