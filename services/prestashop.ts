import "server-only";

import axios, { type AxiosInstance } from "axios";
import crypto from "node:crypto";

import { serverConfig } from "@/config";
import { productImportConfig } from "@/config/product-import";
import type { ImageAccentData } from "@/lib/image-accent-core";
import { readAccentCache } from "@/lib/image-accent-cache";
import { warmProductAccentsPool } from "@/lib/image-accent-warm";
import { syncProductStockFromVariants } from "@/lib/product-stock";
import { syncProductPriceFromVariants } from "@/lib/product-price";
import { slugify } from "@/lib/product-import/slug";
import type {
  Category,
  Customer,
  Order,
  Paginated,
  Product,
  ProductOptionValue,
  ProductQuery,
  ProductVariant,
  SortOption,
} from "@/types/domain";

import type { SupplierOrderContext } from "@/lib/bbdbuy/types";
import { sortProducts } from "@/lib/product-sort";
import type {
  PsAttributeGroup,
  PsCategory,
  PsCombination,
  PsCustomer,
  PsOrder,
  PsOrderCarrier,
  PsAddress,
  PsLangField,
  PsProduct,
  PsProductOptionValue,
  PsStockAvailable,
} from "@/types/prestashop";

import {
  mapCategory,
  mapCombination,
  mapCustomer,
  mapOptionValue,
  mapOrder,
  mapProduct,
  psStr,
  resolveLang,
} from "./mappers";

/** Product list options: the public query + an internal test/override flag. */
interface GetProductsOptions extends ProductQuery {
  /** Include inactive products (testing / special cases). Defaults to false. */
  includeInactive?: boolean;
}

/**
 * Safely extract a list from a PrestaShop response. PrestaShop usually returns
 * `{ key: [...] }`, but defensively handles a single object or a bare array so
 * a one-element result is never lost.
 */
function asArray<T>(
  data: (Record<string, unknown> & { [k: string]: unknown }) | T[] | null,
  key: string,
): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as T[];
  const value = (data as Record<string, unknown>)[key];
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") return [value as T];
  return [];
}

class PrestaShopService {
  private client: AxiosInstance | null = null;

  private getClient(): AxiosInstance | null {
    if (!serverConfig.isConfigured) return null;
    if (this.client) return this.client;

    this.client = axios.create({
      baseURL: serverConfig.apiUrl.replace(/\/$/, ""),
      timeout: 45_000,
      auth: { username: serverConfig.apiKey, password: "" },
      params: {
        output_format: "JSON",
        language: serverConfig.langId,
      },
    });

    return this.client;
  }

  get isConfigured(): boolean {
    return serverConfig.isConfigured;
  }

