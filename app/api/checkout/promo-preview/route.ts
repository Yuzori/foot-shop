import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { validatePromoCodeForCheckout } from "@/lib/validate-promo-code";

export async function POST(request: Request) {
  let body: {
    code?: string;
    email?: string;
    customerId?: string;
    subtotal?: number;
    lines?: Array<{
      flocage?: { name?: string; number?: string; text?: string; price?: number } | null;
      quantity?: number;
    }>;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ message: "invalid_body" }, { status: 400 });
  }

  const code = body.code?.trim() ?? "";
  if (!code) {
    return NextResponse.json({ valid: false, message: "" });
  }

  const session = await getSession();
  const promoLines =
    body.lines?.map((line) => ({
      quantity: line.quantity ?? 1,
      flocage: line.flocage
        ? {
            name: line.flocage.name,
            number: line.flocage.number,
            text: line.flocage.text,
            price: line.flocage.price ?? 0,
          }
        : undefined,
      productId: "",
      variantId: null,
      unitPrice: 0,
    })) ?? [];

  const result = await validatePromoCodeForCheckout({
    code,
    email: body.email?.trim() ?? "",
    customerId: body.customerId ?? session?.id,
    subtotal: typeof body.subtotal === "number" ? body.subtotal : 0,
    lines: promoLines,
  });

  if (!result) {
    return NextResponse.json({ valid: false, message: "Code promo invalide." });
  }

  if (!result.valid) {
    return NextResponse.json({ valid: false, message: result.message });
  }

  return NextResponse.json({
    valid: true,
    code: result.code,
    kind: result.kind,
    percent: result.percent,
    discount: result.discount,
    label: result.label,
    flocagePrice: result.flocagePrice,
    freeShipping: result.freeShipping ?? false,
  });
}
