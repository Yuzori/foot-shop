import { NextResponse } from "next/server";
import sharp from "sharp";

import { productImportConfig } from "@/config/product-import";
import {
  buildAdminCategoryOptGroups,
  flattenAdminCategoryOptGroups,
  type AdminCategoryOptGroup,
} from "@/lib/admin/import-category-tree";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { DEFAULT_STOCK } from "@/lib/jersey-studio/constants";
import { detectRenderModeFromBuffer } from "@/lib/jersey-studio/detect-render-mode-server";
import { fetchImageBuffer } from "@/lib/jersey-studio/fetch-image";
import {
  renderDetailProductCardBase64,
} from "@/lib/jersey-studio/process-image-detail";
import {
  renderJerseyProductCardBase64,
} from "@/lib/jersey-studio/process-image";
import {
  guessRenderModeFromUrl,
  type JerseyRenderMode,
} from "@/lib/jersey-studio/render-mode";
import { scrapeStudioProducts } from "@/lib/jersey-studio/scrape-batch";
import { parseSourceUrls } from "@/lib/product-import/parse-urls";
import { pickImportDefaultCategoryId } from "@/lib/product-import/pick-default-category";
import { runFigmaProductImport } from "@/lib/product-import/run-figma-import";
import { sendInstantNewProductEmail } from "@/lib/instant-product-email";
import { prestashop } from "@/services/prestashop";

export const maxDuration = 120;

function isAuthorized(request: Request): boolean {
  return isAdminAuthorized(request);
}