  /**
   * Low-level GET that ALWAYS surfaces what happened (status + body) instead of
   * swallowing it. This is what makes a PrestaShop 400/401 visible rather than
   * silently turning into "0 produits".
   */
  private async request<T>(
    path: string,
    params?: Record<string, string | number>,
  ): Promise<{
    data: T | null;
    status: number | null;
    error: string | null;
    params: Record<string, string | number>;
  }> {
    const client = this.getClient();
    const usedParams = params ?? {};

    if (!client) {
      return { data: null, status: null, error: "not_configured", params: usedParams };
    }

    let lastError: string | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await client.get<T>(path, { params });
        if (process.env.NODE_ENV !== "production") {
          console.info(
            `[prestashop] GET ${path} ${res.status} params=${JSON.stringify(usedParams)}`,
          );
        }
        return { data: res.data, status: res.status, error: null, params: usedParams };
      } catch (error) {
        const status = axios.isAxiosError(error)
          ? (error.response?.status ?? null)
          : null;
        const body = axios.isAxiosError(error)
          ? typeof error.response?.data === "string"
            ? error.response.data.slice(0, 600)
            : JSON.stringify(error.response?.data ?? error.message).slice(0, 600)
          : String(error);

        lastError = body;
        const retryable =
          axios.isAxiosError(error) &&
          (error.code === "ECONNABORTED" ||
            error.code === "ETIMEDOUT" ||
            error.code === "ECONNREFUSED" ||
            error.code === "ENOTFOUND");

        if (attempt === 0 && retryable) {
          await new Promise((resolve) => setTimeout(resolve, 1_500));
          continue;
        }

        console.error(
          `[prestashop] GET ${path} FAILED status=${status} params=${JSON.stringify(usedParams)} body=${body}`,
        );

        return { data: null, status, error: body, params: usedParams };
      }
    }

    return {
      data: null,
      status: null,
      error: lastError ?? "unknown_error",
      params: usedParams,
    };
  }

  private async get<T>(
    path: string,
    params?: Record<string, string | number>,
  ): Promise<T | null> {
    return (await this.request<T>(path, params)).data;
  }

  /**
   * Low-level POST. PrestaShop write operations expect an XML body (the
   * `output_format=JSON` default only affects the RESPONSE shape).
   */
  private resolveShopId(): string {
    const raw = String(serverConfig.shopId ?? "").trim();
    return raw || "1";
  }

  private shopQueryParams(): Record<string, string> {
    return { id_shop: this.resolveShopId() };
  }

  private async post<T>(
    path: string,
    xmlBody: string,
    params?: Record<string, string | number>,
  ): Promise<{ data: T | null; status: number | null; error: string | null }> {
    const client = this.getClient();
    if (!client) return { data: null, status: null, error: "not_configured" };

    try {
      const res = await client.post<T>(path, xmlBody, {
        headers: { "Content-Type": "text/xml" },
        params,
      });
      return { data: res.data, status: res.status, error: null };
    } catch (error) {
      const status = axios.isAxiosError(error)
        ? (error.response?.status ?? null)
        : null;
      const body = axios.isAxiosError(error)
        ? typeof error.response?.data === "string"
          ? error.response.data.slice(0, 800)
          : JSON.stringify(error.response?.data ?? error.message).slice(0, 800)
        : String(error);
      console.error(`[prestashop] POST ${path} FAILED status=${status} body=${body}`);
      return { data: null, status, error: body };
    }
  }

  /** Low-level PUT (update). Expects an XML body like POST. */
  private async put<T>(
    path: string,
    xmlBody: string,
    params?: Record<string, string | number>,
  ): Promise<{ data: T | null; status: number | null; error: string | null }> {
    const client = this.getClient();
    if (!client) return { data: null, status: null, error: "not_configured" };

    try {
      const res = await client.put<T>(path, xmlBody, {
        headers: { "Content-Type": "text/xml" },
        params,
      });
      return { data: res.data, status: res.status, error: null };
    } catch (error) {
      const status = axios.isAxiosError(error)
        ? (error.response?.status ?? null)
        : null;
      const body = axios.isAxiosError(error)
        ? typeof error.response?.data === "string"
          ? error.response.data.slice(0, 800)
          : JSON.stringify(error.response?.data ?? error.message).slice(0, 800)
        : String(error);
      console.error(`[prestashop] PUT ${path} FAILED status=${status} body=${body}`);
      return { data: null, status, error: body };
    }
  }

  // ─────────────────────────────────────────────
  // PRODUCTS
  // ─────────────────────────────────────────────

  /**
   * Build the query params for a product list request.
   * Extracted so diagnostics can reuse the exact same params.
   */
  private buildProductParams(
    query: GetProductsOptions,
  ): { params: Record<string, string | number>; page: number; limit: number } {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, query.limit ?? 12);
    const offset = (page - 1) * limit;

    const params: Record<string, string | number> = {
      ...this.shopQueryParams(),
      display: "full",
      // Fetch one extra row to detect a next page. PrestaShop limit syntax:
      // "offset,count" (offset omitted for page 1 to keep the URL simple).
      limit: offset > 0 ? `${offset},${limit + 1}` : `${limit + 1}`,
    };

    // Active filter is ON by default (objective: show active products) but can
    // be disabled globally via env or per-call for testing — see includeInactive.
    const includeInactive =
      query.includeInactive ?? process.env.PRESTASHOP_INCLUDE_INACTIVE === "1";
    if (!includeInactive) {
      params["filter[active]"] = "1";
    }

    if (query.category) params["filter[id_category_default]"] = query.category;
    if (query.search) params["filter[name]"] = `%[${query.search}]%`;

    return { params, page, limit };
  }

  async getProducts(query: GetProductsOptions = {}): Promise<Paginated<Product>> {
    const { params, page, limit } = this.buildProductParams(query);

    let { data, status, error } = await this.request<{
      products?: PsProduct[];
    }>("/products", params);

    const raw = asArray<PsProduct>(data as never, "products");

    const hasMore = raw.length > limit;
    let items = raw.slice(0, limit).map(mapProduct);

    await Promise.all([this.applyStock(items), this.normalizeProductPrices(items)]);
    await this.enrichCoverAccents(items);

    items = sortProducts(items, query.sort);

    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[prestashop] getProducts page=${page} limit=${limit} status=${status} rawCount=${raw.length} mapped=${items.length}${error ? ` error=${error}` : ""}`,
      );
    }

    return {
      items,
      total: (page - 1) * limit + items.length + (hasMore ? 1 : 0),
      page,
      limit,
      hasMore,
      connectionError: error && items.length === 0 ? error : null,
    };
  }

  /**
   * Diagnostics for `/api/products?debug=1`. Runs the request WITH and WITHOUT
   * the active filter so you can instantly see whether emptiness comes from the
   * filter, the connection, or genuinely empty data — without changing the
   * normal code path.
   */
  async getProductsDiagnostics(query: GetProductsOptions = {}) {
    const withActive = this.buildProductParams({ ...query, includeInactive: false });
    const withoutActive = this.buildProductParams({ ...query, includeInactive: true });

    const [active, all] = await Promise.all([
      this.request<{ products?: PsProduct[] }>("/products", withActive.params),
      this.request<{ products?: PsProduct[] }>("/products", withoutActive.params),
    ]);

    return {
      isConfigured: this.isConfigured,
      apiUrlConfigured: Boolean(serverConfig.apiUrl),
      langId: serverConfig.langId,
      activeOnly: {
        params: withActive.params,
        status: active.status,
        error: active.error,
        count: asArray<PsProduct>(active.data as never, "products").length,
      },
      includingInactive: {
        params: withoutActive.params,
        status: all.status,
        error: all.error,
        count: asArray<PsProduct>(all.data as never, "products").length,
      },
    };
  }

  async getProductById(id: string): Promise<Product | null> {
    const { data, status, error } = await this.request<Record<string, unknown>>(
      `/products/${id}`,
      { display: "full", ...this.shopQueryParams() },
    );

    // PrestaShop returns { product: {...} } for a single resource, but some
    // configs/versions return { products: [{...}] }. Handle BOTH so a valid
    // product never falls through to a 404.
    const ps =
      (data?.product as PsProduct | undefined) ??
      asArray<PsProduct>(data as never, "products")[0];

    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[prestashop] getProductById ${id} status=${status} found=${Boolean(ps)}${error ? ` error=${error}` : ""}`,
      );
    }

    if (!ps) return null;

    const product = mapProduct(ps);

    // Variants and real stock are independent → fetch them in parallel to cut
    // the product page latency roughly in half.
    const [variants] = await Promise.all([
      this.getProductVariants(id, product.price),
      this.applyStock([product]),
    ]);
    await this.applyVariantStock(id, variants);
    product.variants = variants;
    product.optionGroups = buildOptionGroups(variants);
    syncProductStockFromVariants(product);
    syncProductPriceFromVariants(product);
    await this.normalizeProductPrices([product]);
    await this.enrichCoverAccents([product]);

    return product;
  }

  /**
   * Fetch a set of products by id in ONE request (used for category pages so we
   * show every product associated to the category, not only those whose
   * `id_category_default` matches).
   */
  async getProductsByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];

    const unique = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
    const chunkSize = 40;
    const items: Product[] = [];

    for (let offset = 0; offset < unique.length; offset += chunkSize) {
      const chunk = unique.slice(offset, offset + chunkSize);
      const { data } = await this.request<{ products?: PsProduct[] }>("/products", {
        ...this.shopQueryParams(),
        display: "full",
        "filter[id]": `[${chunk.join("|")}]`,
        "filter[active]": "1",
        limit: `${chunk.length}`,
      });

      const mapped = asArray<PsProduct>(data as never, "products").map(mapProduct);
      await Promise.all([
        this.applyStock(mapped),
        this.normalizeProductPrices(mapped),
      ]);
      await this.enrichCoverAccents(mapped);
      items.push(...mapped);
    }

    // Preserve the order given by the category association.
    const order = new Map(unique.map((id, i) => [id, i]));
    items.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return items;
  }

  private async enrichCoverAccents(products: Product[]): Promise<void> {
    const toWarm: Array<{ productId: string; imageId: string }> = [];
    const accentByKey = new Map<string, ImageAccentData>();

    for (const product of products) {
      if (!product.cover) continue;
      const key = `${product.id}-${product.cover.id}`;
      const cached = await readAccentCache(product.id, product.cover.id);
      if (cached) {
        accentByKey.set(key, cached);
      } else {
        toWarm.push({ productId: product.id, imageId: product.cover.id });
      }
    }

    if (toWarm.length > 0) {
      const warmed = await warmProductAccentsPool(toWarm, 6);
      for (const [key, accent] of warmed) accentByKey.set(key, accent);
    }

    for (const product of products) {
      if (!product.cover) continue;
      const accent = accentByKey.get(`${product.id}-${product.cover.id}`);
      if (accent) product.coverAccent = accent;
    }
  }

  /**
   * Fetch the real stock for a set of products in batched requests and patch
   * `quantity` / `inStock` on each.
   */
  private async applyStock(products: Product[]): Promise<void> {
    const ids = products.map((p) => p.id);
    const stock = await this.getStockMap(ids);
    if (stock.size === 0) return;

    for (const product of products) {
      const quantity = stock.get(product.id);
      if (quantity !== undefined) {
        product.quantity = quantity;
        product.inStock = quantity > 0;
      }
    }
  }

  private async getStockMap(
    productIds: string[],
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (productIds.length === 0) return map;

    const shopId = this.resolveShopId();
    const chunkSize = 40;

    for (let offset = 0; offset < productIds.length; offset += chunkSize) {
      const chunk = productIds.slice(offset, offset + chunkSize);

      const { data } = await this.request<{
        stock_availables?: PsStockAvailable[];
      }>("/stock_availables", {
        display: "full",
        "filter[id_product]": `[${chunk.join("|")}]`,
        "filter[id_shop]": shopId,
      });

      const rows = asArray<PsStockAvailable>(data as never, "stock_availables");

      const base = new Map<string, number>();
      const summed = new Map<string, number>();

      for (const row of rows) {
        if (row.id_shop && String(row.id_shop) !== shopId) continue;
        const pid = row.id_product;
        if (!pid) continue;
        const qty = Number.parseInt(row.quantity ?? "0", 10) || 0;
        if (row.id_product_attribute === "0") {
          base.set(pid, qty);
        } else {
          summed.set(pid, (summed.get(pid) ?? 0) + qty);
        }
      }

      for (const pid of chunk) {
        const baseQty = base.get(pid);
        const sumQty = summed.get(pid);
        let value: number | undefined;
        if (baseQty !== undefined && sumQty !== undefined) {
          value = Math.max(baseQty, sumQty);
        } else {
          value = baseQty ?? sumQty;
        }
        if (value !== undefined) map.set(pid, value);
      }
    }

    return map;
  }

  /**
   * Corrige les prix manquants (0 €) pour TOUS les produits de la liste.
   * Ordre : relecture shop → XML individuel (parallèle borné) → déclinaisons batch.
   */
  private async normalizeProductPrices(products: Product[]): Promise<void> {
    const missing = products.filter((p) => p.price <= 0);
    if (missing.length === 0) return;

    const shopId = this.resolveShopId();
    const chunkSize = 50;

    // 1) Relecture ciblée id + price avec id_shop
    for (let offset = 0; offset < missing.length; offset += chunkSize) {
      const chunk = missing.slice(offset, offset + chunkSize);
      const ids = chunk.map((p) => p.id);

      const { data } = await this.request<{ products?: PsProduct[] }>(
        "/products",
        {
          ...this.shopQueryParams(),
          display: "[id,price]",
          "filter[id]": `[${ids.join("|")}]`,
          limit: `${ids.length}`,
        },
      );

      for (const row of asArray<PsProduct>(data as never, "products")) {
        const parsed = Number.parseFloat(String(row.price ?? "").replace(",", "."));
        if (!Number.isFinite(parsed) || parsed <= 0) continue;
        const product = products.find((p) => p.id === String(row.id));
        if (product && product.price <= 0) product.price = parsed;
      }
    }

    let stillMissing = products.filter((p) => p.price <= 0);
    if (stillMissing.length === 0) return;

    // 2) XML avec id_shop (source la plus fiable en multiboutique) — parallèle borné
    const xmlConcurrency = 8;
    for (let i = 0; i < stillMissing.length; i += xmlConcurrency) {
      const batch = stillMissing.slice(i, i + xmlConcurrency);
      await Promise.all(
        batch.map(async (product) => {
          const raw = await this.getProductRawXml(product.id);
          if (!raw) return;
          const priceStr = extractXmlScalarField(raw, "price");
          const parsed = Number.parseFloat(
            String(priceStr ?? "").replace(",", "."),
          );
          if (Number.isFinite(parsed) && parsed > 0) {
            product.price = parsed;
          }
        }),
      );
    }

    stillMissing = products.filter((p) => p.price <= 0);
    if (stillMissing.length === 0) return;

    // 3) Prix via déclinaisons (batch) — impact positif ou prix absolu stocké
    await this.applyBatchCombinationPrices(stillMissing);

    // 4) Dernier recours affiché : prix d'import par défaut (évite 0,00 € vitrine)
    const fallback = productImportConfig.defaultPrice;
    if (fallback > 0) {
      for (const product of products) {
        if (product.price <= 0) product.price = fallback;
      }
    }

    if (process.env.NODE_ENV !== "production") {
      const unresolved = products.filter((p) => p.price <= 0).length;
      if (unresolved > 0) {
        console.warn(
          `[prestashop] normalizeProductPrices: ${unresolved}/${products.length} product(s) still at 0 (shop=${shopId})`,
        );
      }
    }
  }

  /** Hydrate les prix 0 € depuis les déclinaisons (requêtes batchées). */
  private async applyBatchCombinationPrices(products: Product[]): Promise<void> {
    if (products.length === 0) return;

    const byId = new Map(products.map((p) => [p.id, p]));
    const ids = products.map((p) => p.id);
    const chunkSize = 40;

    for (let offset = 0; offset < ids.length; offset += chunkSize) {
      const chunk = ids.slice(offset, offset + chunkSize);

      const [{ data: comboData }, { data: productData }] = await Promise.all([
        this.request<{ combinations?: PsCombination[] }>("/combinations", {
          display: "[id,id_product,price]",
          "filter[id_product]": `[${chunk.join("|")}]`,
          limit: "2000",
        }),
        this.request<{ products?: PsProduct[] }>("/products", {
          ...this.shopQueryParams(),
          display: "[id,price]",
          "filter[id]": `[${chunk.join("|")}]`,
          limit: `${chunk.length}`,
        }),
      ]);

      const bases = new Map<string, number>();
      for (const row of asArray<PsProduct>(productData as never, "products")) {
        const parsed = Number.parseFloat(
          String(row.price ?? "").replace(",", "."),
        );
        if (Number.isFinite(parsed) && parsed > 0) {
          bases.set(String(row.id), parsed);
        }
      }

      const impacts = new Map<string, number[]>();
      for (const combo of asArray<PsCombination>(
        comboData as never,
        "combinations",
      )) {
        const pid = String(combo.id_product ?? "").trim();
        if (!pid || !byId.has(pid)) continue;
        const impact =
          Number.parseFloat(String(combo.price ?? "0").replace(",", ".")) || 0;
        const list = impacts.get(pid) ?? [];
        list.push(impact);
        impacts.set(pid, list);
      }

      for (const pid of chunk) {
        const product = byId.get(pid);
        if (!product || product.price > 0) continue;

        const base = bases.get(pid) ?? 0;
        const comboImpacts = impacts.get(pid);

        if (comboImpacts && comboImpacts.length > 0) {
          const prices = comboImpacts
            .map((impact) => base + impact)
            .filter((p) => p > 0);
          if (prices.length > 0) {
            product.price = Math.min(...prices);
            continue;
          }
        }

        if (base > 0) product.price = base;
      }
    }
  }

  /** Applique le stock réel (stock_availables) à chaque déclinaison / taille. */
  private async applyVariantStock(
    productId: string,
    variants: ProductVariant[],
  ): Promise<void> {
    if (!variants.length) return;

    const shopId = this.resolveShopId();

    const { data } = await this.request<{
      stock_availables?: PsStockAvailable[];
    }>("/stock_availables", {
      display: "full",
      "filter[id_product]": productId,
      "filter[id_shop]": shopId,
    });

    const rows = asArray<PsStockAvailable>(data as never, "stock_availables");
    const byAttr = new Map<string, number>();

    for (const row of rows) {
      if (row.id_shop && String(row.id_shop) !== shopId) continue;
      const attrId = row.id_product_attribute;
      if (!attrId || String(attrId) === "0") continue;
      const qty = Number.parseInt(row.quantity ?? "0", 10) || 0;
      byAttr.set(String(attrId), qty);
    }

    if (byAttr.size === 0) {
      const fallback = await this.request<{
        stock_availables?: PsStockAvailable[];
      }>("/stock_availables", {
        display: "full",
        "filter[id_product]": productId,
      });
      for (const row of asArray<PsStockAvailable>(
        fallback.data as never,
        "stock_availables",
      )) {
        const attrId = row.id_product_attribute;
        if (!attrId || String(attrId) === "0") continue;
        const qty = Number.parseInt(row.quantity ?? "0", 10) || 0;
        byAttr.set(String(attrId), qty);
      }
    }

    for (const variant of variants) {
      const qty = byAttr.get(String(variant.id));
      if (qty !== undefined) {
        variant.quantity = qty;
        variant.inStock = qty > 0;
      }
    }
  }

  async getNewProducts(limit = 8): Promise<Product[]> {
    const result = await this.getProducts({ sort: "newest", limit, page: 1 });
    return result.items;
  }

  async searchProducts(term: string, limit = 24): Promise<Product[]> {
    if (!term.trim()) return [];
    const result = await this.getProducts({ search: term, limit, page: 1 });
    return result.items;
  }

  // ─────────────────────────────────────────────
  // VARIANTS
  // ─────────────────────────────────────────────

  private async getProductVariants(
    productId: string,
    basePrice: number,
  ): Promise<ProductVariant[]> {
    const data = await this.get<{ combinations?: PsCombination[] }>(
      "/combinations",
      {
        display: "full",
        "filter[id_product]": productId,
      },
    );

    const combinations = data?.combinations ?? [];
    if (!combinations.length) return [];

    const optionValueIds = new Set<string>();

    for (const combo of combinations) {
      for (const v of combo.associations?.product_option_values ?? []) {
        optionValueIds.add(v.id);
      }
    }

    const optionValues = await this.getOptionValues([...optionValueIds]);

    return combinations.map((combo) =>
      mapCombination(combo, optionValues, basePrice),
    );
  }

  private async getOptionValues(ids: string[]): Promise<Map<string, ProductOptionValue>> {
    const map = new Map<string, ProductOptionValue>();
    if (!ids.length) return map;

    const data = await this.get<{ product_option_values?: PsProductOptionValue[] }>(
      "/product_option_values",
      {
        display: "full",
        "filter[id]": `[${ids.join("|")}]`,
      },
    );

    const values = data?.product_option_values ?? [];
    const groupNames = await this.getAttributeGroupNames();

    for (const value of values) {
      const option = mapOptionValue(value);
      option.group = groupNames.get(option.group) ?? "Option";
      map.set(option.id, option);
    }

    return map;
  }

  private async getAttributeGroupNames(): Promise<Map<string, string>> {
    const map = new Map<string, string>();

    const data = await this.get<{ product_options?: PsAttributeGroup[] }>(
      "/product_options",
      { display: "full" },
    );

    for (const group of data?.product_options ?? []) {
      map.set(group.id, resolveLang(group.public_name ?? group.name));
    }

    return map;
  }

  // ─────────────────────────────────────────────
  // CATEGORIES
  // ─────────────────────────────────────────────

  async getCategories(): Promise<Category[]> {
    return (await this.fetchCategories()).items;
  }

  async fetchCategories(): Promise<{ items: Category[]; error: string | null }> {
    const { data, error } = await this.request<{ categories?: PsCategory[] }>(
      "/categories",
      {
        display:
          "[id,id_parent,name,link_rewrite,description,is_root_category,nb_products_recursive]",
        "filter[active]": "1",
      },
    );

    const items = asArray<PsCategory>(data as never, "categories")
      .map(mapCategory)
      .filter((c) => !c.isRoot);

    return {
      items,
      error: error && items.length === 0 ? error : null,
    };
  }

  async getCategoryById(id: string): Promise<Category | null> {
    const { data, status, error } = await this.request<Record<string, unknown>>(
      `/categories/${id}`,
      { display: "full" },
    );

    // Same single-resource quirk as products: handle both { category: {...} }
    // and { categories: [{...}] } so a valid category never 404s.
    const ps =
      (data?.category as PsCategory | undefined) ??
      asArray<PsCategory>(data as never, "categories")[0];

    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[prestashop] getCategoryById ${id} status=${status} found=${Boolean(ps)}${error ? ` error=${error}` : ""}`,
      );
    }

    return ps ? mapCategory(ps) : null;
  }

  /** Crée une catégorie active sous un parent donné. */
  async createCategory(input: CreateCategoryInput): Promise<string> {
    const langId = serverConfig.langId;
    const xml = buildCategoryCreateXml({ ...input, langId });
    const { data, status, error } = await this.post("/categories", xml);
    if (status !== null && status >= 400) {
      throw new Error(`Création catégorie échouée : ${error ?? status}`);
    }
    const id = extractCreatedId(data, "category");
    if (!id) throw new Error("Catégorie créée mais identifiant introuvable.");
    await this.ensureCategoryShopAssociation(id);
    return id;
  }

  /**
   * PrestaShop multishop: categories created via API may miss ps_category_shop,
   * which hides them from the BO category picker when editing a product.
   */
  private async ensureCategoryShopAssociation(categoryId: string): Promise<void> {
    const shopId = this.resolveShopId();
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <category>
    <id>${escapeXml(categoryId)}</id>
    <active>1</active>
  </category>
</prestashop>`;

    const { status, error } = await this.put(`/categories/${categoryId}`, xml, {
      id_shop: shopId,
    });
    if (status !== null && status >= 400) {
      console.warn(
        `[prestashop] ensureCategoryShopAssociation failed category=${categoryId} shop=${shopId}`,
        error,
      );
    }
  }

  /** Téléverse une image pour une catégorie PrestaShop. */
  async uploadCategoryImageBuffer(
    categoryId: string,
    buffer: Buffer,
    mime: string,
  ): Promise<void> {
    await this.uploadResourceImageBuffer("categories", categoryId, buffer, mime);
  }

  /**
   * Products that belong to a category. Reads the category's
   * `associations.products` and fetches them by id in batches.
   */
  async getCategoryProducts(id: string, limit = 500): Promise<Product[]> {
    const categoryId = String(id).trim();
    if (!categoryId || categoryId === "0") return [];

    const ids = await this.getCategoryAssociatedProductIds(categoryId);

    if (ids.length > 0) {
      return this.getProductsByIds(ids.slice(0, limit));
    }

    // Fallback : filtre id_category_default
    const byDefault = await this.getProducts({
      category: categoryId,
      limit: Math.min(limit, 200),
      page: 1,
    });
    return byDefault.items;
  }

  /** IDs produits liés à une catégorie (associations PrestaShop). */
  async getCategoryAssociatedProductIds(categoryId: string): Promise<string[]> {
    const id = String(categoryId).trim();
    if (!id || id === "0" || !/^\d+$/.test(id)) return [];

    const { data, status } = await this.request<Record<string, unknown>>(
      `/categories/${id}`,
      { display: "full", ...this.shopQueryParams() },
    );
    if (status === 404 || !data) return [];

    const ps =
      (data?.category as PsCategory | undefined) ??
      asArray<PsCategory>(data as never, "categories")[0];

    const raw = ps?.associations?.products as unknown;
    const list = Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object"
        ? "id" in (raw as object)
          ? [raw as { id: string }]
          : Array.isArray((raw as { product?: unknown }).product)
            ? ((raw as { product: { id: string }[] }).product)
            : (raw as { product?: { id: string } }).product
              ? [(raw as { product: { id: string } }).product]
              : []
        : [];

    return [
      ...new Set(
        list.map((p) => String(p.id).trim()).filter((pid) => /^\d+$/.test(pid)),
      ),
    ];
  }

  /**
   * Tous les produits d'une arborescence de catégories (racine + enfants),
   * en une passe d'IDs puis fetch batché — évite N× getCategoryProducts.
   */
  async getProductsInCategoryTree(
    rootCategoryId: string,
    categoryIds: string[],
    limit = 500,
  ): Promise<Product[]> {
    const scope = [
      ...new Set(
        [rootCategoryId, ...categoryIds]
          .map((id) => String(id).trim())
          .filter((id) => id && id !== "0" && /^\d+$/.test(id)),
      ),
    ];
    if (scope.length === 0) return [];

    const allIds = new Set<string>();

    const concurrency = 6;
    for (let i = 0; i < scope.length; i += concurrency) {
      const batch = scope.slice(i, i + concurrency);
      const lists = await Promise.all(
        batch.map((cid) => this.getCategoryAssociatedProductIds(cid)),
      );
      for (const list of lists) {
        for (const id of list) allIds.add(id);
      }
    }

    if (allIds.size === 0) {
      return this.getCategoryProducts(rootCategoryId, limit);
    }

    const ids = [...allIds].slice(0, limit);
    return this.getProductsByIds(ids);
  }

  // ─────────────────────────────────────────────
  // ORDERS
  // ─────────────────────────────────────────────

  /**
   * Changes an order's state by appending an order history entry (the correct
   * Webservice way). Used by the Stripe webhook to mark an order as paid.
   * Default stateId 2 = "Paiement accepté" in a standard PrestaShop install.
   */
  async addOrderHistory(
    orderId: string,
    stateId = 2,
  ): Promise<{ ok: boolean; error: string | null }> {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <order_history>
    <id_order>${escapeXml(orderId)}</id_order>
    <id_order_state>${stateId}</id_order_state>
  </order_history>
</prestashop>`;
    const { status, error } = await this.post("/order_histories", xml);
    return { ok: status !== null && status < 400, error };
  }

  async getOrderByReference(reference: string): Promise<Order | null> {
    if (!reference.trim()) return null;

    const { data } = await this.request<{ orders?: PsOrder[] }>("/orders", {
      display: "full",
      "filter[reference]": reference.trim(),
    });

    const order = asArray<PsOrder>(data as never, "orders")[0];
    if (!order) return null;

    const tracking = await this.getOrderTrackingNumber(order.id);
    return mapOrder(order, tracking);
  }

  async getOrderById(id: string): Promise<Order | null> {
    const { data } = await this.request<Record<string, unknown>>(`/orders/${id}`, {
      display: "full",
    });

    const order =
      (data?.order as PsOrder | undefined) ??
      asArray<PsOrder>(data as never, "orders")[0];
    if (!order) return null;

    const tracking = await this.getOrderTrackingNumber(order.id);
    return mapOrder(order, tracking);
  }

  /** Numéro de suivi colis (table order_carriers PrestaShop). */
  async getOrderTrackingNumber(orderId: string): Promise<string | null> {
    const { data } = await this.request<{ order_carriers?: PsOrderCarrier[] }>(
      "/order_carriers",
      {
        display: "full",
        "filter[id_order]": orderId,
      },
    );
    const row = asArray<PsOrderCarrier>(data as never, "order_carriers")[0];
    const tracking = row?.tracking_number?.trim();
    return tracking || null;
  }

  async getCustomerSecureKey(customerId: string | number): Promise<string | null> {
    const id = String(customerId).trim();
    const ps = await this.getCustomerRecord(id);
    const key = ps?.secure_key?.trim();
    if (key) return key;
    return this.readSecureKeyFromRawXml(id);
  }

  private async readSecureKeyFromRawXml(customerId: string): Promise<string | null> {
    const xmlRaw = await this.getCustomerRawXml(customerId);
    if (!xmlRaw) return null;
    const match = xmlRaw.match(
      /<secure_key>(?:<!\[CDATA\[)?([^<\]]+)(?:\]\]>)?<\/secure_key>/i,
    );
    const key = match?.[1]?.trim();
    return key || null;
  }

  /**
   * Récupère la secure_key PrestaShop ou en définit une nouvelle si le
   * webservice ne la renvoie pas en lecture (fréquent sur les comptes existants).
   */
  async ensureCustomerSecureKey(customerId: string | number): Promise<string | null> {
    const id = String(customerId).trim();
    if (!id) return null;

    const existing =
      (await this.getCustomerSecureKey(id)) ??
      (await this.readSecureKeyFromRawXml(id));
    if (existing) return existing;

    const secureKey = crypto.randomBytes(16).toString("hex");

    // Patch du XML brut : préserve tous les champs requis par PrestaShop (comme
    // pour la newsletter) et évite de dépendre du hash mot de passe.
    const xmlRaw = await this.getCustomerRawXml(id);
    if (xmlRaw) {
      const patched = patchCustomerXmlField(xmlRaw, "secure_key", secureKey);
      const { status, error } = await this.put(`/customers/${id}`, patched);
      if (status !== null && status < 400) {
        const verified =
          (await this.getCustomerSecureKey(id)) ??
          (await this.readSecureKeyFromRawXml(id));
        return verified ?? secureKey;
      }
      console.error("[prestashop] secure_key raw patch failed", id, error);
    }

    const ps = await this.getCustomerRecord(id);
    if (!ps?.email) return null;

    let passwdHash = ps.passwd?.trim();
    if (!passwdHash) {
      const auth = await this.getCustomerAuthByEmail(ps.email);
      passwdHash = auth?.passwordHash?.trim();
    }
    if (!passwdHash) {
      const tempPassword = crypto.randomBytes(24).toString("hex");
      const pwResult = await this.updateCustomerPassword(id, tempPassword);
      if (pwResult.ok) {
        const auth = await this.getCustomerAuthByEmail(ps.email);
        passwdHash = auth?.passwordHash?.trim();
      }
    }
    if (!passwdHash) {
      console.error(
        "[prestashop] secure_key update: passwd unavailable for customer",
        id,
      );
      return null;
    }

    const result = await this.updateCustomerSecureKey(id, ps, secureKey, passwdHash);
    if (!result.ok) {
      console.error("[prestashop] secure_key update failed", id, result.error);
      return null;
    }

    if (process.env.NODE_ENV !== "production") {
      console.info(`[prestashop] secure_key generated for customer ${id}`);
    }

    return secureKey;
  }

  private async updateCustomerSecureKey(
    id: string,
    ps: PsCustomer,
    secureKey: string,
    passwdHash: string,
  ): Promise<{ ok: boolean; error: string | null }> {
    const xml = buildCustomerUpdateXml({
      id,
      firstName: ps.firstname ?? "Client",
      lastName: ps.lastname ?? "Client",
      email: ps.email ?? "",
      idDefaultGroup: ps.id_default_group,
      idLang: ps.id_lang,
      idShop: ps.id_shop,
      idGender: ps.id_gender,
      secureKey,
      passwdHash,
    });
    const { status, error } = await this.put(`/customers/${id}`, xml);
    return { ok: status !== null && status < 400, error };
  }

  async getCustomerEmailByOrderId(orderId: string): Promise<string | null> {
    const { data } = await this.request<Record<string, unknown>>(
      `/orders/${orderId}`,
      { display: "full" },
    );
    const order =
      (data?.order as PsOrder | undefined) ??
      asArray<PsOrder>(data as never, "orders")[0];
    const customerId = order?.id_customer;
    if (!customerId) return null;

    const customer = await this.getCustomerRecord(customerId);
    return customer?.email?.trim().toLowerCase() ?? null;
  }

  /** Contexte complet pour préparer une commande fournisseur (BBDBuy). */
  async getSupplierOrderContext(
    orderId: string,
  ): Promise<SupplierOrderContext | null> {
    const { data } = await this.request<Record<string, unknown>>(
      `/orders/${orderId}`,
      { display: "full" },
    );
    const ps =
      (data?.order as PsOrder | undefined) ??
      asArray<PsOrder>(data as never, "orders")[0];
    if (!ps?.id) return null;

    const delivery = await this.getOrderDeliveryContact(ps);
    const flocageNote = await this.getOrderFlocageNote(orderId);
    const customerEmail = await this.getCustomerEmailByOrderId(orderId);

    const lines =
      ps.associations?.order_rows?.map((row) => {
        const attr = psStr(row.product_attribute_id);
        return {
          productId: psStr(row.product_id),
          variantId: attr && attr !== "0" ? attr : null,
          name: row.product_name ?? `Produit #${psStr(row.product_id)}`,
          quantity: Number.parseInt(psStr(row.product_quantity) || "1", 10) || 1,
        };
      }) ?? [];

    return {
      orderId: String(ps.id),
      reference: ps.reference ?? String(ps.id),
      customerEmail,
      delivery,
      flocageNote,
      lines,
    };
  }

  private async getOrderDeliveryContact(ps: PsOrder): Promise<SupplierOrderContext["delivery"]> {
    const empty = {
      firstName: "",
      lastName: "",
      phone: "",
      address1: "",
      address2: "",
      postcode: "",
      city: "",
      country: "France",
    };

    const addressId = ps.id_address_delivery;
    if (!addressId) return empty;

    const { data } = await this.request<Record<string, unknown>>(
      `/addresses/${addressId}`,
      { display: "full" },
    );
    const addr =
      (data?.address as PsAddress | undefined) ??
      asArray<PsAddress>(data as never, "addresses")[0];
    if (!addr) return empty;

    const country = addr.id_country
      ? await this.resolveCountryName(addr.id_country)
      : "France";

    return {
      firstName: addr.firstname?.trim() ?? "",
      lastName: addr.lastname?.trim() ?? "",
      phone: (addr.phone_mobile || addr.phone || "").trim(),
      address1: addr.address1?.trim() ?? "",
      address2: addr.address2?.trim() ?? "",
      postcode: addr.postcode?.trim() ?? "",
      city: addr.city?.trim() ?? "",
      country: country ?? "France",
    };
  }

  private async resolveCountryName(countryId: string): Promise<string | null> {
    const { data } = await this.request<Record<string, unknown>>(
      `/countries/${countryId}`,
      { display: "full" },
    );
    const country =
      (data?.country as { name?: PsLangField } | undefined) ??
      asArray<{ name?: PsLangField }>(data as never, "countries")[0];
    if (!country?.name) return null;
    return resolveLang(country.name) || null;
  }

  private async getOrderFlocageNote(orderId: string): Promise<string | null> {
    const { data } = await this.request<{ messages?: { message?: string }[] }>(
      "/messages",
      {
        display: "full",
        "filter[id_order]": orderId,
      },
    );
    const messages = asArray<{ message?: string }>(data as never, "messages");
    const flocage = messages.find((m) =>
      (m.message ?? "").includes("FLOCAGE"),
    );
    return flocage?.message?.trim() ?? null;
  }

  async getOrdersByCustomer(customerId: string): Promise<Order[]> {
    const { data } = await this.request<{ orders?: PsOrder[] }>("/orders", {
      display: "full",
      "filter[id_customer]": customerId,
      sort: "[id_DESC]",
    });
    const orders = asArray<PsOrder>(data as never, "orders").map((o) => mapOrder(o));
    return orders.sort((a, b) => {
      const da = a.createdAt ? Date.parse(a.createdAt) : 0;
      const db = b.createdAt ? Date.parse(b.createdAt) : 0;
      return db - da;
    });
  }

  // ─────────────────────────────────────────────
  // CUSTOMERS (accounts)
  // ─────────────────────────────────────────────

  /**
   * Fetch a customer by email INCLUDING the bcrypt password hash, for login
   * verification. Returns null if not found. The hash never leaves the server.
   */
  async getCustomerAuthByEmail(
    email: string,
  ): Promise<(Customer & { passwordHash: string }) | null> {
    const normalized = email.trim().toLowerCase();
    const id = await this.resolveCustomerIdByEmail(normalized);
    if (!id) return null;

    const single = await this.request<Record<string, unknown>>(
      `/customers/${id}`,
      { display: "full" },
    );
    const ps =
      (single.data?.customer as PsCustomer | undefined) ??
      asArray<PsCustomer>(single.data as never, "customers")[0];
    if (!ps) return null;

    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[prestashop] auth lookup ${normalized} id=${ps.id} hasPasswd=${Boolean(ps.passwd)}`,
      );
    }

    return { ...mapCustomer(ps), passwordHash: ps.passwd ?? "" };
  }

  private async resolveCustomerIdByEmail(email: string): Promise<string | null> {
    const filters = [email, `[${email}]`];
    for (const filterValue of filters) {
      const { data } = await this.request<{ customers?: { id: string }[] }>(
        "/customers",
        { display: "full", "filter[email]": filterValue },
      );
      const idRow = asArray<{ id: string }>(data as never, "customers")[0];
      if (idRow?.id) return idRow.id;
    }

    const { data: allData } = await this.request<{ customers?: PsCustomer[] }>(
      "/customers",
      { display: "full", "filter[active]": "1", limit: "500" },
    );
    const match = asArray<PsCustomer>(allData as never, "customers").find(
      (c) => c.email?.trim().toLowerCase() === email,
    );
    return match?.id ?? null;
  }

  private async getCustomerRecord(id: string): Promise<PsCustomer | null> {
    const single = await this.request<Record<string, unknown>>(
      `/customers/${id}`,
      { display: "full" },
    );
    return (
      (single.data?.customer as PsCustomer | undefined) ??
      asArray<PsCustomer>(single.data as never, "customers")[0] ??
      null
    );
  }

  /** Met à jour le mot de passe (texte clair — PrestaShop hash via le webservice). */
  async updateCustomerPassword(
    id: string,
    plainPassword: string,
  ): Promise<{ ok: boolean; error: string | null }> {
    const ps = await this.getCustomerRecord(id);
    if (!ps?.email) return { ok: false, error: "customer_not_found" };

    const xml = buildCustomerUpdateXml({
      id,
      firstName: ps.firstname ?? "Client",
      lastName: ps.lastname ?? "Client",
      email: ps.email,
      password: plainPassword,
      idDefaultGroup: ps.id_default_group,
      idLang: ps.id_lang,
      idShop: ps.id_shop,
      idGender: ps.id_gender,
      newsletter: ps.newsletter === "1",
      optin: ps.optin === "1",
      clearResetToken: true,
    });

    const { status, error } = await this.put(`/customers/${id}`, xml);
    if (status === null || status >= 400) {
      console.error("[prestashop] password update failed", error);
      return { ok: false, error };
    }

    const { verifyPassword } = await import("@/lib/auth");
    const updated = await this.getCustomerAuthByEmail(ps.email);
    const verified = Boolean(
      updated?.passwordHash &&
        (await verifyPassword(plainPassword, updated.passwordHash)),
    );

    if (!verified) {
      console.error(
        `[prestashop] password PUT ok but login verify failed id=${id} email=${ps.email}`,
      );
      return { ok: false, error: "password_verify_failed" };
    }

    return { ok: true, error: null };
  }

  private async getCustomerRawXml(id: string): Promise<string | null> {
    const client = this.getClient();
    if (!client) return null;
    try {
      const res = await client.get<string>(`/customers/${id}`, {
        params: { display: "full" },
        headers: { Accept: "application/xml" },
        responseType: "text",
        transformResponse: [(data: string) => data],
      });
      const body = res.data;
      return typeof body === "string" && body.includes("<customer>") ? body : null;
    } catch {
      return null;
    }
  }

  /** Active la newsletter pour un client existant. */
  async subscribeCustomerNewsletter(
    email: string,
  ): Promise<{ ok: boolean; already: boolean }> {
    const account = await this.getCustomerAuthByEmail(email);
    if (!account) return { ok: false, already: false };

    const current = await this.request<Record<string, unknown>>(
      `/customers/${account.id}`,
      { display: "full" },
    );
    const ps =
      (current.data?.customer as PsCustomer | undefined) ??
      asArray<PsCustomer>(current.data as never, "customers")[0];
    if (!ps) return { ok: false, already: false };
    if (ps.newsletter === "1") return { ok: true, already: true };

    const xmlRaw = await this.getCustomerRawXml(account.id);
    if (xmlRaw) {
      const patched = patchCustomerXmlField(xmlRaw, "newsletter", "1");
      const { status } = await this.put(`/customers/${account.id}`, patched);
      return { ok: status !== null && status < 400, already: false };
    }

    const xml = buildCustomerUpdateXml({
      id: account.id,
      firstName: ps.firstname ?? account.firstName,
      lastName: ps.lastname ?? account.lastName,
      email: ps.email ?? email,
      newsletter: true,
    });
    const { status } = await this.put(`/customers/${account.id}`, xml);
    return { ok: status !== null && status < 400, already: false };
  }

  /** Emails of customers who opted into the newsletter (for restock alerts). */
  async getNewsletterSubscribers(): Promise<string[]> {
    const { data } = await this.request<{ customers?: PsCustomer[] }>(
      "/customers",
      { display: "full", "filter[newsletter]": "1", "filter[active]": "1" },
    );
    let emails = asArray<PsCustomer>(data as never, "customers")
      .filter((c) => c.newsletter === "1")
      .map((c) => c.email?.trim().toLowerCase())
      .filter((e): e is string => Boolean(e));

    if (emails.length > 0) return [...new Set(emails)];

    // Fallback : certains PrestaShop ignorent filter[newsletter] sur le webservice.
    const { data: allData } = await this.request<{ customers?: PsCustomer[] }>(
      "/customers",
      { display: "full", "filter[active]": "1", limit: "500" },
    );
    emails = asArray<PsCustomer>(allData as never, "customers")
      .filter((c) => c.newsletter === "1")
      .map((c) => c.email?.trim().toLowerCase())
      .filter((e): e is string => Boolean(e));

    return [...new Set(emails)];
  }

  async getCustomerById(id: string): Promise<Customer | null> {
    const data = await this.get<{ customer?: PsCustomer }>(`/customers/${id}`, {
      display: "full",
    });
    return data?.customer ? mapCustomer(data.customer) : null;
  }

  /** Lookup client avec statut HTTP — évite de confondre erreur réseau et 404. */
  async fetchCustomerById(id: string): Promise<{
    customer: Customer | null;
    notFound: boolean;
    error: boolean;
  }> {
    const { data, status, error } = await this.request<{ customer?: PsCustomer }>(
      `/customers/${id}`,
      { display: "full" },
    );
    if (data?.customer) {
      return { customer: mapCustomer(data.customer), notFound: false, error: false };
    }
    if (status === 404) {
      return { customer: null, notFound: true, error: false };
    }
    return { customer: null, notFound: false, error: Boolean(error) || status !== 200 };
  }

  /**
   * Create a customer. Mot de passe en clair — PrestaShop hash via le webservice.
   */
  async createCustomer(input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    newsletter?: boolean;
    secureKey?: string;
  }): Promise<{
    customer: Customer | null;
    secureKey: string | null;
    status: number | null;
    error: string | null;
  }> {
    const secureKey = input.secureKey?.trim() || crypto.randomBytes(16).toString("hex");
    const xml = buildCustomerXml({ ...input, secureKey });
    const { data, status, error } = await this.post<{ customer?: PsCustomer }>(
      "/customers",
      xml,
    );

    let customer = data?.customer ? mapCustomer(data.customer) : null;
    if (!customer && status !== null && status < 400) {
      const createdId = extractCreatedId(data, "customer");
      if (createdId) {
        const ps = await this.getCustomerRecord(createdId);
        if (ps) customer = mapCustomer(ps);
      }
      if (!customer) {
        const existing = await this.getCustomerAuthByEmail(input.email);
        if (existing) customer = existing;
      }
    }

    return {
      customer,
      secureKey: customer ? secureKey : null,
      status,
      error,
    };
  }

  // ─────────────────────────────────────────────
  // CHECKOUT (write) — best-effort order creation
  // ─────────────────────────────────────────────
  //
  // ⚠️ IMPORTANT : créer une commande via le Webservice PrestaShop dépend
  // fortement de la configuration de votre boutique (transporteur, devise,
  // pays, états de commande, module de paiement). Ce flux crée la commande en
  // "En attente de paiement". L'encaissement réel d'une carte nécessite un
  // prestataire de paiement (Stripe/PayPal) — voir le guide fourni.

  /** Resolve the id of the first row of a resource (optionally filtered). */
  private async resolveFirstId(
    resource: string,
    filters: Record<string, string | number> = {},
  ): Promise<string | null> {
    const { data } = await this.request<Record<string, unknown>>(resource, {
      display: "full",
      limit: "1",
      ...filters,
    });
    const key = resource.replace(/^\//, "");
    const row = asArray<{ id?: string }>(data as never, key)[0];
    return row?.id ?? null;
  }

  private guessCountryIso(input: string): string | null {
    const normalized = input.trim().toLowerCase();
    const aliases: Record<string, string> = {
      france: "FR",
      fr: "FR",
      belgique: "BE",
      belgium: "BE",
      suisse: "CH",
      switzerland: "CH",
      luxembourg: "LU",
      monaco: "MC",
      canada: "CA",
      "états-unis": "US",
      "etats-unis": "US",
      usa: "US",
      espagne: "ES",
      spain: "ES",
      italie: "IT",
      italy: "IT",
      allemagne: "DE",
      germany: "DE",
      "royaume-uni": "GB",
      "united kingdom": "GB",
      uk: "GB",
    };
    if (aliases[normalized]) return aliases[normalized];
    if (/^[a-z]{2}$/i.test(input.trim())) return input.trim().toUpperCase();
    return null;
  }

  private async resolveCountryId(name: string): Promise<string | null> {
    const trimmed = name.trim();
    const candidates = new Set<string>();
    const guessed = this.guessCountryIso(trimmed);
    if (guessed) candidates.add(guessed);
    if (/^[A-Za-z]{2}$/.test(trimmed)) candidates.add(trimmed.toUpperCase());
    candidates.add("FR");

    for (const iso of candidates) {
      for (const filterValue of [iso, `[${iso}]`]) {
        const id = await this.resolveFirstId("/countries", {
          "filter[iso_code]": filterValue,
          "filter[active]": "1",
        });
        if (id) return id;
      }
    }

    const { data } = await this.request<Record<string, unknown>>("/countries", {
      display: "full",
      "filter[active]": "1",
      limit: "250",
    });
    const countries = asArray<{
      id?: string;
      iso_code?: string;
      name?: unknown;
    }>(data as never, "countries");

    const needle = trimmed.toLowerCase();
    for (const country of countries) {
      const id = country.id ? String(country.id) : null;
      if (!id) continue;

      const iso = country.iso_code?.trim().toUpperCase();
      if (iso && (iso === needle.toUpperCase() || needle === iso.toLowerCase())) {
        return id;
      }

      const labels: string[] = [];
      const rawName = country.name;
      if (typeof rawName === "string") {
        labels.push(rawName);
      } else if (rawName && typeof rawName === "object") {
        for (const value of Object.values(rawName as Record<string, string>)) {
          if (typeof value === "string" && value.trim()) labels.push(value);
        }
      }

      for (const label of labels) {
        const labelNorm = label.trim().toLowerCase();
        if (
          labelNorm === needle ||
          labelNorm.includes(needle) ||
          needle.includes(labelNorm)
        ) {
          return id;
        }
      }
    }

    console.error("[prestashop] resolveCountryId failed", {
      input: trimmed,
      countries: countries.length,
    });
    return null;
  }

  /**
   * Appends a private message on an order (visible in le back-office PrestaShop).
   * Utilisé pour transmettre les instructions de flocage au fournisseur.
   */
  async addOrderMessage(orderId: string, message: string): Promise<void> {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <message>
    <id_order>${escapeXml(orderId)}</id_order>
    <message>${escapeXml(message)}</message>
    <private>1</private>
  </message>
</prestashop>`;
    const { status, error } = await this.post("/messages", xml);
    if (status && status >= 400) {
      console.warn(`[prestashop] order message failed order=${orderId}`, error);
    }
  }

  private async lookupOrderByCartId(
    cartId: string,
  ): Promise<{ orderId: string | null; reference: string | null }> {
    const lookup = await this.request<{ orders?: PsOrder[] }>("/orders", {
      display: "[id,reference]",
      "filter[id_cart]": cartId,
      sort: "[id_DESC]",
      limit: 1,
    });
    const found = asArray<PsOrder>(lookup.data as never, "orders")[0];
    if (!found?.id) return { orderId: null, reference: null };
    return {
      orderId: String(found.id),
      reference: found.reference ? String(found.reference) : null,
    };
  }

  /** POST /orders peut renvoyer 500 après création (ex. e-mail « payment » manquant). */
  private isRecoverableOrderPostError(
    status: number | null,
    error: string | null,
  ): boolean {
    if (status !== null && status < 400) return true;
    if (!error) return false;
    const lower = error.toLowerCase();
    return (
      lower.includes("modèle d'e-mail") ||
      lower.includes("modele d'e-mail") ||
      lower.includes("email template") ||
      lower.includes("e-mail template") ||
      lower.includes("mail template is missing") ||
      lower.includes("template is missing")
    );
  }

  async createOrder(input: CreateOrderInput): Promise<{
    reference: string | null;
    orderId: string | null;
    error: string | null;
  }> {
    if (!this.isConfigured) {
      return { reference: null, orderId: null, error: "not_configured" };
    }

    try {
      const langId = serverConfig.langId;

      const [carrierId, currencyId, countryId] = await Promise.all([
        this.resolveFirstId("/carriers", { "filter[active]": "1" }),
        this.resolveFirstId("/currencies", { "filter[iso_code]": "EUR" }),
        this.resolveCountryId(input.address.country),
      ]);

      if (!carrierId)
        return { reference: null, orderId: null, error: "no_carrier_configured" };
      if (!countryId)
        return { reference: null, orderId: null, error: "no_country_resolved" };
      const idCurrency = currencyId ?? "1";

      // 1) Address
      const addrRes = await this.post<{ address?: { id?: string } }>(
        "/addresses",
        buildAddressXml({ ...input, countryId, langId }),
      );
      const addressId = addrRes.data?.address?.id;
      if (!addressId)
        return {
          reference: null,
          orderId: null,
          error: `address_failed: ${addrRes.error ?? "unknown"}`,
        };

      // 2) Cart (+ rows)
      const cartRes = await this.post<{ cart?: { id?: string } }>(
        "/carts",
        buildCartXml({
          customerId: input.customerId,
          addressId,
          idCurrency,
          langId,
          carrierId,
          secureKey: input.secureKey,
          lines: input.lines,
        }),
      );
      const cartId = cartRes.data?.cart?.id;
      if (!cartId)
        return {
          reference: null,
          orderId: null,
          error: `cart_failed: ${cartRes.error ?? "unknown"}`,
        };

      // 3) Order
      const totalProducts = input.lines.reduce(
        (s, l) => s + l.unitPrice * l.quantity,
        0,
      );
      const shippingFee = Math.max(0, input.shippingFee ?? 0);
      const orderRes = await this.post<{ order?: { id?: string; reference?: string } }>(
        "/orders",
        buildOrderXml({
          customerId: input.customerId,
          addressId,
          cartId,
          idCurrency,
          langId,
          carrierId,
          totalProducts,
          shippingFee,
          secureKey: input.secureKey,
        }),
      );

      let orderId =
        orderRes.data?.order?.id != null
          ? String(orderRes.data.order.id)
          : extractCreatedId(orderRes.data, "order");
      let reference =
        orderRes.data?.order?.reference != null
          ? String(orderRes.data.order.reference)
          : null;

      // PrestaShop crée parfois la commande mais renvoie du XML, un JSON sans id,
      // ou une 500 si l'envoi d'e-mail échoue (modèle « payment » manquant, etc.).
      if (
        !orderId &&
        this.isRecoverableOrderPostError(orderRes.status, orderRes.error)
      ) {
        const recovered = await this.lookupOrderByCartId(cartId);
        orderId = recovered.orderId;
        reference = recovered.reference ?? reference;
        if (orderId && orderRes.error) {
          console.warn(
            `[prestashop] order recovered after POST /orders error (cart=${cartId} order=${orderId})`,
            orderRes.error,
          );
        }
      }

      if (!orderId) {
        return {
          reference: null,
          orderId: null,
          error: `order_failed: ${orderRes.error ?? "unknown"}`,
        };
      }

      // Note fournisseur (flocage, etc.) — non bloquant si l'API messages échoue.
      if (input.note?.trim()) {
        await this.addOrderMessage(orderId, input.note.trim());
      }

      return {
        reference: reference ?? orderId,
        orderId,
        error: null,
      };
    } catch (error) {
      return { reference: null, orderId: null, error: String(error) };
    }
  }

  /** Diminue le stock PrestaShop après une commande validée. */
  async decrementStockForLines(lines: CreateOrderLine[]): Promise<void> {
    for (const line of lines) {
      await this.adjustStockQuantity(
        line.productId,
        line.variantId,
        -Math.max(1, line.quantity),
      );
    }
  }

  // ─────────────────────────────────────────────
  // PRODUCT IMPORT (write)
  // ─────────────────────────────────────────────

  /** Crée un produit actif dans PrestaShop. */
  async createProduct(input: CreateProductInput): Promise<string> {
    const langId = serverConfig.langId;
    const shopId = this.resolveShopId();
    const xml = buildProductCreateXml({ ...input, langId, shopId });
    const { data, status, error } = await this.post("/products", xml, {
      id_shop: shopId,
    });
    if (status !== null && status >= 400) {
      throw new Error(`Création produit échouée : ${error ?? status}`);
    }
    const id = extractCreatedId(data, "product");
    if (!id) throw new Error("Produit créé mais identifiant introuvable.");
    await this.assignProductCategory(id, input.categoryId, input.associationIds, {
      price: input.price,
      name: input.name,
      linkRewrite: input.linkRewrite,
    });
    await this.ensureProductShopAssociation(id, {
      price: input.price,
      categoryId: input.categoryId,
      name: input.name,
      linkRewrite: input.linkRewrite,
    });
    await this.verifyProductIsListable(id);
    return id;
  }

  /**
   * PrestaShop multishop: products can exist in ps_product + ps_category_product
   * but stay invisible in Catalogue → Produits without a ps_product_shop row.
   */
  private async ensureProductShopAssociation(
    productId: string,
    options?: {
      price?: number;
      categoryId?: string;
      name?: string;
      linkRewrite?: string;
    },
  ): Promise<void> {
    const shopId = this.resolveShopId();
    const langId = serverConfig.langId;
    const categoryId = String(options?.categoryId ?? "").trim();

    const raw = await this.getProductRawXml(productId);

    // Ne JAMAIS écraser un prix existant avec 0 — c'était la cause des 0 € en boutique.
    let price: string | undefined;
    if (
      options?.price !== undefined &&
      Number.isFinite(options.price) &&
      options.price > 0
    ) {
      price = options.price.toFixed(6);
    } else if (raw) {
      const existing = extractXmlScalarField(raw, "price");
      const parsed = Number.parseFloat(String(existing ?? "").replace(",", "."));
      if (Number.isFinite(parsed) && parsed > 0) {
        price = parsed.toFixed(6);
      }
    }

    if (raw) {
      let patched = patchProductShopXml(raw, {
        shopId,
        price,
        categoryId: categoryId || undefined,
      });
      patched = patchProductLangFields(patched, langId, options);
      const { status, error } = await this.put(`/products/${productId}`, patched, {
        id_shop: shopId,
      });
      if (status !== null && status < 400) return;
      console.warn(
        `[prestashop] ensureProductShopAssociation full-xml PUT failed product=${productId} shop=${shopId}`,
        error,
      );
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product>
    <id>${escapeXml(productId)}</id>
    <active>1</active>
    <visibility>both</visibility>
    <available_for_order>1</available_for_order>
    <show_price>1</show_price>
    <state>1</state>
    <id_shop_default>${escapeXml(shopId)}</id_shop_default>
    ${price ? `<price>${escapeXml(price)}</price>` : ""}
    ${categoryId ? `<id_category_default>${escapeXml(categoryId)}</id_category_default>` : ""}
    ${options?.name ? langFieldXml("name", options.name, langId) : ""}
    ${options?.name ? langFieldXml("link_rewrite", options.linkRewrite ?? slugify(options.name), langId) : ""}
  </product>
</prestashop>`;

    const { status, error } = await this.put(`/products/${productId}`, xml, {
      id_shop: shopId,
    });
    if (status !== null && status >= 400) {
      throw new Error(
        `Association boutique échouée pour le produit #${productId} (shop ${shopId}) : ${error ?? status}. Exécutez scripts/migration/prestashop-fix-product-shop.sql dans phpMyAdmin.`,
      );
    }
  }

  /**
   * Confirms the product appears in the active catalogue (same query as the BO
   * product list). Throws if it only exists in category associations.
   */
  async verifyProductIsListable(productId: string): Promise<void> {
    const shopId = this.resolveShopId();
    const listParams = {
      display: "[id,active,visibility]",
      "filter[id]": `[${productId}]`,
      "filter[active]": "1",
      id_shop: shopId,
      limit: "1",
    };

    for (let attempt = 0; attempt < 4; attempt++) {
      const { data } = await this.request<{ products?: PsProduct[] }>(
        "/products",
        listParams,
      );
      const found = asArray<PsProduct>(data as never, "products").some(
        (product) => String(product.id) === String(productId),
      );
      if (found) return;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 750));
      }
    }

    const { data: anyState } = await this.request<{ products?: PsProduct[] }>(
      "/products",
      {
        display: "[id,active]",
        "filter[id]": `[${productId}]`,
        id_shop: shopId,
        limit: "1",
      },
    );
    const existsInactive = asArray<PsProduct>(anyState as never, "products").length > 0;
    if (existsInactive) {
      throw new Error(
        `Produit #${productId} créé mais invisible dans Catalogue → Produits (shop ${shopId}). Lancez le script SQL prestashop-fix-product-shop.sql dans phpMyAdmin, videz le cache PrestaShop, puis réessayez.`,
      );
    }

    throw new Error(
      `Produit #${productId} introuvable — vérifiez PRESTASHOP_API_URL et PRESTASHOP_SHOP_ID (actuel : ${shopId}).`,
    );
  }

  /** Force la catégorie + associations parentes (évite le rattachement par défaut à Accueil). */
  async assignProductCategory(
    productId: string,
    categoryId: string,
    associationIds?: string[],
    options?: { price?: number; name?: string; linkRewrite?: string },
  ): Promise<void> {
    const defaultCategoryId = String(categoryId ?? "").trim();
    if (!defaultCategoryId) {
      throw new Error("Catégorie produit invalide.");
    }

    const langId = serverConfig.langId;

    const ids = associationIds?.length
      ? [
          ...new Set(
            associationIds.map((id) => String(id).trim()).filter(Boolean),
          ),
        ]
      : [defaultCategoryId];

    const raw = await this.getProductRawXml(productId);
    let price: string | undefined;
    if (
      options?.price !== undefined &&
      Number.isFinite(options.price) &&
      options.price > 0
    ) {
      price = options.price.toFixed(6);
    } else if (raw) {
      const existing = extractXmlScalarField(raw, "price");
      const parsed = Number.parseFloat(String(existing ?? "").replace(",", "."));
      if (Number.isFinite(parsed) && parsed > 0) {
        price = parsed.toFixed(6);
      }
    }

    if (raw) {
      let patched = patchProductCategoryXml(raw, defaultCategoryId, ids);
      patched = patchProductShopXml(patched, {
        shopId: this.resolveShopId(),
        price,
        categoryId: defaultCategoryId,
      });
      patched = patchProductLangFields(patched, langId, options);
      const { status, error } = await this.put(
        `/products/${productId}`,
        patched,
        this.shopQueryParams(),
      );
      if (status !== null && status < 400) {
        const verified = await this.getProductById(productId);
        if (
          verified &&
          (String(verified.defaultCategoryId ?? "").trim() === defaultCategoryId ||
            verified.categoryIds.some(
              (id) => String(id).trim() === defaultCategoryId,
            ))
        ) {
          return;
        }
      }
      console.warn(
        `[prestashop] category raw-xml PUT failed product=${productId} category=${defaultCategoryId}`,
        error,
      );
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product>
    <id>${escapeXml(productId)}</id>
    ${price ? `<price>${escapeXml(price)}</price>` : ""}
    <id_category_default>${escapeXml(defaultCategoryId)}</id_category_default>
    ${options?.name ? langFieldXml("name", options.name, langId) : ""}
    ${options?.name ? langFieldXml("link_rewrite", options.linkRewrite ?? slugify(options.name), langId) : ""}
    <associations>
      <categories>
${ids
  .map(
    (id) => `        <category>
          <id>${escapeXml(id)}</id>
        </category>`,
  )
  .join("\n")}
      </categories>
    </associations>
  </product>
</prestashop>`;

    const { status, error } = await this.put(
      `/products/${productId}`,
      xml,
      this.shopQueryParams(),
    );
    if (status !== null && status >= 400) {
      throw new Error(
        `Impossible d'assigner la catégorie ${defaultCategoryId} au produit ${productId} : ${error ?? status}`,
      );
    }
  }

  private async getProductRawXml(id: string): Promise<string | null> {
    const client = this.getClient();
    if (!client) return null;

    const shopId = this.resolveShopId();

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await client.get<string>(`/products/${id}`, {
          params: { display: "full", id_shop: shopId },
          headers: { Accept: "application/xml" },
          responseType: "text",
          transformResponse: [(data: string) => data],
        });
        const body = res.data;
        if (typeof body === "string" && body.includes("<product>")) {
          return body;
        }
      } catch {
        // PrestaShop peut mettre quelques centaines de ms à indexer un nouveau produit.
      }
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }

    return null;
  }

  /** Met à jour le nom affiché + link_rewrite d'un produit. */
  async updateProductName(
    productId: string,
    name: string,
    linkRewrite?: string,
    price?: number,
  ): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) return;

    const langId = serverConfig.langId;
    const shopId = this.resolveShopId();
    const slug = linkRewrite?.trim() || slugify(trimmed);
    let priceStr: string | undefined;
    if (price !== undefined && Number.isFinite(price) && price > 0) {
      priceStr = price.toFixed(6);
    } else {
      const raw = await this.getProductRawXml(productId);
      if (raw) {
        const existing = extractXmlScalarField(raw, "price");
        const parsed = Number.parseFloat(String(existing ?? "").replace(",", "."));
        if (Number.isFinite(parsed) && parsed > 0) {
          priceStr = parsed.toFixed(6);
        }
      }
    }

    const minimalXml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product>
    <id>${escapeXml(productId)}</id>
    <active>1</active>
    ${priceStr ? `<price>${escapeXml(priceStr)}</price>` : ""}
    ${langFieldXml("name", trimmed, langId)}
    ${langFieldXml("link_rewrite", slug, langId)}
  </product>
