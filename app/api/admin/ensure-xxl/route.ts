import { NextResponse } from "next/server";

import { isAdminAuthorized } from "@/lib/admin-auth";
import { prestashop } from "@/services/prestashop";

/** Crée les déclinaisons XXL manquantes sur le catalogue PrestaShop. */
export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  if (!prestashop.isConfigured) {
    return NextResponse.json(
      { message: "PrestaShop non configuré." },
      { status: 503 },
    );
  }

  let maxPages = 20;
  try {
    const body = (await request.json()) as { maxPages?: number };
    if (typeof body.maxPages === "number" && body.maxPages > 0) {
      maxPages = Math.min(body.maxPages, 100);
    }
  } catch {
    /* corps vide = défaut */
  }

  const result = await prestashop.ensureXxlForCatalog({ maxPages });
  return NextResponse.json({
    message: "Synchronisation XXL terminée.",
    ...result,
  });
}
