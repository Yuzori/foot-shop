import { NextResponse } from "next/server";

import { isAdminAuthorized } from "@/lib/admin-auth";

import { filterProductsByKind, type ProductCollectionKind } from "@/lib/product-collection";
import { maybeProcessStockAlerts } from "@/lib/stock-notify";
import { maybeRunCatalogNotifications } from "@/lib/catalog-notify";

import { prestashop } from "@/services/prestashop";

import type { SortOption } from "@/types/domain";



const SORTS: SortOption[] = [

  "relevance",

  "newest",

  "price-asc",

  "price-desc",

  "name-asc",

];



const KINDS: ProductCollectionKind[] = ["jersey", "short"];



export async function GET(request: Request) {

  try {
  const { searchParams } = new URL(request.url);



  const sortParam = searchParams.get("sort");

  const sort = SORTS.includes(sortParam as SortOption)

    ? (sortParam as SortOption)

    : undefined;



  const kindParam = searchParams.get("kind");

  const kind = KINDS.includes(kindParam as ProductCollectionKind)

    ? (kindParam as ProductCollectionKind)

    : undefined;



  const query = {

    category: searchParams.get("category") ?? undefined,

    search: searchParams.get("search") ?? undefined,

    page: Number(searchParams.get("page") ?? 1) || 1,

    limit: Number(searchParams.get("limit") ?? 24) || 24,

    sort,

  };



  if (searchParams.get("debug") === "1") {

    if (process.env.NODE_ENV === "production" && !isAdminAuthorized(request)) {

      return NextResponse.json({ message: "unauthorized" }, { status: 401 });

    }

    const diagnostics = await prestashop.getProductsDiagnostics(query);

    return NextResponse.json({ query, diagnostics });

  }



  const result = await prestashop.getProducts(query);

  void maybeProcessStockAlerts().catch((err) => {
    console.error("[stock] background processing failed", err);
  });
  void maybeRunCatalogNotifications().catch((err) => {
    console.error("[notify] background catalog job failed", err);
  });

  if (result.connectionError) {
    return NextResponse.json(
      {
        message: "catalog_unavailable",
        detail: result.connectionError,
        items: [],
        total: 0,
        page: result.page,
        limit: result.limit,
        hasMore: false,
      },
      { status: 503 },
    );
  }

  if (kind) {

    const filtered = filterProductsByKind(result.items, kind);

    return NextResponse.json({

      ...result,

      items: filtered,

      total: filtered.length,

      hasMore: false,

    });

  }



  if (process.env.NODE_ENV !== "production") {

    console.info(

      `[api/products] returned ${result.items.length} items (hasMore=${result.hasMore}) for query=${JSON.stringify(query)}`,

    );

  }



  return NextResponse.json(result);

  } catch (err) {
    console.error("[api/products]", err);
    return NextResponse.json(
      {
        message: "catalog_unavailable",
        items: [],
        total: 0,
        page: 1,
        limit: 24,
        hasMore: false,
      },
      { status: 503 },
    );
  }
}