</prestashop>`;

    const { status, error } = await this.put(
      `/products/${productId}`,
      minimalXml,
      this.shopQueryParams(),
    );
    if (status !== null && status < 400) return;

    for (let attempt = 0; attempt < 3; attempt++) {
      const raw = await this.getProductRawXml(productId);
      if (raw) {
        let patched = patchLangFieldXml(raw, "name", trimmed, langId);
        patched = patchLangFieldXml(patched, "link_rewrite", slug, langId);
        if (priceStr) {
          patched = patchXmlScalarField(patched, "price", priceStr);
        }
        patched = patchXmlScalarField(patched, "active", "1");
        const full = await this.put(
          `/products/${productId}`,
          patched,
          this.shopQueryParams(),
        );
        if (full.status !== null && full.status < 400) return;
        throw new Error(
          `Renommage produit ${productId} échoué : ${full.error ?? full.status}`,
        );
      }
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }

    throw new Error(
      `Renommage produit ${productId} échoué : ${error ?? "produit introuvable"} (shop ${shopId})`,
    );
  }

  /** Liste une page de produits (sans filtre boutique — couvre tout le catalogue actif). */
  async listProductNamesPage(options: {
    page: number;
    pageSize?: number;
    includeInactive?: boolean;
  }): Promise<{
    items: { id: string; name: string }[];
    hasMore: boolean;
  }> {
    const page = Math.max(1, options.page);
    const limit = Math.max(1, options.pageSize ?? 25);
    const offset = (page - 1) * limit;
    const includeInactive =
      options.includeInactive ?? process.env.PRESTASHOP_INCLUDE_INACTIVE === "1";

    const params: Record<string, string | number> = {
      display: "[id,name]",
      limit: offset > 0 ? `${offset},${limit + 1}` : `${limit + 1}`,
    };
    if (!includeInactive) {
      params["filter[active]"] = "1";
    }

    const { data } = await this.request<{ products?: PsProduct[] }>(
      "/products",
      params,
    );
    const raw = asArray<PsProduct>(data as never, "products");
    const hasMore = raw.length > limit;
    const items = raw.slice(0, limit).map((product) => ({
      id: psStr(product.id),
      name: resolveLang(product.name),
    }));

    return { items, hasMore };
  }

  /** Liste tous les produits (noms bruts PrestaShop) pour migrations batch. */
  async listAllProductNames(
    options: { includeInactive?: boolean } = {},
  ): Promise<{ id: string; name: string }[]> {
    const items: { id: string; name: string }[] = [];
    let page = 1;
    const limit = 100;

    while (true) {
      const batch = await this.listProductNamesPage({
        page,
        pageSize: limit,
        includeInactive: options.includeInactive,
      });
      items.push(...batch.items);
      if (!batch.hasMore) break;
      page += 1;
    }

    return items;
  }

  /**
   * Même filtre que Catalogue → Produits : actif boutique + visibility both/catalog.
   */
  async isProductBoListable(productId: string): Promise<boolean> {
    const shopId = this.resolveShopId();
    const { data } = await this.request<{ products?: PsProduct[] }>("/products", {
      display: "[id,active,visibility]",
      "filter[id]": `[${productId}]`,
      "filter[active]": "1",
      ...this.shopQueryParams(),
      limit: "1",
    });
    const product = asArray<PsProduct>(data as never, "products")[0];
    if (!product) return false;
    const visibility = String(product.visibility ?? "").toLowerCase();
    return visibility === "both" || visibility === "catalog";
  }

  /** Télécharge une image produit depuis l’API PrestaShop (auth serveur). */
  async fetchProductImageBuffer(
    productId: string,
    imageId: string,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    if (!/^\d+$/.test(productId) || !/^\d+$/.test(imageId)) {
      throw new Error("Identifiants image invalides.");
    }
    const base = serverConfig.apiUrl.replace(/\/$/, "");
    const url = `${base}/images/products/${productId}/${imageId}`;
    const auth = Buffer.from(`${serverConfig.apiKey}:`).toString("base64");
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!response.ok) {
      throw new Error(`Image PrestaShop #${imageId} inaccessible (${response.status}).`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.byteLength < 2_500) {
      throw new Error(`Image PrestaShop #${imageId} trop petite.`);
    }
    const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    return { buffer, mimeType };
  }

  /** Désactive un produit (utile après re-clonage pour éviter les doublons site). */
  async setProductActive(productId: string, active: boolean): Promise<void> {
    const raw = await this.getProductRawXml(productId);
    if (!raw) {
      throw new Error(`Produit #${productId} introuvable pour mise à jour active.`);
    }
    let patched = patchXmlScalarField(raw, "active", active ? "1" : "0");
    patched = patchProductShopXml(patched, {
      shopId: this.resolveShopId(),
    });
    const { status, error } = await this.put(`/products/${productId}`, patched, {
      ...this.shopQueryParams(),
    });
    if (status !== null && status >= 400) {
      throw new Error(
        `Mise à jour active produit #${productId} échouée : ${error ?? status}`,
      );
    }
  }

  /** Téléverse une image distante vers un produit PrestaShop. */
  async uploadProductImageFromUrl(
    productId: string,
    imageUrl: string,
    referer?: string,
  ): Promise<void> {
    const { validateSourceUrl } = await import("@/lib/product-import/validate-url");
    const url = await validateSourceUrl(imageUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    let response: Response;
    try {
      response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          ...(referer ? { Referer: referer } : {}),
        },
        redirect: "follow",
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new Error(`Image inaccessible (${response.status}).`);
    }

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      throw new Error("L'URL ne pointe pas vers une image.");
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength < 8_000) {
      throw new Error("Image trop petite (probablement une miniature).");
    }
    if (buffer.byteLength > 8 * 1024 * 1024) {
      throw new Error("Image trop volumineuse (max 8 Mo).");
    }

    await this.uploadProductImageBuffer(productId, buffer, contentType);
  }

  /** Résout les IDs d'attributs « Taille » pour les libellés demandés. */
  async resolveSizeOptionValues(
    sizeLabels: readonly string[],
    attributeGroupId?: string,
  ): Promise<{ id: string; label: string }[]> {
    let groupId = attributeGroupId?.trim() || (await this.findSizeAttributeGroupId());

    const loadValues = async (filterGroupId?: string) => {
      const params: Record<string, string | number> = { display: "full" };
      if (filterGroupId) params["filter[id_attribute_group]"] = filterGroupId;

      const data = await this.get<{ product_option_values?: PsProductOptionValue[] }>(
        "/product_option_values",
        params,
      );
      return data?.product_option_values ?? [];
    };

    let values = await loadValues(groupId);
    const byLabel = new Map<string, PsProductOptionValue>();
    for (const value of values) {
      const label = resolveLang(value.name).trim().toUpperCase();
      if (label) byLabel.set(label, value);
    }

    const matched: { id: string; label: string }[] = [];
    for (const size of sizeLabels) {
      const key = size.trim().toUpperCase();
      let row = byLabel.get(key);

      if (!row?.id && groupId) {
        const unfiltered = await loadValues();
        for (const value of unfiltered) {
          const label = resolveLang(value.name).trim().toUpperCase();
          if (label === key) {
            row = value;
            byLabel.set(key, value);
            break;
          }
        }
      }

      if (!row?.id && key === "XXL" && productImportConfig.xxlAttributeId) {
        matched.push({ id: productImportConfig.xxlAttributeId, label: size });
        continue;
      }

      if (!row?.id && groupId) {
        const createdId = await this.createSizeOptionValue(groupId, size);
        if (createdId) {
          row = { id: createdId, name: size } as PsProductOptionValue;
          byLabel.set(key, row);
        }
      }
      if (row?.id) matched.push({ id: String(row.id), label: size });
    }
    return matched;
  }

  /** Crée une valeur d'attribut « Taille » manquante (ex. XXL). */
  private async createSizeOptionValue(
    groupId: string,
    label: string,
  ): Promise<string | null> {
    const langId = serverConfig.langId;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product_option_value>
    <id_attribute_group>${escapeXml(groupId)}</id_attribute_group>
    ${langFieldXml("name", label.trim().toUpperCase(), langId)}
  </product_option_value>
</prestashop>`;

    const { data, status, error } = await this.post(
      "/product_option_values",
      xml,
      this.shopQueryParams(),
    );
    if (status !== null && status >= 400) {
      console.warn(
        `[prestashop] createSizeOptionValue failed label=${label} group=${groupId}`,
        error,
      );
      return null;
    }
    return extractCreatedId(data, "product_option_value");
  }

  /** Crée une déclinaison (combinaison) pour un produit. */
  async createProductCombination(input: {
    productId: string;
    optionValueId: string;
  }): Promise<string> {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <combination>
    <id_product>${escapeXml(input.productId)}</id_product>
    <minimal_quantity>1</minimal_quantity>
    <associations>
      <product_option_values>
        <product_option_value>
          <id>${escapeXml(input.optionValueId)}</id>
        </product_option_value>
      </product_option_values>
    </associations>
  </combination>
</prestashop>`;

    const { data, status, error } = await this.post("/combinations", xml);
    if (status !== null && status >= 400) {
      throw new Error(`Création déclinaison échouée : ${error ?? status}`);
    }
    const id = extractCreatedId(data, "combination");
    if (!id) throw new Error("Déclinaison créée mais identifiant introuvable.");
    return id;
  }

  /** Ajoute une déclinaison XXL si le produit a des tailles mais pas encore XXL. */
  async ensureXxlForProduct(
    productId: string,
  ): Promise<{
    created: boolean;
    skipped?: boolean;
    alreadyHasXxl?: boolean;
    error?: string;
  }> {
    try {
      const product = await this.getProductById(productId);
      if (!product?.variants.length) return { created: false, skipped: true };

      const hasXxl = product.variants.some((variant) =>
        variant.options.some((o) => o.label.trim().toUpperCase() === "XXL"),
      );
      if (hasXxl) return { created: false, alreadyHasXxl: true };

      const xxlValues = await this.resolveSizeOptionValues(
        ["XXL"],
        productImportConfig.sizeAttributeGroupId || undefined,
      );
      const xxl = xxlValues[0];
      if (!xxl) return { created: false, error: "xxl_attribute_missing" };

      const combinationId = await this.createProductCombination({
        productId,
        optionValueId: xxl.id,
      });
      await this.setStockQuantity(
        productId,
        combinationId,
        productImportConfig.defaultStock,
      );
      return { created: true };
    } catch (err) {
      return { created: false, error: String(err) };
    }
  }

  /** Parcourt une page du catalogue et crée les déclinaisons XXL manquantes. */
  async ensureXxlForCatalogPage(options: {
    page: number;
    pageSize?: number;
  }): Promise<{
    page: number;
    processed: number;
    withVariants: number;
    alreadyHasXxl: number;
    created: number;
    skipped: number;
    errors: number;
    hasMore: boolean;
    errorDetails: Array<{ productId: string; name: string; error: string }>;
  }> {
    const pageSize = options.pageSize ?? 25;
    const page = Math.max(1, options.page);
    const batch = await this.listProductNamesPage({ page, pageSize });

    let withVariants = 0;
    let alreadyHasXxl = 0;
    let created = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: Array<{ productId: string; name: string; error: string }> =
      [];

    for (const product of batch.items) {
      const result = await this.ensureXxlForProduct(product.id);
      if (result.skipped) {
        skipped++;
        continue;
      }
      withVariants++;
      if (result.alreadyHasXxl) {
        alreadyHasXxl++;
        continue;
      }
      if (result.created) created++;
      if (result.error) {
        errors++;
        errorDetails.push({
          productId: product.id,
          name: product.name,
          error: result.error,
        });
      }
    }

    return {
      page,
      processed: batch.items.length,
      withVariants,
      alreadyHasXxl,
      created,
      skipped,
      errors,
      hasMore: batch.hasMore,
      errorDetails,
    };
  }

  /** Parcourt tout le catalogue (usage CLI / curl). Préférer ensureXxlForCatalogPage côté UI. */
  async ensureXxlForCatalog(options?: {
    pageSize?: number;
    maxPages?: number;
  }): Promise<{
    processed: number;
    withVariants: number;
    alreadyHasXxl: number;
    created: number;
    skipped: number;
    errors: number;
    pages: number;
    errorDetails: Array<{ productId: string; name: string; error: string }>;
  }> {
    const pageSize = options?.pageSize ?? 25;
    const maxPages = options?.maxPages ?? 100;
    let processed = 0;
    let withVariants = 0;
    let alreadyHasXxl = 0;
    let created = 0;
    let skipped = 0;
    let errors = 0;
    let pages = 0;
    const errorDetails: Array<{ productId: string; name: string; error: string }> =
      [];

    for (let page = 1; page <= maxPages; page++) {
      const batch = await this.ensureXxlForCatalogPage({ page, pageSize });
      if (!batch.processed) break;

      pages++;
      processed += batch.processed;
      withVariants += batch.withVariants;
      alreadyHasXxl += batch.alreadyHasXxl;
      created += batch.created;
      skipped += batch.skipped;
      errors += batch.errors;
      errorDetails.push(...batch.errorDetails);

      if (!batch.hasMore) break;
    }

    return {
      processed,
      withVariants,
      alreadyHasXxl,
      created,
      skipped,
      errors,
      pages,
      errorDetails,
    };
  }

  /** Fixe le stock absolu pour un produit ou une déclinaison. */
  async setStockQuantity(
    productId: string,
    variantId: string | null,
    quantity: number,
  ): Promise<void> {
    const attrId = variantId ? String(variantId) : "0";
    const row = await this.ensureStockRow(productId, attrId);
    await this.writeStockRow(row, productId, attrId, Math.max(0, quantity));
  }

  private async findStockRow(
    productId: string,
    attrId: string,
  ): Promise<PsStockAvailable | null> {
    const shopId = this.resolveShopId();

    for (let attempt = 0; attempt < 4; attempt++) {
      const { data } = await this.request<{ stock_availables?: PsStockAvailable[] }>(
        "/stock_availables",
        {
          display: "full",
          "filter[id_product]": productId,
          "filter[id_product_attribute]": attrId,
          id_shop: shopId,
          limit: "5",
        },
      );

      const row = asArray<PsStockAvailable>(data as never, "stock_availables")[0];
      if (row?.id) return row;

      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }

    return null;
  }

  private async ensureStockRow(
    productId: string,
    attrId: string,
  ): Promise<PsStockAvailable> {
    const existing = await this.findStockRow(productId, attrId);
    if (existing?.id) return existing;

    const shopId = this.resolveShopId();
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <stock_available>
    <id_product>${escapeXml(productId)}</id_product>
    <id_product_attribute>${escapeXml(attrId)}</id_product_attribute>
    <id_shop>${escapeXml(shopId)}</id_shop>
    <id_shop_group>0</id_shop_group>
    <depends_on_stock>0</depends_on_stock>
    <out_of_stock>2</out_of_stock>
    <quantity>0</quantity>
  </stock_available>
</prestashop>`;

    const { data, status, error } = await this.post("/stock_availables", xml, {
      id_shop: shopId,
    });
    if (status !== null && status >= 400) {
      throw new Error(
        `Création stock échouée pour produit #${productId} : ${error ?? status}`,
      );
    }

    const id = extractCreatedId(data, "stock_available");
    if (!id) {
      const created = await this.findStockRow(productId, attrId);
      if (created?.id) return created;
      throw new Error(
        `Stock introuvable pour le produit #${productId} (déclinaison ${attrId}).`,
      );
    }

    return {
      id,
      id_product: productId,
      id_product_attribute: attrId,
      id_shop: shopId,
      id_shop_group: "0",
      depends_on_stock: "0",
      out_of_stock: "2",
      quantity: "0",
    };
  }

  private async findSizeAttributeGroupId(): Promise<string | undefined> {
    const data = await this.get<{ product_options?: PsAttributeGroup[] }>(
      "/product_options",
      { display: "full" },
    );
    for (const group of data?.product_options ?? []) {
      const name = resolveLang(group.public_name ?? group.name).toLowerCase();
      if (/taille|size/.test(name)) return String(group.id);
    }
    return undefined;
  }

  /** Téléverse un buffer image (import traité ou brut). */
  async uploadProductImageFromBuffer(
    productId: string,
    buffer: Buffer,
    mime: string,
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await this.uploadProductImageBuffer(productId, buffer, mime);
        await this.verifyProductHasCoverImage(productId);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
      }
    }

    throw (
      lastError ??
      new Error(`Upload image échoué pour le produit #${productId}.`)
    );
  }

  /** Vérifie qu'au moins une image est associée au produit dans la boutique active. */
  async verifyProductHasCoverImage(productId: string): Promise<void> {
    const shopId = this.resolveShopId();
    const { data } = await this.request<Record<string, unknown>>(
      `/products/${productId}`,
      { display: "[id,id_default_image]", id_shop: shopId },
    );

    const product =
      (data?.product as { id_default_image?: string | number } | undefined) ??
      asArray<{ id_default_image?: string | number }>(data as never, "products")[0];

    const imageId = String(product?.id_default_image ?? "").trim();
    if (imageId && imageId !== "0") return;

    throw new Error(
      `Image non associée au produit #${productId} (shop ${shopId}).`,
    );
  }

  /** Vérifie qu'au moins une ligne de stock porte une quantité > 0. */
  async verifyProductHasStock(productId: string, minQuantity = 1): Promise<void> {
    const shopId = this.resolveShopId();
    const { data } = await this.request<{ stock_availables?: PsStockAvailable[] }>(
      "/stock_availables",
      {
        display: "[id,quantity,id_product_attribute]",
        "filter[id_product]": productId,
        id_shop: shopId,
        limit: "50",
      },
    );

    const rows = asArray<PsStockAvailable>(data as never, "stock_availables");
    const maxQty = rows.reduce((max, row) => {
      const qty = Number.parseInt(row.quantity ?? "0", 10) || 0;
      return Math.max(max, qty);
    }, 0);

    if (maxQty >= minQuantity) return;

    throw new Error(
      `Stock non appliqué pour le produit #${productId} (max trouvé: ${maxQty}, attendu: ≥${minQuantity}).`,
    );
  }

  private async uploadProductImageBuffer(
    productId: string,
    buffer: Buffer,
    mime: string,
  ): Promise<void> {
    await this.uploadResourceImageBuffer("products", productId, buffer, mime);
  }

  private async uploadResourceImageBuffer(
    resource: "products" | "categories",
    resourceId: string,
    buffer: Buffer,
    mime: string,
  ): Promise<void> {
    const baseUrl = serverConfig.apiUrl.replace(/\/$/, "");
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    const form = new FormData();
    form.append(
      "image",
      new Blob([new Uint8Array(buffer)], { type: mime }),
      `image.${ext}`,
    );

    const shopId = this.resolveShopId();
    const res = await fetch(
      `${baseUrl}/images/${resource}/${resourceId}?output_format=JSON&id_shop=${encodeURIComponent(shopId)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${serverConfig.apiKey}:`).toString("base64")}`,
        },
        body: form,
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Upload image PrestaShop échoué (${res.status}) : ${text.slice(0, 200)}`,
      );
    }
  }

  private async adjustStockQuantity(
    productId: string,
    variantId: string | null,
    delta: number,
  ): Promise<void> {
    const attrId = variantId ? String(variantId) : "0";
    const { data } = await this.request<{ stock_availables?: PsStockAvailable[] }>(
      "/stock_availables",
      {
        display: "full",
        "filter[id_product]": productId,
        "filter[id_product_attribute]": attrId,
      },
    );

    const row = asArray<PsStockAvailable>(data as never, "stock_availables")[0];
    if (!row?.id) {
      console.warn(
        `[prestashop] stock row not found product=${productId} attr=${attrId}`,
      );
      return;
    }

    const current = Number.parseInt(row.quantity ?? "0", 10) || 0;
    await this.writeStockRow(row, productId, attrId, Math.max(0, current + delta));
  }

  private async writeStockQuantity(
    productId: string,
    variantId: string | null,
    quantity: number,
  ): Promise<void> {
    const attrId = variantId ? String(variantId) : "0";
    const row = await this.ensureStockRow(productId, attrId);
    await this.writeStockRow(row, productId, attrId, quantity);
  }

  private async writeStockRow(
    row: PsStockAvailable,
    productId: string,
    attrId: string,
    quantity: number,
  ): Promise<void> {
    const dependsOnStock = row.depends_on_stock ?? "0";
    const outOfStock = row.out_of_stock ?? "2";
    const idShop = row.id_shop ?? "1";
    const idShopGroup = row.id_shop_group ?? "0";

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <stock_available>
    <id>${escapeXml(row.id)}</id>
    <id_product>${escapeXml(productId)}</id_product>
    <id_product_attribute>${escapeXml(attrId)}</id_product_attribute>
    <id_shop>${escapeXml(idShop)}</id_shop>
    <id_shop_group>${escapeXml(idShopGroup)}</id_shop_group>
    <depends_on_stock>${escapeXml(dependsOnStock)}</depends_on_stock>
    <out_of_stock>${escapeXml(outOfStock)}</out_of_stock>
    <quantity>${escapeXml(String(quantity))}</quantity>
  </stock_available>
</prestashop>`;

    const { status, error } = await this.put(`/stock_availables/${row.id}`, xml);
    if (status !== null && status >= 400) {
      throw new Error(
        `Mise à jour stock échouée pour produit #${productId} : ${error ?? status}`,
      );
    }
  }
}

