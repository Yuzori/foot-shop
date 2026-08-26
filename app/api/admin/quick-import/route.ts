import { NextResponse } from "next/server";

import { productImportConfig } from "@/config/product-import";
import {
  buildAdminCategoryOptGroups,
  type AdminCategoryOptGroup,
} from "@/lib/admin/import-category-tree";
import { isAdminAuthorized, readAdminSecret } from "@/lib/admin-auth";
import { DEFAULT_STOCK } from "@/lib/jersey-studio/constants";
import { runQuickProductImport } from "@/lib/jersey-studio/run-quick-import";
import {
  scrapeStudioProductFromHtml,
  scrapeStudioProducts,
} from "@/lib/jersey-studio/scrape-batch";
import { sendInstantNewProductEmail } from "@/lib/instant-product-email";
import {
  drainUnisportClientScrapes,
  listUnisportClientScrapes,
  queueUnisportClientScrape,
} from "@/lib/pending-unisport-scrapes";
import { parseSourceUrls } from "@/lib/product-import/parse-urls";
import { normalizeCategoryId } from "@/lib/product-import/normalize-category-id";
import { pickImportDefaultCategoryId } from "@/lib/product-import/pick-default-category";
import { prestashop } from "@/services/prestashop";

export const maxDuration = 120;
export const runtime = "nodejs";

type QuickImportPostBody = {
  action?: string;
  urls?: string[];
  urlsText?: string;
  price?: number;
  stock?: number;
  item?: {
    clientId?: string;
    name: string;
    categoryId?: string;
    sourceUrl?: string;
    description?: string;
    imageUrls?: string[];
  };
  sourceUrl?: string;
  html?: string;
};

export async function GET(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  }

  if (!prestashop.isConfigured) {
    return NextResponse.json({ message: "prestashop_not_configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("pending_scrapes") === "1") {
    const secret = readAdminSecret(request);
    const pending = await listUnisportClientScrapes(secret);
    return NextResponse.json({ ok: true, pendingProducts: pending });
  }

  const categories = await prestashop.getCategories();
  const defaultCategoryId = pickImportDefaultCategoryId(
    categories,
    productImportConfig.defaultCategoryId,
  );
  const categoryGroups: AdminCategoryOptGroup[] =
    buildAdminCategoryOptGroups(categories);

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
  });
}

export async function POST(request: Request) {
  try {
    if (!isAdminAuthorized(request)) {
      return NextResponse.json({ message: "unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as QuickImportPostBody;

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

    if (body.action === "scrape_html" || body.action === "client_scrape") {
      const sourceUrl = body.sourceUrl?.trim();
      const html = body.html ?? "";
      if (!sourceUrl || html.length < 200) {
        return NextResponse.json({ message: "html_required" }, { status: 400 });
      }

      try {
        const product = await scrapeStudioProductFromHtml(sourceUrl, html);
        if (!product.imageUrls.length) {
          return NextResponse.json({
            ok: false,
            message: "no_images",
            products: [{ ...product, error: "Aucune image dans le HTML fourni." }],
          });
        }

        if (body.action === "client_scrape") {
          const secret = readAdminSecret(request);
          await queueUnisportClientScrape(secret, product);
        }

        return NextResponse.json({ ok: true, products: [product] });
      } catch (err) {
        const message = err instanceof Error ? err.message : "scrape_failed";
        return NextResponse.json({
          ok: false,
          message,
          products: [
            {
              sourceUrl: sourceUrl,
              name: sourceUrl,
              audience: "adult" as const,
              collectionKind: "jersey" as const,
              description: "",
              imageUrls: [],
              error: message,
            },
          ],
        });
      }
    }

    if (body.action === "take_pending_scrapes") {
      const secret = readAdminSecret(request);
      const products = await drainUnisportClientScrapes(secret);
      return NextResponse.json({ ok: true, products });
    }

    if (body.action === "push") {
      const item = body.item;
      if (!item?.name?.trim()) {
        return NextResponse.json({ message: "name_required" }, { status: 400 });
      }

      const imageUrls = (item.imageUrls ?? []).map((u) => u.trim()).filter(Boolean);
      if (!imageUrls.length) {
        return NextResponse.json({ message: "images_required" }, { status: 400 });
      }

      const price =
        typeof body.price === "number" && Number.isFinite(body.price)
          ? body.price
          : productImportConfig.defaultPrice;
      const stock =
        typeof body.stock === "number" && Number.isFinite(body.stock)
          ? body.stock
          : DEFAULT_STOCK;

      try {
        const result = await runQuickProductImport({
          name: item.name,
          imageUrls,
          sourceUrl: item.sourceUrl,
          categoryId: normalizeCategoryId(item.categoryId) || undefined,
          price,
          stock,
          description: item.description,
        });

        void sendInstantNewProductEmail({
          productId: result.productId,
          name: result.name,
        }).catch((err) => {
          console.error("[quick-import] new product email failed", err);
        });

        return NextResponse.json({
          ok: true,
          result: {
            clientId: item.clientId,
            name: result.name,
            ok: true,
            productId: result.productId,
            imagesUploaded: result.imagesUploaded,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "push_failed";
        return NextResponse.json({
          ok: false,
          result: {
            clientId: item.clientId,
            name: item.name,
            ok: false,
            error: message,
          },
        });
      }
    }

    return NextResponse.json({ message: "unknown_action" }, { status: 400 });
  } catch (err) {
    console.error("[quick-import] POST failed:", err);
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : "Erreur serveur interne.",
      },
      { status: 500 },
    );
  }
}
