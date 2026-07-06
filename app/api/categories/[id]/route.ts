import { NextResponse } from "next/server";

import {
  filterProductsByAudience,
  filterProductsByCategoryScope,
} from "@/lib/catalog-tree";
import { prestashop } from "@/services/prestashop";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const audienceParam = new URL(request.url).searchParams.get("audience");

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

  return NextResponse.json({ category, products });
}
