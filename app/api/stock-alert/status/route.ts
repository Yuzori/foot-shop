import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { isStockSubscribed } from "@/lib/stock-subscribers";

function normalizeVariantId(value: string | null): string | null {
  if (!value?.trim()) return null;
  return value.trim();
}

/** Vérifie si l'email (session ou paramètre) est inscrit à l'alerte stock. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId")?.trim() ?? "";
  const variantId = normalizeVariantId(searchParams.get("variantId"));
  const session = await getSession();
  const email = (
    searchParams.get("email")?.trim().toLowerCase() ||
    session?.email?.trim().toLowerCase() ||
    ""
  );

  if (!email || !productId) {
    return NextResponse.json({ subscribed: false });
  }

  const subscribed = await isStockSubscribed(email, productId, variantId);
  return NextResponse.json({ subscribed, email });
}