/** GET — catégories PrestaShop pour le studio maillot. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  }

  if (!prestashop.isConfigured) {
    return NextResponse.json({ message: "prestashop_not_configured" }, { status: 503 });
  }

  const categories = await prestashop.getCategories();
  const defaultCategoryId = pickImportDefaultCategoryId(
    categories,
    productImportConfig.defaultCategoryId,
  );
  const categoryGroups = buildAdminCategoryOptGroups(categories);

  return NextResponse.json({
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      parentId: c.parentId,
    })),
    categoryGroups,
    defaultCategoryId,
    defaultPrice: productImportConfig.defaultPrice,
    defaultStock: DEFAULT_STOCK,
    cardSize: { width: 328, height: 411, renderScale: 2 },
  });
}

/**
 * POST /api/admin/jersey-studio
 * - action: "scrape_batch" → { urlsText | urls }
 * - action: "render" → { imageUrl?, imageBase64?, referer? }
 * - action: "detect_mode" → { imageUrl?, imageBase64?, referer? }
 * - action: "push_batch" → { items[], price, stock? }
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  }

  let body: {
    action?: string;
    urls?: string[];
    urlsText?: string;
    imageUrl?: string;
    imageBase64?: string;
    referer?: string;
    renderMode?: JerseyRenderMode;
    price?: number;
    stock?: number;
    items?: {
      clientId?: string;
      name: string;
      categoryId?: string;
      sourceUrl?: string;
      description?: string;
      imageBase64?: string;
      imagesBase64?: string[];
    }[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid_body" }, { status: 400 });
  }

  if (body.action === "scrape_batch") {
    const urls = [
      ...(body.urls ?? []),
      ...parseSourceUrls(body.urlsText ?? ""),
    ].filter(Boolean);

    if (!urls.length) {
      return NextResponse.json({ message: "urls_required" }, { status: 400 });
    }

    if (urls.length > productImportConfig.maxUrlsPerImport) {
      return NextResponse.json(
        { message: `Maximum ${productImportConfig.maxUrlsPerImport} URLs.` },
        { status: 400 },
      );
    }

    const products = await scrapeStudioProducts(urls);
    return NextResponse.json({ ok: true, products });
  }

  if (body.action === "detect_mode") {
    try {
      let buffer: Buffer;
      if (body.imageBase64?.trim()) {
        buffer = Buffer.from(body.imageBase64.trim(), "base64");
      } else if (body.imageUrl?.trim()) {
        const fetched = await fetchImageBuffer(
          body.imageUrl.trim(),
          body.referer?.trim(),
        );
        buffer = fetched.buffer;
      } else {
        return NextResponse.json({ message: "image_required" }, { status: 400 });
      }

      const pixelMode = await detectRenderModeFromBuffer(buffer);
      const urlHint = body.imageUrl?.trim()
        ? guessRenderModeFromUrl(body.imageUrl.trim())
        : null;
      const mode: JerseyRenderMode =
        pixelMode === "uniform" && urlHint === "detail" ? "detail" : pixelMode;
      return NextResponse.json({ ok: true, mode });
    } catch (err) {
      const message = err instanceof Error ? err.message : "detect_failed";
      return NextResponse.json({ ok: false, message }, { status: 422 });
    }
  }

  if (body.action === "render") {
    try {
      let buffer: Buffer;
      let sourceSize: { width: number; height: number } | undefined;

      if (body.imageBase64?.trim()) {
        buffer = Buffer.from(body.imageBase64.trim(), "base64");
        const meta = await sharp(buffer).metadata();
        sourceSize = { width: meta.width ?? 0, height: meta.height ?? 0 };
      } else if (body.imageUrl?.trim()) {
        const fetched = await fetchImageBuffer(
          body.imageUrl.trim(),
          body.referer?.trim(),
        );
        buffer = fetched.buffer;
        sourceSize = { width: fetched.width, height: fetched.height };
      } else {
        return NextResponse.json({ message: "image_required" }, { status: 400 });
      }

      const mode: JerseyRenderMode =
        body.renderMode === "detail" ? "detail" : "uniform";
      const imageBase64 =
        mode === "detail"
          ? await renderDetailProductCardBase64(buffer)
          : await renderJerseyProductCardBase64(buffer);
      return NextResponse.json({
        ok: true,
        imageBase64,
        mimeType: "image/png",
        renderMode: mode,
        sourceSize,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "render_failed";
      return NextResponse.json({ ok: false, message }, { status: 422 });
    }
  }

  if (body.action === "push_batch") {
    const items = body.items ?? [];
    if (!items.length) {
      return NextResponse.json({ message: "items_required" }, { status: 400 });
    }

    const price =
      typeof body.price === "number" && Number.isFinite(body.price)
        ? body.price
        : productImportConfig.defaultPrice;
    const stock =
      typeof body.stock === "number" && Number.isFinite(body.stock)
        ? body.stock
        : DEFAULT_STOCK;

    const results: {
      clientId?: string;
      name: string;
      ok: boolean;
      productId?: string;
      categoryId?: string;
      error?: string;
    }[] = [];

    for (const item of items) {
      try {
        const imagesBase64 = (item.imagesBase64 ?? [])
          .map((img) => img.trim())
          .filter(Boolean);
        const fallback = item.imageBase64?.trim();
        if (!imagesBase64.length && fallback) {
          imagesBase64.push(fallback);
        }
        if (!imagesBase64.length) {
          throw new Error("Aucune image à envoyer.");
        }

        const result = await runFigmaProductImport({
          name: item.name,
          imageBase64: imagesBase64[0]!,
          imagesBase64: imagesBase64.length > 1 ? imagesBase64.slice(1) : undefined,
          imageMime: "image/png",
          sourceUrl: item.sourceUrl,
          categoryId: item.categoryId,
          price,
          stock,
          description: item.description,
          useExactCategory: true,
        });
        results.push({
          clientId: item.clientId,
          name: item.name,
          ok: true,
          productId: result.productId,
          categoryId: item.categoryId,
        });
        void sendInstantNewProductEmail({
          productId: result.productId,
          name: item.name,
        }).catch((err) => {
          console.error("[jersey-studio] new product email failed", err);
        });
      } catch (err) {
        results.push({
          clientId: item.clientId,
          name: item.name,
          ok: false,
          categoryId: item.categoryId,
          error: err instanceof Error ? err.message : "push_failed",
        });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    return NextResponse.json({ ok: true, results, okCount, total: results.length });
  }

  return NextResponse.json({ message: "unknown_action" }, { status: 400 });
}