export interface CreateProductInput {
  name: string;
  linkRewrite: string;
  price: number;
  categoryId: string;
  /** Chaîne feuille → parents pour les associations PrestaShop. */
  associationIds?: string[];
  reference?: string;
  description?: string;
  summary?: string;
}

export interface CreateCategoryInput {
  name: string;
  linkRewrite: string;
  parentId: string;
  description?: string;
}

export interface CreateOrderLine {
  productId: string;
  variantId: string | null;
  quantity: number;
  unitPrice: number;
  name?: string;
  flocage?: { name?: string; number?: string; text?: string; price: number };
}

export interface CreateOrderInput {
  customerId: string;
  secureKey: string;
  contact: { firstName: string; lastName: string; email: string; phone?: string };
  address: {
    address1: string;
    address2?: string;
    postcode: string;
    city: string;
    country: string;
  };
  lines: CreateOrderLine[];
  /** Note interne (flocage, instructions fournisseur). */
  note?: string;
  shippingFee?: number;
}

function buildAddressXml(input: {
  customerId: string;
  countryId: string;
  langId: string;
  contact: { firstName: string; lastName: string; phone?: string };
  address: { address1: string; address2?: string; postcode: string; city: string };
}): string {
  const { contact, address } = input;
  const alias = `Livraison ${Date.now()}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <address>
    <id_customer>${escapeXml(input.customerId)}</id_customer>
    <id_country>${escapeXml(input.countryId)}</id_country>
    <id_state>0</id_state>
    <alias>${escapeXml(alias)}</alias>
    <lastname>${escapeXml(contact.lastName || "Client")}</lastname>
    <firstname>${escapeXml(contact.firstName || "Client")}</firstname>
    <address1>${escapeXml(address.address1)}</address1>
    <address2>${escapeXml(address.address2 ?? "")}</address2>
    <postcode>${escapeXml(address.postcode)}</postcode>
    <city>${escapeXml(address.city)}</city>
    <phone>${escapeXml(contact.phone ?? "")}</phone>
    <phone_mobile>${escapeXml(contact.phone ?? "")}</phone_mobile>
    <active>1</active>
    <deleted>0</deleted>
  </address>
</prestashop>`;
}

