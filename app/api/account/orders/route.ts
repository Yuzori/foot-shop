import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { prestashop } from "@/services/prestashop";

/** Order history for the authenticated customer. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const items = await prestashop.getOrdersByCustomer(session.id);
  return NextResponse.json({ items });
}
