import { NextResponse } from "next/server";

import {
  validateCheckoutEmail,
  validateCheckoutPhone,
} from "@/lib/checkout-contact-validation";
import { verifyEmailDeliverability } from "@/lib/verify-email-deliverability";

export const runtime = "nodejs";

/** Vérifie email (existence) et téléphone (validité réelle) au checkout. */
export async function POST(request: Request) {
  let body: { email?: string; phone?: string; country?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const email = body.email?.trim();
  const phone = body.phone?.trim();
  const country = body.country?.trim() || "France";

  if (email) {
    const formatError = validateCheckoutEmail(email);
    if (formatError) {
      return NextResponse.json({
        valid: false,
        field: "email",
        message: formatError,
      });
    }

    let deliverability: Awaited<ReturnType<typeof verifyEmailDeliverability>>;
    try {
      deliverability = await verifyEmailDeliverability(email);
    } catch {
      deliverability = { valid: true };
    }
    if (!deliverability.valid) {
      return NextResponse.json({
        valid: false,
        field: "email",
        message: deliverability.message,
      });
    }

    return NextResponse.json({ valid: true, field: "email" });
  }

  if (phone) {
    const phoneError = validateCheckoutPhone(phone, country);
    if (phoneError) {
      return NextResponse.json({
        valid: false,
        field: "phone",
        message: phoneError,
      });
    }

    return NextResponse.json({ valid: true, field: "phone" });
  }

  return NextResponse.json({ message: "email ou phone requis." }, { status: 400 });
}
