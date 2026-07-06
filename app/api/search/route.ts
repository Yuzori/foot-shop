import { NextResponse } from "next/server";

import { prestashop } from "@/services/prestashop";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  const items = await prestashop.searchProducts(query, 24);
  return NextResponse.json({ items, query });
}
