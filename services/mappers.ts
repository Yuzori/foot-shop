/**
 * Mappers: PrestaShop raw shapes -> clean domain models.
 */
import { serverConfig } from "@/config";
import { shopConfig } from "@/config/shop";
import { sanitizeProductHtml } from "@/lib/sanitize-html";
import type {
  Category,
  Customer,
  Order,
  OrderStatus,
  Product,
  ProductImage,
  ProductOptionValue,
  ProductVariant,
} from "@/types/domain";
import type {
  PsCategory,
  PsCombination,
  PsCustomer,
  PsLangField,
  PsOrder,
  PsProduct,
  PsProductOptionValue,
} from "@/types/prestashop";

/** PrestaShop renvoie souvent des ids numériques dans le JSON. */
export function psStr(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

/** Resolve multilingual field */
export function resolveLang(field: PsLangField | undefined): string {
  if (field === undefined || field === null) return "";
  if (typeof field === "string") return field;

  const langId = serverConfig.langId;

  if (Array.isArray(field)) {
    const match = field.find((e) => e.id === langId) ?? field[0];
    return match?.value ?? "";
  }

  if ("language" in field) {
    const lang = field.language;
    if (Array.isArray(lang)) {
      const match = lang.find((e) => e.id === langId) ?? lang[0];
      return match?.value ?? "";
    }
    return lang?.value ?? "";
  }

  return "";
}

function toNumber(value: string | undefined, fallback = 0): number {
  if (value === undefined || value === null) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Build the image URL.
 *
 * Points to OUR same-origin proxy (`/api/images/...`) rather than the raw
 * PrestaShop Webservice URL, because the latter requires the secret API key as
 * Basic Auth — which the browser can't send. The proxy adds the auth server-side.
 */
export function buildImageUrl(productId: string, imageId: string): string {
  return `/api/images/products/${productId}/${imageId}`;
}

/** Same-origin proxy URL for a category image. */
export function buildCategoryImageUrl(categoryId: string): string {
  return `/api/images/categories/${categoryId}`;
}

export function mapProductImages(ps: PsProduct): ProductImage[] {
  const productId = ps.id;
  const imageIds = ps.associations?.images?.map((img) => img.id) ?? [];
  const name = resolveLang(ps.name);

  return imageIds.map((imageId) => ({
    id: imageId,
    url: buildImageUrl(productId, imageId),
    alt: name,
  }));
}

export function mapProduct(ps: PsProduct): Product {
  const images = mapProductImages(ps);

  const coverId =
    typeof ps.id_default_image === "string"
      ? ps.id_default_image
      : undefined;

  const cover =
    images.find((img) => img.id === coverId) ?? images[0] ?? null;

  /**
   * Stock resolution (robust):
   *  - In `/products?display=full`, PrestaShop usually exposes a top-level
   *    computed `quantity`. The nested `associations.stock_availables` entries
   *    often DON'T carry a `quantity`, only ids — so relying on them alone made
   *    every product look out of stock.
   *  - We read the top-level quantity first, fall back to a nested quantity if
   *    present, and treat UNKNOWN stock as available (`inStock = true`) so a
   *    missing field never hides a product or shows a wrong "Épuisé" badge.
   *
   * Note: stock NEVER affects whether a product appears in a list — it only
   * controls the in-stock flag used for the badge / add-to-cart.
   */
  const nestedQuantity = ps.associations?.stock_availables?.find(
    (s) => s.quantity !== undefined,
  )?.quantity;
  const rawQuantity = ps.quantity ?? nestedQuantity;
  const hasQuantity = rawQuantity !== undefined && rawQuantity !== "";
  const quantity = hasQuantity ? toNumber(rawQuantity) : 0;
  const inStock = hasQuantity ? quantity > 0 : true;

  const createdAt = ps.date_add ?? null;

  return {
    id: ps.id,
    name: resolveLang(ps.name),
    slug: resolveLang(ps.link_rewrite) || ps.id,
    reference: ps.reference || undefined,
    summary: sanitizeProductHtml(resolveLang(ps.description_short)),
    description: sanitizeProductHtml(resolveLang(ps.description)),
    price: toNumber(ps.price),
    compareAtPrice: null,
    currency: "EUR",
    images,
    cover,

    quantity,
    inStock,

    categoryIds: ps.associations?.categories?.map((c) => c.id) ?? [],
    defaultCategoryId: ps.id_category_default ?? null,

    variants: [],
    optionGroups: [],

    isNew: isRecent(createdAt),
    isOnSale: ps.on_sale === "1",
    createdAt,
  };
}

export function mapCategory(ps: PsCategory): Category {
  const id = ps.id;
  const parentId = ps.id_parent ?? null;

  const name = resolveLang(ps.name);

  // A category is a "technical root" (never shown to customers) when PrestaShop
  // flags it as such, when it's the Root (id 1) / Home (id 2), when it has no
  // parent, or when its name is a known system name (Racine/Root/Home/Accueil).
  const isSystemName = /^(racine|root|home|accueil)$/i.test(name.trim());
  const isRoot =
    ps.is_root_category === "1" ||
    id === "1" ||
    id === "2" ||
    parentId === "0" ||
    parentId === null ||
    isSystemName;

  // Always point to the proxy: the route streams the category image when one
  // exists and returns 404 otherwise, in which case <ProductImage> shows the
  // neutral placeholder (never a fake photo).
  return {
    id,
    name,
    slug: resolveLang(ps.link_rewrite) || id,
    description: resolveLang(ps.description),
    parentId,
    isRoot,
    image: { id, url: buildCategoryImageUrl(id), alt: name },
    productCount: ps.nb_products_recursive
      ? toNumber(ps.nb_products_recursive)
      : null,
  };
}

export function mapOptionValue(ps: PsProductOptionValue): ProductOptionValue {
  return {
    id: ps.id,
    group: ps.id_attribute_group ?? "",
    label: resolveLang(ps.name),
  };
}

export function mapCombination(
  ps: PsCombination,
  optionValues: Map<string, ProductOptionValue>,
  basePrice: number,
): ProductVariant {
  const ids =
    ps.associations?.product_option_values?.map((v) => v.id) ?? [];

  const options = ids
    .map((id) => optionValues.get(id))
    .filter((v): v is ProductOptionValue => Boolean(v));

  const quantity = toNumber(ps.quantity);
  const priceImpact = toNumber(ps.price);

  return {
    id: ps.id,
    options,
    price: basePrice + priceImpact,
    priceImpact,
    inStock: quantity > 0,
    quantity,
    reference: ps.reference || undefined,
  };
}

export function mapCustomer(ps: PsCustomer): Customer {
  return {
    id: String(ps.id),
    firstName: ps.firstname ?? "",
    lastName: ps.lastname ?? "",
    email: ps.email ?? "",
  };
}

const PS_STATE_MAP: Record<string, { status: OrderStatus; label: string }> = {
  "1": { status: "pending", label: "En attente de paiement" },
  "2": { status: "processing", label: "Paiement accepté" },
  "3": { status: "processing", label: "En préparation" },
  "4": { status: "shipped", label: "Expédiée" },
  "5": { status: "delivered", label: "Livrée" },
  "6": { status: "cancelled", label: "Annulée" },
  "7": { status: "refunded", label: "Remboursée" },
  "8": { status: "pending", label: "Erreur de paiement" },
};

export function mapOrder(ps: PsOrder, trackingNumber: string | null = null): Order {
  const state = ps.current_state
    ? PS_STATE_MAP[ps.current_state]
    : undefined;

  return {
    id: ps.id,
    reference: ps.reference || ps.id,
    status: state?.status ?? "unknown",
    statusLabel: state?.label ?? "Statut inconnu",
    total: toNumber(ps.total_paid),
    currency: "EUR",
    createdAt: ps.date_add ?? null,
    trackingNumber,
    trackingUrl: null,
    lines:
      ps.associations?.order_rows?.map((row) => ({
        productId: row.product_id,
        name: row.product_name,
        quantity: toNumber(row.product_quantity),
        unitPrice: toNumber(row.unit_price_tax_incl),
      })) ?? [],
  };
}

function isRecent(iso: string | null): boolean {
  if (!iso) return false;
  const date = new Date(iso.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return false;

  const days = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  return days <= shopConfig.newProductDays;
}