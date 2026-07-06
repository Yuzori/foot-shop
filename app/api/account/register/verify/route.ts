import { NextResponse } from "next/server";

import { setSession } from "@/lib/auth";
import { verifyRegistrationCode } from "@/lib/register-pending-store";
import { sendWelcomePromoEmail } from "@/lib/welcome-promo-email";
import { grantWelcomePromo } from "@/lib/welcome-promo-store";
import { welcomePromo } from "@/config/promotions";
import { prestashop } from "@/services/prestashop";

/** Étape 2 : vérifie le code et crée le compte PrestaShop. */
export async function POST(request: Request) {
  if (!prestashop.isConfigured) {
    return NextResponse.json({ message: "Service indisponible." }, { status: 503 });
  }

  let body: { email?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const code = (body.code ?? "").trim();

  if (!email || !code) {
    return NextResponse.json({ message: "Email et code requis." }, { status: 422 });
  }

  const pending = verifyRegistrationCode(email, code);
  if (!pending) {
    return NextResponse.json(
      { message: "Code invalide ou expiré." },
      { status: 400 },
    );
  }

  const existing = await prestashop.getCustomerAuthByEmail(email);
  if (existing) {
    return NextResponse.json(
      { message: "Un compte existe déjà avec cet email." },
      { status: 409 },
    );
  }

  const { customer, status, error } = await prestashop.createCustomer({
    firstName: pending.firstName,
    lastName: pending.lastName,
    email: pending.email,
    password: pending.password,
    newsletter: pending.newsletter,
  });

  if (!customer) {
    return NextResponse.json(
      { message: "Impossible de créer le compte.", detail: error },
      { status: status && status >= 400 ? status : 502 },
    );
  }

  await setSession({
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
  });

  if (welcomePromo.enabled) {
    await grantWelcomePromo(customer.id);
    try {
      await sendWelcomePromoEmail({
        to: customer.email,
        firstName: customer.firstName,
      });
    } catch (err) {
      console.error("[register] welcome promo email failed", err);
    }
  }

  return NextResponse.json({ user: customer }, { status: 201 });
}
