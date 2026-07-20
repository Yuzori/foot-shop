import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { validatePromoCodeForCheckout } from "@/lib/validate-promo-code";

export async function POST(request: Request) {
  let body: {
    code?: string;
    email?: string;
    customerId?: string;
    subtotal?: number;
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
  const result = await validatePromoCodeForCheckout({
    code,
    email: body.email?.trim() ?? "",
    customerId: body.customerId ?? session?.id,
    subtotal: typeof body.subtotal === "number" ? body.subtotal : 0,
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
    percent: result.percent,
    discount: result.discount,
    label: result.label,
  });
}
