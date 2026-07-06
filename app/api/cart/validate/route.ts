import { NextResponse } from "next/server";

import { validateCartLinesDetailed } from "@/lib/cart-validation";

/** POST — vérifie le panier côté serveur (stock + produits actifs). */
export async function POST(request: Request) {
  let body: {
    lines?: {
      productId: string;
      variantId: string | null;
      name?: string;
      quantity: number;
    }[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid_body" }, { status: 400 });
  }

  const lines = body.lines ?? [];
  if (lines.length === 0) {
    return NextResponse.json({ ok: true, lines: [], invalid: [] });
  }

  const results = await validateCartLinesDetailed(lines);
  const invalid = results.filter((r) => !r.ok);

  return NextResponse.json({
    ok: invalid.length === 0,
    lines: results,
    invalid,
  });
}
