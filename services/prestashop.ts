import "server-only";

import axios, { type AxiosInstance } from "axios";
import crypto from "node:crypto";

import { serverConfig } from "@/config";
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

/** Tri côté app : cette version de PrestaShop refuse date_add/price/name en API. */
function sortProducts(items: Product[], sort?: SortOption): Product[] {
  if (!sort || sort === "relevance") return items;

  const copy = [...items];
  switch (sort) {
    case "newest":
      return copy.sort((a, b) => {
        const da = a.createdAt ? Date.parse(a.createdAt) : 0;
        const db = b.createdAt ? Date.parse(b.createdAt) : 0;
        if (db !== da) return db - da;
        return Number(b.id) - Number(a.id);
      });
    case "price-asc":
      return copy.sort((a, b) => a.price - b.price);
    case "price-desc":
      return copy.sort((a, b) => b.price - a.price);
    case "name-asc":
      return copy.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    default:
      return copy;
  }
}

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
  private async post<T>(
    path: string,
    xmlBody: string,
  ): Promise<{ data: T | null; status: number | null; error: string | null }> {
    const client = this.getClient();
    if (!client) return { data: null, status: null, error: "not_configured" };

    try {
      const res = await client.post<T>(path, xmlBody, {
        headers: { "Content-Type": "text/xml" },
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
  ): Promise<{ data: T | null; status: number | null; error: string | null }> {
    const client = this.getClient();
    if (!client) return { data: null, status: null, error: "not_configured" };

    try {
      const res = await client.put<T>(path, xmlBody, {
        headers: { "Content-Type": "text/xml" },
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

    await this.applyStock(items);

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
      { display: "full" },
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

    return product;
  }

  /**
   * Fetch a set of products by id in ONE request (used for category pages so we
   * show every product associated to the category, not only those whose
   * `id_category_default` matches).
   */
  async getProductsByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];

    const { data } = await this.request<{ products?: PsProduct[] }>("/products", {
      display: "full",
      "filter[id]": `[${ids.join("|")}]`,
      "filter[active]": "1",
      limit: `${ids.length}`,
    });

    const items = asArray<PsProduct>(data as never, "products").map(mapProduct);
    await this.applyStock(items);

    // Preserve the order given by the category association.
    const order = new Map(ids.map((id, i) => [id, i]));
    items.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return items;
  }

  /**
   * Fetch the real stock for a set of products in ONE batched request and patch
   * `quantity` / `inStock` on each. PrestaShop stores stock in the
   * `stock_availables` resource; the row with `id_product_attribute = 0` is the
   * authoritative per-product total (fallback: sum of combination rows).
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

    const { data } = await this.request<{
      stock_availables?: PsStockAvailable[];
    }>("/stock_availables", {
      display: "full",
      "filter[id_product]": `[${productIds.join("|")}]`,
    });

    const rows = asArray<PsStockAvailable>(data as never, "stock_availables");

    const base = new Map<string, number>();
    const summed = new Map<string, number>();

    for (const row of rows) {
      const pid = row.id_product;
      if (!pid) continue;
      const qty = Number.parseInt(row.quantity ?? "0", 10) || 0;
      if (row.id_product_attribute === "0") {
        base.set(pid, qty);
      } else {
        summed.set(pid, (summed.get(pid) ?? 0) + qty);
      }
    }

    for (const pid of productIds) {
      // Prefer the authoritative "attribute 0" total; otherwise sum combinations.
      const value = base.has(pid) ? base.get(pid)! : summed.get(pid);
      if (value !== undefined) map.set(pid, value);
    }

    return map;
  }

  /** Applique le stock réel (stock_availables) à chaque déclinaison / taille. */
  private async applyVariantStock(
    productId: string,
    variants: ProductVariant[],
  ): Promise<void> {
    if (!variants.length) return;

    const { data } = await this.request<{
      stock_availables?: PsStockAvailable[];
    }>("/stock_availables", {
      display: "full",
      "filter[id_product]": productId,
    });

    const rows = asArray<PsStockAvailable>(data as never, "stock_availables");
    const byAttr = new Map<string, number>();

    for (const row of rows) {
      const attrId = row.id_product_attribute;
      if (!attrId || String(attrId) === "0") continue;
      const qty = Number.parseInt(row.quantity ?? "0", 10) || 0;
      byAttr.set(String(attrId), qty);
    }

    for (const variant of variants) {
      const qty = byAttr.get(String(variant.id));
      if (qty !== undefined) {
        variant.quantity = qty;
        variant.inStock = qty > 0;
      } else if (rows.length > 0) {
        variant.quantity = 0;
        variant.inStock = false;
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
    return id;
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
   * `associations.products` (every product linked to it) and fetches them by id,
   * which is far more accurate than filtering products by `id_category_default`.
   * Falls back to the default-category filter if the association is empty.
   */
  async getCategoryProducts(id: string, limit = 48): Promise<Product[]> {
    const { data } = await this.request<Record<string, unknown>>(
      `/categories/${id}`,
      { display: "full" },
    );
    const ps =
      (data?.category as PsCategory | undefined) ??
      asArray<PsCategory>(data as never, "categories")[0];

    const ids =
      ps?.associations?.products?.map((p) => p.id).filter(Boolean) ?? [];

    if (ids.length > 0) {
      return this.getProductsByIds(ids.slice(0, limit));
    }

    const fallback = await this.getProducts({ category: id, limit, page: 1 });
    return fallback.items;
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
    return key || null;
  }

  /**
   * Récupère la secure_key PrestaShop ou en définit une nouvelle si le
   * webservice ne la renvoie pas en lecture (fréquent sur les comptes existants).
   */
  async ensureCustomerSecureKey(customerId: string | number): Promise<string | null> {
    const id = String(customerId).trim();
    if (!id) return null;

    const existing = await this.getCustomerSecureKey(id);
    if (existing) return existing;

    const ps = await this.getCustomerRecord(id);
    if (!ps?.email) return null;

    let passwdHash = ps.passwd?.trim();
    if (!passwdHash) {
      const auth = await this.getCustomerAuthByEmail(ps.email);
      passwdHash = auth?.passwordHash?.trim();
    }
    if (!passwdHash) {
      console.error(
        "[prestashop] secure_key update: passwd unavailable for customer",
        id,
      );
      return null;
    }

    const secureKey = crypto.randomBytes(16).toString("hex");
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
    const orders = asArray<PsOrder>(data as never, "orders").map(mapOrder);
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
  }): Promise<{ customer: Customer | null; status: number | null; error: string | null }> {
    const xml = buildCustomerXml(input);
    const { data, status, error } = await this.post<{ customer?: PsCustomer }>(
      "/customers",
      xml,
    );
    return {
      customer: data?.customer ? mapCustomer(data.customer) : null,
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

  private async resolveCountryId(name: string): Promise<string | null> {
    const trimmed = name.trim();
    // Try ISO code first (e.g. "FR"), then by name.
    if (/^[A-Za-z]{2}$/.test(trimmed)) {
      const byIso = await this.resolveFirstId("/countries", {
        "filter[iso_code]": trimmed.toUpperCase(),
      });
      if (byIso) return byIso;
    }
    const byName = await this.resolveFirstId("/countries", {
      "filter[name]": `%[${trimmed}]%`,
    });
    if (byName) return byName;
    // Sensible default: France (iso FR).
    return this.resolveFirstId("/countries", { "filter[iso_code]": "FR" });
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
          secureKey: input.secureKey,
        }),
      );
      const order = orderRes.data?.order;
      if (!order?.id)
        return {
          reference: null,
          orderId: null,
          error: `order_failed: ${orderRes.error ?? "unknown"}`,
        };

      // Note fournisseur (flocage, etc.) — non bloquant si l'API messages échoue.
      if (input.note?.trim() && order.id) {
        await this.addOrderMessage(String(order.id), input.note.trim());
      }

      await this.decrementStockForLines(input.lines);

      return {
        reference: String(order.reference ?? order.id),
        orderId: String(order.id),
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
    const xml = buildProductCreateXml({ ...input, langId });
    const { data, status, error } = await this.post("/products", xml);
    if (status !== null && status >= 400) {
      throw new Error(`Création produit échouée : ${error ?? status}`);
    }
    const id = extractCreatedId(data, "product");
    if (!id) throw new Error("Produit créé mais identifiant introuvable.");
    await this.assignProductCategory(id, input.categoryId);
    return id;
  }

  /** Force la catégorie (évite le rattachement par défaut à Accueil). */
  async assignProductCategory(productId: string, categoryId: string): Promise<void> {
    const raw = await this.getProductRawXml(productId);
    if (raw) {
      const patched = patchProductCategoryXml(raw, categoryId);
      const { status, error } = await this.put(`/products/${productId}`, patched);
      if (status !== null && status < 400) return;
      console.warn(
        `[prestashop] category raw-xml PUT failed product=${productId} category=${categoryId}`,
        error,
      );
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product>
    <id>${escapeXml(productId)}</id>
    <id_category_default>${escapeXml(categoryId)}</id_category_default>
    <associations>
      <categories>
        <category>
          <id>${escapeXml(categoryId)}</id>
        </category>
      </categories>
    </associations>
  </product>
</prestashop>`;

    const { status, error } = await this.put(`/products/${productId}`, xml);
    if (status !== null && status >= 400) {
      console.warn(
        `[prestashop] category minimal PUT failed product=${productId} category=${categoryId}`,
        error,
      );
    }
  }

  private async getProductRawXml(id: string): Promise<string | null> {
    const client = this.getClient();
    if (!client) return null;
    try {
      const res = await client.get<string>(`/products/${id}`, {
        params: { display: "full" },
        headers: { Accept: "application/xml" },
        responseType: "text",
        transformResponse: [(data: string) => data],
      });
      const body = res.data;
      return typeof body === "string" && body.includes("<product>") ? body : null;
    } catch {
      return null;
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

    const params: Record<string, string | number> = { display: "full" };
    if (groupId) params["filter[id_attribute_group]"] = groupId;

    const data = await this.get<{ product_option_values?: PsProductOptionValue[] }>(
      "/product_option_values",
      params,
    );

    const values = data?.product_option_values ?? [];
    const byLabel = new Map<string, PsProductOptionValue>();
    for (const value of values) {
      const label = resolveLang(value.name).trim().toUpperCase();
      if (label) byLabel.set(label, value);
    }

    const matched: { id: string; label: string }[] = [];
    for (const size of sizeLabels) {
      const row = byLabel.get(size.trim().toUpperCase());
      if (row?.id) matched.push({ id: String(row.id), label: size });
    }
    return matched;
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

  /** Fixe le stock absolu pour un produit ou une déclinaison. */
  async setStockQuantity(
    productId: string,
    variantId: string | null,
    quantity: number,
  ): Promise<void> {
    await this.writeStockQuantity(productId, variantId, Math.max(0, quantity));
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

    const res = await fetch(
      `${baseUrl}/images/${resource}/${resourceId}?output_format=JSON`,
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
      console.error(
        `[prestashop] stock update failed product=${productId} attr=${attrId}`,
        error,
      );
    }
  }
}

export interface CreateProductInput {
  name: string;
  linkRewrite: string;
  price: number;
  categoryId: string;
  reference?: string;
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
  secureKey: string;
}): string {
  const total = input.totalProducts.toFixed(2);
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
    <total_products>${total}</total_products>
    <total_products_wt>${total}</total_products_wt>
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
function patchProductCategoryXml(xml: string, categoryId: string): string {
  let out = xml.replace(
    /<id_category_default>(?:<!\[CDATA\[)?[\s\S]*?(?:\]\]>)?<\/id_category_default>/,
    `<id_category_default><![CDATA[${categoryId}]]></id_category_default>`,
  );

  const categoriesXml = `<categories>
<category>
<id><![CDATA[${categoryId}]]></id>
</category>
</categories>`;

  if (/<categories>[\s\S]*?<\/categories>/.test(out)) {
    out = out.replace(/<categories>[\s\S]*?<\/categories>/, categoriesXml);
  } else if (/<associations>/.test(out)) {
    out = out.replace(/<associations>/, `<associations>\n${categoriesXml}\n`);
  }

  return out;
}

function buildProductCreateXml(input: CreateProductInput & { langId: string }): string {
  const price = Number.isFinite(input.price) ? input.price.toFixed(6) : "0.000000";
  const reference = input.reference?.trim();

  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product>
    ${langFieldXml("name", input.name, input.langId)}
    ${langFieldXml("link_rewrite", input.linkRewrite, input.langId)}
    <state>1</state>
    <price>${escapeXml(price)}</price>
    <active>1</active>
    <show_price>1</show_price>
    <available_for_order>1</available_for_order>
    <visibility>both</visibility>
    <id_category_default>${escapeXml(input.categoryId)}</id_category_default>
    ${reference ? `<reference>${escapeXml(reference)}</reference>` : ""}
    <associations>
      <categories>
        <category>
          <id>${escapeXml(input.categoryId)}</id>
        </category>
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
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <customer>
    <firstname>${escapeXml(input.firstName)}</firstname>
    <lastname>${escapeXml(input.lastName)}</lastname>
    <email>${escapeXml(input.email)}</email>
    <passwd>${escapeXml(input.password)}</passwd>
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