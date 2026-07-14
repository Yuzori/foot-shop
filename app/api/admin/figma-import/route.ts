import { NextResponse } from "next/server";

import { productImportConfig } from "@/config/product-import";
import { pickImportDefaultCategoryId } from "@/lib/product-import/pick-default-category";
import { isAdminAuthorized } from "@/lib/admin-auth";
import {
  fetchProductImageForFigma,
  previewProductFromUrl,
  runFigmaProductImport,
  scrapeProductImageForFigma,
} from "@/lib/product-import/run-figma-import";
import { prestashop } from "@/services/prestashop";

export const maxDuration = 120;

function isAuthorized(request: Request): boolean {
  return isAdminAuthorized(request);
}

/** GET — catégories PrestaShop pour le plugin Figma. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const previewUrl = searchParams.get("previewUrl")?.trim();
  if (previewUrl) {
    try {
      const preview = await previewProductFromUrl(previewUrl);
      return NextResponse.json({ ok: true, ...preview });
    } catch (err) {
      const message = err instanceof Error ? err.message : "preview_failed";
      return NextResponse.json({ ok: false, message }, { status: 422 });
    }
  }

  const imageUrl = searchParams.get("imageUrl")?.trim();
  if (imageUrl) {
    try {
      const referer = searchParams.get("referer")?.trim() || undefined;
      const image = await fetchProductImageForFigma(imageUrl, referer);
      return NextResponse.json({ ok: true, ...image });
    } catch (err) {
      const message = err instanceof Error ? err.message : "image_failed";
      return NextResponse.json({ ok: false, message }, { status: 422 });
    }
  }

  if (!prestashop.isConfigured) {
    return NextResponse.json({ message: "prestashop_not_configured" }, { status: 503 });
  }

  const categories = await prestashop.getCategories();
  const defaultCategoryId = pickImportDefaultCategoryId(
    categories,
    productImportConfig.defaultCategoryId,
  );

  return NextResponse.json({
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    defaultCategoryId,
    price: 24.99,
    stock: 20,
  });
}

/**
 * POST /api/admin/figma-import
 * - action: "preview" → { url } — nom formaté + URL image source
 * - action: "scrape" → { url } — nom + image base64 pour le plugin Figma
 * - action: "push" → { name, imageBase64, imageMime?, sourceUrl?, categoryId? }
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  }

  let body: {
    action?: string;
    url?: string;
    name?: string;
    imageBase64?: string;
    imageMime?: string;
    sourceUrl?: string;
    categoryId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid_body" }, { status: 400 });
  }

  if (body.action === "preview") {
    const url = body.url?.trim();
    if (!url) {
      return NextResponse.json({ message: "url_required" }, { status: 400 });
    }

    try {
      const preview = await previewProductFromUrl(url);
      return NextResponse.json({ ok: true, ...preview });
    } catch (err) {
      const message = err instanceof Error ? err.message : "preview_failed";
      return NextResponse.json({ ok: false, message }, { status: 422 });
    }
  }

  if (body.action === "scrape") {
    const url = body.url?.trim();
    if (!url) {
      return NextResponse.json({ message: "url_required" }, { status: 400 });
    }

    try {
      const scraped = await scrapeProductImageForFigma(url);
      return NextResponse.json({ ok: true, ...scraped });
    } catch (err) {
      const message = err instanceof Error ? err.message : "scrape_failed";
      return NextResponse.json({ ok: false, message }, { status: 422 });
    }
  }

  if (body.action === "push") {
    const name = body.name?.trim();
    const imageBase64 = body.imageBase64?.trim();
    if (!name || !imageBase64) {
      return NextResponse.json({ message: "name_and_image_required" }, { status: 400 });
    }

    try {
      const result = await runFigmaProductImport({
        name,
        imageBase64,
        imageMime: body.imageMime?.trim() || "image/png",
        sourceUrl: body.sourceUrl?.trim(),
        categoryId: body.categoryId?.trim(),
        price: 24.99,
        stock: 20,
      });
      return NextResponse.json({ ok: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "push_failed";
      return NextResponse.json({ ok: false, message }, { status: 400 });
    }
  }

  return NextResponse.json({ message: "unknown_action" }, { status: 400 });
}
