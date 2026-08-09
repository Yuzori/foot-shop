import { NextResponse } from "next/server";

import { isAdminAuthorized } from "@/lib/admin-auth";
import { prestashop } from "@/services/prestashop";

export const maxDuration = 120;
export const runtime = "nodejs";

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

  let page: number | undefined;
  let pageSize = 25;
  let maxPages = 100;

  try {
    const body = (await request.json()) as {
      page?: number;
      pageSize?: number;
      maxPages?: number;
    };
    if (typeof body.page === "number" && body.page > 0) {
      page = Math.floor(body.page);
    }
    if (typeof body.pageSize === "number" && body.pageSize > 0) {
      pageSize = Math.min(body.pageSize, 50);
    }
    if (typeof body.maxPages === "number" && body.maxPages > 0) {
      maxPages = Math.min(body.maxPages, 100);
    }
  } catch {
    /* corps vide = défaut */
  }

  if (page !== undefined) {
    const result = await prestashop.ensureXxlForCatalogPage({ page, pageSize });
    return NextResponse.json({
      message: result.created > 0 ? `${result.created} XXL créé(s) sur cette page.` : null,
      ...result,
    });
  }

  const result = await prestashop.ensureXxlForCatalog({ maxPages, pageSize });
  return NextResponse.json({
    message:
      result.created > 0
        ? `${result.created} déclinaison(s) XXL créée(s) sur ${result.pages} page(s).`
        : "Aucune déclinaison XXL à créer — le catalogue est déjà à jour.",
    ...result,
  });
}