function buildCartXml(input: {
  customerId: string;
  addressId: string;
  idCurrency: string;
  langId: string;
  carrierId: string;
  secureKey: string;
  lines: CreateOrderLine[];
}): string {
  const rows = input.lines
    .map(
      (l) => `      <cart_row>
        <id_product>${escapeXml(l.productId)}</id_product>
        <id_product_attribute>${escapeXml(l.variantId ?? "0")}</id_product_attribute>
        <id_address_delivery>${escapeXml(input.addressId)}</id_address_delivery>
        <quantity>${escapeXml(String(l.quantity))}</quantity>
      </cart_row>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <cart>
    <id_customer>${escapeXml(input.customerId)}</id_customer>
    <id_address_delivery>${escapeXml(input.addressId)}</id_address_delivery>
    <id_address_invoice>${escapeXml(input.addressId)}</id_address_invoice>
    <id_currency>${escapeXml(input.idCurrency)}</id_currency>
    <id_lang>${escapeXml(input.langId)}</id_lang>
    <id_carrier>${escapeXml(input.carrierId)}</id_carrier>
    <secure_key>${escapeXml(input.secureKey)}</secure_key>
    <associations>
      <cart_rows nodeType="cart_row" virtualEntity="true">
${rows}
      </cart_rows>
    </associations>
  </cart>
</prestashop>`;
}

function buildOrderXml(input: {
  customerId: string;
  addressId: string;
  cartId: string;
  idCurrency: string;
  langId: string;
  carrierId: string;
  totalProducts: number;
  shippingFee?: number;
  secureKey: string;
}): string {
  const shipping = Math.max(0, input.shippingFee ?? 0);
  const totalPaid = input.totalProducts + shipping;
  const products = input.totalProducts.toFixed(2);
  const shippingStr = shipping.toFixed(2);
  const total = totalPaid.toFixed(2);
  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <order>
    <id_address_delivery>${escapeXml(input.addressId)}</id_address_delivery>
    <id_address_invoice>${escapeXml(input.addressId)}</id_address_invoice>
    <id_cart>${escapeXml(input.cartId)}</id_cart>
    <id_currency>${escapeXml(input.idCurrency)}</id_currency>
    <id_lang>${escapeXml(input.langId)}</id_lang>
    <id_customer>${escapeXml(input.customerId)}</id_customer>
    <id_carrier>${escapeXml(input.carrierId)}</id_carrier>
    <current_state>1</current_state>
    <module>ps_wirepayment</module>
    <payment>Paiement en attente</payment>
    <total_paid>${total}</total_paid>
    <total_paid_real>0.00</total_paid_real>
    <total_products>${products}</total_products>
    <total_products_wt>${products}</total_products_wt>
    <total_shipping>${shippingStr}</total_shipping>
    <total_shipping_tax_incl>${shippingStr}</total_shipping_tax_incl>
    <conversion_rate>1.000000</conversion_rate>
    <secure_key>${escapeXml(input.secureKey)}</secure_key>
  </order>
</prestashop>`;
}

/** Escape a value for safe inclusion in an XML text node. */
function escapeXml(value: string | number | boolean | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cdata(value: string): string {
  return value.replace(/\]\]>/g, "]]]]><![CDATA[>");
}

function langFieldXml(tag: string, value: string, langId: string): string {
  return `<${tag}><language id="${escapeXml(langId)}"><![CDATA[${cdata(value)}]]></language></${tag}>`;
}

function extractCreatedId(data: unknown, resourceKey: string): string | null {
  if (typeof data === "string") {
    const match = data.match(
      new RegExp(
        `<${resourceKey}>[\\s\\S]*?<id>(?:<!\\[CDATA\\[)?([^<\\]]+)(?:\\]\\]>)?</id>`,
        "i",
      ),
    );
    return match?.[1]?.trim() ?? null;
  }

  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const resource = record[resourceKey];
  if (!resource || typeof resource !== "object") return null;
  const id = (resource as { id?: string | number }).id;
  return id !== undefined && id !== null ? String(id) : null;
}

/** Met à jour id_category_default + associations dans le XML produit complet. */
function patchProductCategoryXml(
  xml: string,
  categoryId: string,
  associationIds: string[],
): string {
  const ids = associationIds.length ? associationIds : [categoryId];
  let out = xml.replace(
    /<id_category_default>(?:<!\[CDATA\[)?[\s\S]*?(?:\]\]>)?<\/id_category_default>/,
    `<id_category_default><![CDATA[${categoryId}]]></id_category_default>`,
  );

  const categoriesXml = `<categories>
${ids
  .map(
    (id) => `<category>
<id><![CDATA[${id}]]></id>
</category>`,
  )
  .join("\n")}
</categories>`;

  if (/<categories>[\s\S]*?<\/categories>/.test(out)) {
    out = out.replace(/<categories>[\s\S]*?<\/categories>/, categoriesXml);
  } else if (/<associations>/.test(out)) {
    out = out.replace(/<associations>/, `<associations>\n${categoriesXml}\n`);
  }

  return out;
}

/** Force active + visibility + shop default on a full product XML payload. */
function patchProductShopXml(
  xml: string,
  opts: { shopId: string; price?: string; categoryId?: string },
): string {
  let out = xml;
  out = patchXmlScalarField(out, "active", "1");
  out = patchXmlScalarField(out, "visibility", "both");
  out = patchXmlScalarField(out, "available_for_order", "1");
  out = patchXmlScalarField(out, "show_price", "1");
  out = patchXmlScalarField(out, "state", "1");
  out = patchXmlScalarField(out, "id_shop_default", opts.shopId);
  if (opts.price) {
    const parsed = Number.parseFloat(opts.price);
    if (Number.isFinite(parsed) && parsed > 0) {
      out = patchXmlScalarField(out, "price", opts.price);
    }
  }
  if (opts.categoryId) {
    out = patchXmlScalarField(out, "id_category_default", opts.categoryId);
  }
  return out;
}

function patchXmlScalarField(xml: string, field: string, value: string): string {
  const re = new RegExp(
    `<${field}\\b[^>]*>(?:<!\\[CDATA\\[)?[\\s\\S]*?(?:\\]\\]>)?<\\/${field}>`,
    "i",
  );
  const replacement = `<${field}><![CDATA[${value}]]></${field}>`;
  if (re.test(xml)) return xml.replace(re, replacement);
  return xml.replace(/<\/product>/i, `    ${replacement}\n  </product>`);
}

function patchProductLangFields(
  xml: string,
  langId: string,
  options?: { name?: string; linkRewrite?: string },
): string {
  const name = options?.name?.trim();
  if (!name) return xml;

  let out = patchLangFieldXml(xml, "name", name, langId);
  out = patchLangFieldXml(
    out,
    "link_rewrite",
    options?.linkRewrite?.trim() || slugify(name),
    langId,
  );
  return out;
}

function patchLangFieldXml(
  xml: string,
  tag: string,
  value: string,
  langId: string,
): string {
  const fieldRe = new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, "i");
  const replacement = langFieldXml(tag, value, langId);
  if (fieldRe.test(xml)) {
    return xml.replace(fieldRe, replacement);
  }
  return xml.replace(/<\/product>/i, `  ${replacement}\n  </product>`);
}

/** Lit un champ scalaire simple dans le XML produit PrestaShop. */
function extractXmlScalarField(xml: string, field: string): string | null {
  const match = xml.match(
    new RegExp(
      `<${field}\\b[^>]*>(?:<!\\[CDATA\\[)?\\s*([^<\\]]+?)\\s*(?:\\]\\]>)?<\\/${field}>`,
      "i",
    ),
  );
  return match?.[1]?.trim() ?? null;
}

function buildProductCreateXml(
  input: CreateProductInput & { langId: string; shopId: string },
): string {
  const price = Number.isFinite(input.price) ? input.price.toFixed(6) : "0.000000";
  const reference = input.reference?.trim();
  const summary = input.summary?.trim() ?? "";
  const description = input.description?.trim() ?? summary;
  const defaultCategoryId = String(input.categoryId ?? "").trim();
  const associationIds = input.associationIds?.length
    ? [
        ...new Set(
          input.associationIds.map((id) => String(id).trim()).filter(Boolean),
        ),
      ]
    : defaultCategoryId
      ? [defaultCategoryId]
      : [];

  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product>
    ${langFieldXml("name", input.name, input.langId)}
    ${langFieldXml("link_rewrite", input.linkRewrite, input.langId)}
    ${langFieldXml("description_short", summary, input.langId)}
    ${langFieldXml("description", description, input.langId)}
    <state>1</state>
    <price>${escapeXml(price)}</price>
    <active>1</active>
    <show_price>1</show_price>
    <available_for_order>1</available_for_order>
    <visibility>both</visibility>
    <id_shop_default>${escapeXml(input.shopId)}</id_shop_default>
    <product_type>standard</product_type>
    <id_tax_rules_group>1</id_tax_rules_group>
    <id_category_default>${escapeXml(defaultCategoryId)}</id_category_default>
    ${reference ? `<reference>${escapeXml(reference)}</reference>` : ""}
    <associations>
      <categories>
${associationIds
  .map(
    (id) => `        <category>
          <id>${escapeXml(id)}</id>
        </category>`,
  )
  .join("\n")}
      </categories>
    </associations>
  </product>
</prestashop>`;
}

