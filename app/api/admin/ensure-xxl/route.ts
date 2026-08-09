import { NextResponse } from "next/server";

import { isAdminAuthorized } from "@/lib/admin-auth";
import { prestashop } from "@/services/prestashop";

export const maxDuration = 120;
export const runtime = "nodejs";

function buildXxlMessage(result: {
  processed: number;
  withVariants: number;
  alreadyHasXxl: number;
  created: number;
}): string {
  if (result.created > 0) {
    return `${result.created} taille(s) XXL ajoutée(s) sur ${result.withVariants} maillots (${result.processed} produits actifs parcourus).`;
  }
  if (result.withVariants > 0) {
    return `${result.withVariants} maillots vérifiés sur ${result.processed} produits actifs — tous ont déjà le XXL côté API PrestaShop.`;
  }
  return `${result.processed} produits parcourus — aucun maillot avec déclinaisons taille trouvé.`;
}

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
      message: buildXxlMessage({
        processed: result.processed,
        withVariants: result.withVariants,
        alreadyHasXxl: result.alreadyHasXxl,
        created: result.created,
      }),
      ...result,
    });
  }

  const result = await prestashop.ensureXxlForCatalog({ maxPages, pageSize });
  return NextResponse.json({
    message: buildXxlMessage(result),
    ...result,
  });
}
