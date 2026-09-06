import { NextResponse } from "next/server";

import { apologyPromo } from "@/config/promotions";
import { isAdminAuthorized } from "@/lib/admin-auth";
import {
  grantFootshop15RevokeFootshop10,
  isFootshop15GrantedForCustomer,
} from "@/lib/customer-promo-grants-store";
import { prestashop } from "@/services/prestashop";

/**
 * POST { "emails": ["client@example.com"] }
 * Active FOOTSHOP15 (-15 %) et désactive FOOTSHOP10 sur ces comptes.
 */
export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  let body: { emails?: string[] };
  try {
    body = (await request.json()) as { emails?: string[] };
  } catch {
    return NextResponse.json({ message: "Corps JSON invalide." }, { status: 400 });
  }

  const emails = (body.emails ?? [])
    .map((email) => email.trim().toLowerCase())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

  if (emails.length === 0) {
    return NextResponse.json(
      { message: "Liste « emails » requise." },
      { status: 422 },
    );
  }

  const results: Array<{
    email: string;
    customerId: string | null;
    granted: boolean;
    error?: string;
  }> = [];

  for (const email of emails) {
    const customer = await prestashop.getCustomerAuthByEmail(email);
    if (!customer?.id) {
      results.push({
        email,
        customerId: null,
        granted: false,
        error: "Compte introuvable dans PrestaShop.",
      });
      continue;
    }

    await grantFootshop15RevokeFootshop10({
      email,
      customerId: customer.id,
    });

    const active = await isFootshop15GrantedForCustomer({
      email,
      customerId: customer.id,
    });

    results.push({
      email,
      customerId: customer.id,
      granted: active,
    });
  }

  const granted = results.filter((row) => row.granted).length;

  return NextResponse.json({
    message: `${granted}/${results.length} compte(s) mis à jour (${apologyPromo.code} actif, FOOTSHOP10 désactivé).`,
    code: apologyPromo.code,
    percent: apologyPromo.percent,
    results,
  });
}
