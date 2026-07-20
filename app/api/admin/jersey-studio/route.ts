import { NextResponse } from "next/server";

import { productImportConfig } from "@/config/product-import";
import {
  buildAdminCategoryOptGroups,
  flattenAdminCategoryOptGroups,
  type AdminCategoryOptGroup,
} from "@/lib/admin/import-category-tree";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { DEFAULT_STOCK, JERSEY_RENDER_DEADLINE_MS } from "@/lib/jersey-studio/constants";
import { detectRenderModeFromBuffer } from "@/lib/jersey-studio/detect-render-mode-server";
import { fetchImageBuffer } from "@/lib/jersey-studio/fetch-image";
import { getRemoveBgStatus } from "@/lib/jersey-studio/removebg";
import {
  renderJerseyProductCard,
} from "@/lib/jersey-studio/process-image";
import { renderDetailProductCard } from "@/lib/jersey-studio/process-image-detail";
import {
  guessRenderModeFromUrl,
  type JerseyRenderMode,
} from "@/lib/jersey-studio/render-mode";
import { scrapeStudioProducts } from "@/lib/jersey-studio/scrape-batch";
import { parseSourceUrls } from "@/lib/product-import/parse-urls";
import { normalizeCategoryId } from "@/lib/product-import/normalize-category-id";
import { pickImportDefaultCategoryId } from "@/lib/product-import/pick-default-category";
import { runFigmaProductImport } from "@/lib/product-import/run-figma-import";
import { sendInstantNewProductEmail } from "@/lib/instant-product-email";
import { prestashop } from "@/services/prestashop";

export const maxDuration = 120;
export const runtime = "nodejs";

function withDeadline<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function resolveJerseyRenderMode(
  buffer: Buffer,
  body: Pick<JerseyStudioPostBody, "renderMode" | "imageUrl">,
): Promise<JerseyRenderMode> {
  if (body.renderMode === "detail" || body.renderMode === "uniform") {
    return body.renderMode;
  }

  const pixelMode = await detectRenderModeFromBuffer(buffer);
  const urlHint = body.imageUrl?.trim()
    ? guessRenderModeFromUrl(body.imageUrl.trim())
    : null;
  return pixelMode === "uniform" && urlHint === "detail" ? "detail" : pixelMode;
}

function isAuthorized(request: Request): boolean {
  return isAdminAuthorized(request);
}

type JerseyStudioPostBody = {
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

async function parsePostBody(request: Request): Promise<JerseyStudioPostBody> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const itemsRaw = form.get("items");
    const priceRaw = form.get("price");
    const stockRaw = form.get("stock");
    const renderModeRaw = String(form.get("renderMode") ?? "").trim();

    return {
      action: String(form.get("action") ?? "").trim() || undefined,
      imageUrl: String(form.get("imageUrl") ?? "").trim() || undefined,
      imageBase64: String(form.get("imageBase64") ?? "").trim() || undefined,
      referer: String(form.get("referer") ?? "").trim() || undefined,
      renderMode:
        renderModeRaw === "detail" || renderModeRaw === "uniform"
          ? renderModeRaw
          : undefined,
      urlsText: String(form.get("urlsText") ?? "").trim() || undefined,
      urls: form
        .getAll("urls")
        .map((value) => String(value).trim())
        .filter(Boolean),
      price:
        typeof priceRaw === "string" && priceRaw.trim()
          ? Number.parseFloat(priceRaw)
          : undefined,
      stock:
        typeof stockRaw === "string" && stockRaw.trim()
          ? Number.parseInt(stockRaw, 10)
          : undefined,
      items:
        typeof itemsRaw === "string" && itemsRaw.trim()
          ? (JSON.parse(itemsRaw) as JerseyStudioPostBody["items"])
          : undefined,
    };
  }

  return (await request.json()) as JerseyStudioPostBody;
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
    removeBg: getRemoveBgStatus(),
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
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ message: "unauthorized" }, { status: 401 });
    }

    let body: JerseyStudioPostBody;
    try {
      body = await parsePostBody(request);
    } catch (err) {
      console.error("[jersey-studio] invalid body:", err);
      return NextResponse.json(
        {
          ok: false,
          message:
            "Requête illisible (image trop lourde ou serveur à redémarrer). Réduisez l'image ou relancez `npm run dev`.",
        },
        { status: 400 },
      );
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
    if (!body.imageBase64?.trim() && !body.imageUrl?.trim()) {
      return NextResponse.json({ message: "image_required" }, { status: 400 });
    }

    try {
      console.info("[jersey-studio] render start", {
        via: body.imageBase64?.trim() ? "base64" : "url",
        mode: body.renderMode ?? "auto",
        url: body.imageUrl?.trim()?.slice(0, 120),
      });

      const png = await withDeadline(
        (async () => {
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
            throw new Error("Aucune image à traiter.");
          }

          if (buffer.byteLength < 500) {
            throw new Error("Image source vide ou illisible.");
          }

          const mode = await resolveJerseyRenderMode(buffer, body);
          return mode === "detail"
            ? { mode, png: await renderDetailProductCard(buffer) }
            : { mode, png: await renderJerseyProductCard(buffer) };
        })(),
        JERSEY_RENDER_DEADLINE_MS,
        "Rendu trop long (délai serveur ~30 s sur Render). Réessayez ou désactivez Remove.bg temporairement.",
      );

      console.info("[jersey-studio] render ok", {
        bytes: png.png.byteLength,
        mode: png.mode,
      });
      return new Response(new Uint8Array(png.png), {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-store",
          "X-Render-Mode": png.mode,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "render_failed";
      console.error("[jersey-studio] render failed:", err);
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
          categoryId: normalizeCategoryId(item.categoryId) || undefined,
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
  } catch (err) {
    console.error("[jersey-studio] POST failed:", err);
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : "Erreur serveur interne — relancez `npm run dev` et réessayez.",
      },
      { status: 500 },
    );
  }
}
