import { NextResponse } from "next/server";

import { dequeuePopupProducts } from "@/lib/notify-state";

export async function POST(request: Request) {
  let body: { productIds?: string[] };
  try {
    body = (await request.json()) as { productIds?: string[] };
  } catch {
    return NextResponse.json({ message: "invalid_body" }, { status: 400 });
  }

  const productIds = Array.isArray(body.productIds) ? body.productIds : [];
  await dequeuePopupProducts(productIds);
  return NextResponse.json({ ok: true });
}
