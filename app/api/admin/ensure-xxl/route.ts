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

  let maxPages = 50;
  try {
    const body = (await request.json()) as { maxPages?: number };
    if (typeof body.maxPages === "number" && body.maxPages > 0) {
      maxPages = Math.min(body.maxPages, 100);
    }
  } catch {
    /* corps vide = défaut */
  }

  const result = await prestashop.ensureXxlForCatalog({ maxPages, pageSize: 50 });
  return NextResponse.json({
    message:
      result.created > 0
        ? `${result.created} déclinaison(s) XXL créée(s).`
        : "Aucune déclinaison XXL à créer — le catalogue est déjà à jour.",
    ...result,
  });
}
