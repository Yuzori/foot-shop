import { NextResponse } from "next/server";

import { productImportConfig } from "@/config/product-import";
import { pickImportDefaultCategoryId } from "@/lib/product-import/pick-default-category";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { parseSourceUrls } from "@/lib/product-import/parse-urls";
import type { CategoryImportInput } from "@/lib/product-import/resolve-category";
import {
  runBulkProductImport,
  runProductImport,
} from "@/lib/product-import/run-import";
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

function parseCategoryInput(body: {
  categoryMode?: string;
  categoryId?: string;
  newCategoryName?: string;
  newCategoryImageBase64?: string;
  newCategoryImageMime?: string;
}): CategoryImportInput {
  const mode = body.categoryMode === "new" ? "new" : "existing";
  return {
    mode,
    categoryId: body.categoryId?.trim(),
    newCategoryName: body.newCategoryName?.trim(),
    newCategoryImageBase64: body.newCategoryImageBase64?.trim(),
    newCategoryImageMime: body.newCategoryImageMime?.trim(),
  };
}

/** Liste les catégories PrestaShop pour le formulaire d'import. */
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
  });
}

/**
 * POST /api/admin/product-import
 * Body: { action: "import" | "import_bulk", urlsText?, categoryMode?, ... }
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  }

  let body: {
    action?: string;
    url?: string;
    urls?: string[];
    urlsText?: string;
    name?: string;
    price?: number;
    categoryId?: string;
    categoryMode?: string;
    newCategoryName?: string;
    newCategoryImageBase64?: string;
    newCategoryImageMime?: string;
    imageBase64?: string;
    imageMime?: string;
    sourceUrl?: string;
    stock?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid_body" }, { status: 400 });
  }

  const price =
    typeof body.price === "number" && Number.isFinite(body.price)
      ? body.price
      : undefined;
  const stock =
    typeof body.stock === "number" && Number.isFinite(body.stock)
      ? body.stock
      : undefined;
  const category = parseCategoryInput(body);

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
        price: typeof body.price === "number" ? body.price : 24.99,
        stock: typeof body.stock === "number" ? body.stock : 20,
      });
      return NextResponse.json({ ok: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "push_failed";
      return NextResponse.json({ ok: false, message }, { status: 400 });
    }
  }

  if (body.action === "resolve_category") {
    try {
      const { resolveCategoryForImport } = await import(
        "@/lib/product-import/resolve-category"
      );
      const resolved = await resolveCategoryForImport(category);
      return NextResponse.json({ ok: true, category: resolved });
    } catch (err) {
      const message = err instanceof Error ? err.message : "category_failed";
      return NextResponse.json({ ok: false, message }, { status: 400 });
    }
  }

  if (body.action === "import_bulk") {
    const urls = [
      ...(body.urls ?? []),
      ...parseSourceUrls(body.urlsText ?? ""),
      ...(body.url ? parseSourceUrls(body.url) : []),
    ];

    if (urls.length === 0) {
      return NextResponse.json({ message: "urls_required" }, { status: 400 });
    }

    if (urls.length > productImportConfig.maxUrlsPerImport) {
      return NextResponse.json(
        {
          message: `Maximum ${productImportConfig.maxUrlsPerImport} URLs par import.`,
        },
        { status: 400 },
      );
    }

    try {
      const { results, category: resolved } = await runBulkProductImport(urls, {
        price,
        stock,
        category,
      });
      const okCount = results.filter((r) => r.ok).length;
      return NextResponse.json({
        ok: true,
        results,
        okCount,
        total: results.length,
        category: resolved,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "import_failed";
      return NextResponse.json({ ok: false, message }, { status: 400 });
    }
  }

  const url = body.url?.trim() || parseSourceUrls(body.urlsText ?? "")[0];
  if (!url) {
    return NextResponse.json({ message: "url_required" }, { status: 400 });
  }

  try {
    const targetCategoryId = body.categoryId?.trim();

    if (!targetCategoryId) {
      const { resolveCategoryForImport } = await import(
        "@/lib/product-import/resolve-category"
      );
      const resolved = await resolveCategoryForImport(category);
      const result = await runProductImport({
        sourceUrl: url,
        name: body.name?.trim(),
        price,
        stock,
        categoryId: resolved.id,
      });
      return NextResponse.json({ ok: true, result, category: resolved });
    }

    const result = await runProductImport({
      sourceUrl: url,
      name: body.name?.trim(),
      price,
      stock,
      categoryId: targetCategoryId,
    });

    return NextResponse.json({
      ok: true,
      result,
      category: { id: targetCategoryId, name: "", created: false },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "import_failed";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
