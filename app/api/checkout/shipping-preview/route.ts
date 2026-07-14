import { NextResponse } from "next/server";

import { resolveShippingFee } from "@/lib/shipping-fee";

export async function POST(request: Request) {
  let body: { email?: string; customerId?: string };
  try {
    body = (await request.json()) as { email?: string; customerId?: string };
  } catch {
    return NextResponse.json({ message: "invalid_body" }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  if (!email) {
    return NextResponse.json({ message: "email_required" }, { status: 400 });
  }

  const shipping = await resolveShippingFee({
    email,
    customerId: body.customerId,
  });

  return NextResponse.json(shipping);
}
