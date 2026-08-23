import { NextResponse } from "next/server";

import { prestashop } from "@/services/prestashop";

/** Charge plusieurs produits en une requête (favoris, etc.). */
export async function POST(request: Request) {
  let body: { ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid_body" }, { status: 400 });
  }

  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.map((id) => String(id).trim()).filter(Boolean))].slice(
        0,
        100,
      )
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ items: [], unavailable: [] as string[] });
  }

  if (!prestashop.isConfigured) {
    return NextResponse.json({ message: "catalog_unavailable" }, { status: 503 });
  }

  try {
    const items = await prestashop.getProductsByIds(ids);
    const found = new Set(items.map((product) => product.id));
    const unavailable = ids.filter((id) => !found.has(id));

    return NextResponse.json({ items, unavailable });
  } catch (error) {
    console.error("[api/products/batch]", error);
    return NextResponse.json({ message: "catalog_unavailable" }, { status: 503 });
  }
}
