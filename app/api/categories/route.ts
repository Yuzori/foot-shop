import { NextResponse } from "next/server";

import { prestashop } from "@/services/prestashop";

export async function GET() {
  try {
    const { items, error } = await prestashop.fetchCategories();

    if (error) {
      return NextResponse.json(
        { message: "catalog_unavailable", detail: error, items: [] },
        { status: 503 },
      );
    }

    return NextResponse.json({ items });
  } catch (err) {
    console.error("[api/categories]", err);
    return NextResponse.json(
      { message: "catalog_unavailable", items: [] },
      { status: 503 },
    );
  }
}