function buildCategoryCreateXml(
  input: CreateCategoryInput & { langId: string },
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <category>
    <id_parent>${escapeXml(input.parentId)}</id_parent>
    <active>1</active>
    <is_root_category>0</is_root_category>
    ${langFieldXml("name", input.name, input.langId)}
    ${langFieldXml("link_rewrite", input.linkRewrite, input.langId)}
    ${langFieldXml("description", input.description ?? "", input.langId)}
  </category>
</prestashop>`;
}

/** Build the PrestaShop customer creation payload (XML). */
function buildCustomerXml(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  newsletter?: boolean;
  secureKey?: string;
}): string {
  const secureKeyXml = input.secureKey
    ? `<secure_key>${escapeXml(input.secureKey)}</secure_key>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <customer>
    <firstname>${escapeXml(input.firstName)}</firstname>
    <lastname>${escapeXml(input.lastName)}</lastname>
    <email>${escapeXml(input.email)}</email>
    <passwd>${escapeXml(input.password)}</passwd>
    ${secureKeyXml}
    <newsletter>${input.newsletter ? "1" : "0"}</newsletter>
    <active>1</active>
  </customer>
</prestashop>`;
}

/** Build the PrestaShop customer UPDATE payload (XML). */
function buildCustomerUpdateXml(input: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  /** Hash existant renvoyé par PrestaShop (requis pour certaines mises à jour). */
  passwdHash?: string;
  newsletter?: boolean;
  idDefaultGroup?: string;
  idLang?: string;
  idShop?: string;
  idGender?: string;
  optin?: boolean;
  clearResetToken?: boolean;
  secureKey?: string;
}): string {
  const newsletterXml =
    input.newsletter !== undefined
      ? `<newsletter>${input.newsletter ? "1" : "0"}</newsletter>`
      : "";
  const passwdXml = input.password
    ? `<passwd>${escapeXml(input.password)}</passwd>`
    : input.passwdHash
      ? `<passwd>${escapeXml(input.passwdHash)}</passwd>`
      : "";
  const groupXml = input.idDefaultGroup
    ? `<id_default_group>${escapeXml(input.idDefaultGroup)}</id_default_group>`
    : "";
  const langXml = input.idLang
    ? `<id_lang>${escapeXml(input.idLang)}</id_lang>`
    : "";
  const shopXml = input.idShop
    ? `<id_shop>${escapeXml(input.idShop)}</id_shop>`
    : "";
  const genderXml = input.idGender
    ? `<id_gender>${escapeXml(input.idGender)}</id_gender>`
    : "";
  const optinXml =
    input.optin !== undefined
      ? `<optin>${input.optin ? "1" : "0"}</optin>`
      : "";
  const resetXml = input.clearResetToken
    ? "<reset_password_token></reset_password_token><reset_password_validity></reset_password_validity>"
    : "";
  const secureKeyXml = input.secureKey
    ? `<secure_key>${escapeXml(input.secureKey)}</secure_key>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <customer>
    <id>${escapeXml(input.id)}</id>
    <firstname>${escapeXml(input.firstName)}</firstname>
    <lastname>${escapeXml(input.lastName)}</lastname>
    <email>${escapeXml(input.email)}</email>
    ${passwdXml}
    ${groupXml}
    ${langXml}
    ${shopXml}
    ${genderXml}
    ${optinXml}
    ${newsletterXml}
    ${secureKeyXml}
    ${resetXml}
    <active>1</active>
  </customer>
</prestashop>`;
}

/** Remplace ou insère un champ dans le XML client PrestaShop. */
function patchCustomerXmlField(
  xml: string,
  field: string,
  value: string,
): string {
  const tag = `<${field}>${value}</${field}>`;
  const re = new RegExp(`<${field}>[\\s\\S]*?</${field}>`);
  if (re.test(xml)) return xml.replace(re, tag);
  return xml.replace("</customer>", `${tag}</customer>`);
}

function buildOptionGroups(variants: ProductVariant[]) {
  const groups = new Map<string, Map<string, ProductOptionValue>>();

  for (const variant of variants) {
    for (const option of variant.options) {
      if (!groups.has(option.group)) {
        groups.set(option.group, new Map());
      }
      groups.get(option.group)!.set(option.id, option);
    }
  }

  // Import sortSizeValues dynamically would break server bundle — sort inline for size groups
  const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"];
  const sizeRank = (label: string) => {
    const n = label.trim().toUpperCase();
    const i = SIZE_ORDER.indexOf(n);
    return i === -1 ? 999 : i;
  };
  const isSize = (name: string) => /taille|size|pointure/i.test(name);

  return [...groups.entries()].map(([name, values]) => {
    const list = [...values.values()];
    if (isSize(name)) {
      list.sort((a, b) => sizeRank(a.label) - sizeRank(b.label));
    }
    return { name, values: list };
  });
}

export const prestashop = new PrestaShopService();