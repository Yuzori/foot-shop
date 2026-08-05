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
    : "newest";



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

  // Si on filtre par kind (maillot/short), élargir le pool avant filtrage
  // sinon limit=4 ne ramène souvent que des maillots → shorts vides.
  const fetchQuery = kind
    ? { ...query, limit: Math.max(query.limit * 25, 80) }
    : query;

  const result = await prestashop.getProducts(fetchQuery);

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
    const page = query.page;
    const limit = query.limit;
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);
    return NextResponse.json({
      ...result,
      items,
      total: filtered.length,
      page,
      limit,
      hasMore: start + limit < filtered.length,
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


