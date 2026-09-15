import { NextResponse } from "next/server";

import { welcomePromo } from "@/config/promotions";
import {
  validateCheckoutContactForm,
  validateCheckoutPhone,
} from "@/lib/checkout-contact-validation";
import { clientIp, rateLimitOrReject } from "@/lib/rate-limit";
import type { CheckoutBody } from "@/lib/orders";
import { evaluateWelcomePromoEligibility } from "@/lib/welcome-promo-eligibility";

export const runtime = "nodejs";

/** Prévisualisation offre 2+1 pour invités (sans compte). */
export async function POST(request: Request) {
  const limited = rateLimitOrReject(request, "welcome-promo-preview", 30, 60_000);
  if (limited) return limited;

  let body: Pick<CheckoutBody, "contact" | "address"> & { customerId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const contact = body.contact;
  const address = body.address;
  if (!contact?.email?.trim()) {
    return NextResponse.json({
      enabled: welcomePromo.enabled,
      status: "none" as const,
      label: welcomePromo.label,
      checkoutLabel: welcomePromo.checkoutLabel,
      shortLabel: welcomePromo.shortLabel,
    });
  }

  const contactError = validateCheckoutContactForm(contact, address);
  if (contactError) {
    return NextResponse.json({ message: contactError }, { status: 400 });
  }

  const phoneError = validateCheckoutPhone(
    contact.phone ?? "",
    address?.country || "France",
  );
  if (phoneError) {
    return NextResponse.json({ message: phoneError }, { status: 400 });
  }

  const eligibility = await evaluateWelcomePromoEligibility({
    contact,
    address,
    clientIp: clientIp(request),
    customerId: body.customerId,
  });

  const status = eligibility.eligible
    ? "eligible"
    : eligibility.reason === "identity_used" || eligibility.reason === "ip_used"
      ? "used"
      : "none";

  return NextResponse.json({
    enabled: welcomePromo.enabled,
    status,
    label: welcomePromo.label,
    checkoutLabel: welcomePromo.checkoutLabel,
    shortLabel: welcomePromo.shortLabel,
  });
}
