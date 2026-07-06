/**
 * Clean domain models consumed by the UI.
 *
 * Components ONLY ever know about these types — never the raw PrestaShop shapes.
 * This is what keeps the front decoupled: swap the back office and only the
 * mappers in `services/` change.
 */

export interface ProductImage {
  id: string;
  url: string;
  /** Alternate/legend text for accessibility. */
  alt: string;
}

export interface ProductOptionValue {
  id: string;
  /** e.g. attribute group "Taille" */
  group: string;
  /** e.g. "M" */
  label: string;
}

export interface ProductVariant {
  id: string;
  /** Selected option values composing this variant. */
  options: ProductOptionValue[];
  price: number | null;
  /** Extra price relative to the base product (impact on price). */
  priceImpact: number;
  inStock: boolean;
  quantity: number;
  reference?: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  reference?: string;
  /** Plain text short description. */
  summary: string;
  /** HTML description (sanitized at render time). */
  description: string;
  price: number;
  /** Price before discount, if any. */
  compareAtPrice: number | null;
  currency: string;
  images: ProductImage[];
  cover: ProductImage | null;
  inStock: boolean;
  quantity: number;
  categoryIds: string[];
  defaultCategoryId: string | null;
  variants: ProductVariant[];
  /** Distinct attribute groups available (e.g. Taille, Couleur). */
  optionGroups: { name: string; values: ProductOptionValue[] }[];
  isNew: boolean;
  isOnSale: boolean;
  createdAt: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  parentId: string | null;
  /** True for PrestaShop technical roots (Root / Home) — never shown to users. */
  isRoot: boolean;
  image: ProductImage | null;
  productCount: number | null;
}

/** Flocage personnalisé (nom / numéro séparés) — transmis au fournisseur. */
export interface FlocageOption {
  enabled: boolean;
  /** Nom floqué (ex. MESSI). */
  name: string;
  /** Numéro floqué (ex. 10). */
  number: string;
  price: number;
  /** @deprecated Ancien format — conservé pour compatibilité panier persisté. */
  text?: string;
}

export interface CartLine {
  productId: string;
  variantId: string | null;
  name: string;
  image: string | null;
  unitPrice: number;
  quantity: number;
  /** Human readable variant label, e.g. "Taille: M". */
  optionsLabel?: string;
  reference?: string;
  flocage?: FlocageOption;
}

export interface Address {
  id?: string;
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  postcode: string;
  city: string;
  country: string;
  phone?: string;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded"
  | "unknown";

export interface OrderLine {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  reference: string;
  status: OrderStatus;
  statusLabel: string;
  total: number;
  currency: string;
  createdAt: string | null;
  lines: OrderLine[];
  /** Numéro de suivi colis (PrestaShop → Transporteurs). */
  trackingNumber: string | null;
  /** Lien direct vers le transporteur (saisi en admin). */
  trackingUrl: string | null;
}

/** Generic paginated result envelope used by list endpoints. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  /** Présent quand PrestaShop est injoignable (liste vide côté API). */
  connectionError?: string | null;
}

export type SortOption =
  | "relevance"
  | "newest"
  | "price-asc"
  | "price-desc"
  | "name-asc";

export interface ProductQuery {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: SortOption;
  /** Filtre maillots / shorts par nom produit. */
  kind?: "jersey" | "short";
}
