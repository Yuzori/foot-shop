import { NextResponse } from "next/server";

import { clearSession, getSession } from "@/lib/auth";
import { prestashop } from "@/services/prestashop";

function sessionAsUser(session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  return {
    id: session.id,
    email: session.email,
    firstName: session.firstName,
    lastName: session.lastName,
  };
}

/**
 * Returns the current session user (or null).
 * Ne déconnecte pas sur une erreur PrestaShop temporaire (ex. après paiement).
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  if (!prestashop.isConfigured) {
    return NextResponse.json({ user: sessionAsUser(session) });
  }

  const result = await prestashop.fetchCustomerById(session.id);

  if (result.customer) {
    return NextResponse.json({ user: result.customer });
  }

  if (result.notFound) {
    await clearSession();
    return NextResponse.json({ user: null });
  }

  // PrestaShop injoignable — conserver la session, renvoyer l'identité du cookie.
  return NextResponse.json({ user: sessionAsUser(session) });
}
