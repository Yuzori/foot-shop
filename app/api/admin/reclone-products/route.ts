import { NextResponse } from "next/server";

import { isAdminAuthorized } from "@/lib/admin-auth";
import {
  recloneProductsByIds,
  scanProductsToReclone,
} from "@/lib/migrations/reclone-missing-products";
import { prestashop } from "@/services/prestashop";

export const maxDuration = 120;
export const runtime = "nodejs";

/** Scan ou re-clonage des produits « fantômes » (visibles site, absents BO). */
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

  let action: "scan" | "run" = "scan";
  let productIds: string[] = [];
  let deactivateSource = false;
  let boNameKeys: string[] = [];

  try {
    const body = (await request.json()) as {
      action?: "scan" | "run";
      productIds?: string[];
      deactivateSource?: boolean;
      boNameKeys?: string[];
    };
    if (body.action === "run") action = "run";
    if (Array.isArray(body.productIds)) {
      productIds = body.productIds
        .map((id) => String(id).trim())
        .filter((id) => /^\d+$/.test(id))
        .slice(0, 5);
    }
    deactivateSource = Boolean(body.deactivateSource);
    if (Array.isArray(body.boNameKeys)) {
      boNameKeys = body.boNameKeys.map((key) => String(key).trim()).filter(Boolean);
    }
  } catch {
    /* scan par défaut */
  }

  if (action === "scan") {
    const scan = await scanProductsToReclone();
    return NextResponse.json({
      message: `${scan.candidates.length} produit(s) à recréer pour le BO PrestaShop.`,
      ...scan,
      sample: scan.candidates.slice(0, 8),
    });
  }

  if (productIds.length === 0) {
    return NextResponse.json(
      { message: "productIds requis (max 5 par appel)." },
      { status: 400 },
    );
  }

  const result = await recloneProductsByIds(productIds, {
    deactivateSource,
    delayMs: 400,
    boNameKeys,
  });

  return NextResponse.json({
    message:
      result.cloned > 0
        ? `${result.cloned} produit(s) recréé(s) via l'API PrestaShop.`
        : "Aucun produit recréé.",
    ...result,
  });
}
