/**
 * Raw PrestaShop Webservice shapes (JSON output format).
 *
 * PrestaShop returns multilingual fields as arrays of `{ id, value }` OR as a
 * plain string depending on configuration. We model both with `PsLangField`.
 * These types are intentionally loose: the mappers are the single place that
 * normalizes them into clean domain models.
 */

export type PsLangField =
  | string
  | { language: { id: string; value: string } | { id: string; value: string }[] }
  | Array<{ id: string; value: string }>;

export interface PsImageAssociation {
  id: string;
}

export interface PsStockAvailable {
  id: string;
  id_product?: string;
  id_product_attribute?: string;
  id_shop?: string;
  id_shop_group?: string;
  quantity?: string;
  depends_on_stock?: string;
  out_of_stock?: string;
}

export interface PsAssociations {
  images?: PsImageAssociation[];
  categories?: { id: string }[];
  combinations?: { id: string }[];
  product_option_values?: { id: string }[];
  stock_availables?: PsStockAvailable[];
  /** Present on a category fetched with display=full: ids of its products. */
  products?: { id: string }[];
}

export interface PsProduct {
  id: string;
  id_default_image?: string | false;
  id_category_default?: string;
  reference?: string;
  price?: string;
  name?: PsLangField;
  description?: PsLangField;
  description_short?: PsLangField;
  link_rewrite?: PsLangField;
  active?: string;
  quantity?: string;
  date_add?: string;
  on_sale?: string;
  associations?: PsAssociations;
}

export interface PsCategory {
  id: string;
  id_parent?: string;
  name?: PsLangField;
  description?: PsLangField;
  link_rewrite?: PsLangField;
  active?: string;
  /** "1" for the technical Root category (must never be shown to customers). */
  is_root_category?: string;
  /** Whether this category has an uploaded image (PrestaShop exposes "1"/""). */
  id_image?: string | false;
  nb_products_recursive?: string;
  associations?: PsAssociations;
}

export interface PsCombination {
  id: string;
  id_product?: string;
  reference?: string;
  price?: string;
  quantity?: string;
  associations?: PsAssociations;
}

export interface PsProductOptionValue {
  id: string;
  id_attribute_group?: string;
  name?: PsLangField;
}

export interface PsAttributeGroup {
  id: string;
  name?: PsLangField;
  public_name?: PsLangField;
}

export interface PsCustomer {
  id: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  /** bcrypt hash (PrestaShop 8). Only returned with proper key permission. */
  passwd?: string;
  /** "1" if the customer opted into the newsletter. */
  newsletter?: string;
  active?: string;
  id_default_group?: string;
  id_lang?: string;
  id_shop?: string;
  id_gender?: string;
  optin?: string;
  reset_password_token?: string;
  reset_password_validity?: string;
  secure_key?: string;
}

export interface PsOrder {
  id: string;
  reference?: string;
  current_state?: string;
  total_paid?: string;
  date_add?: string;
  id_customer?: string;
  id_address_delivery?: string;
  associations?: {
    order_rows?: {
      product_id: string | number;
      product_attribute_id?: string | number;
      product_name: string;
      product_quantity: string;
      unit_price_tax_incl: string;
    }[];
  };
}

export interface PsAddress {
  id?: string;
  firstname?: string;
  lastname?: string;
  address1?: string;
  address2?: string;
  postcode?: string;
  city?: string;
  phone?: string;
  phone_mobile?: string;
  id_country?: string;
}

export interface PsOrderCarrier {
  id: string;
  id_order?: string;
  tracking_number?: string;
}

/** PrestaShop list responses wrap entities under a top-level resource key. */
export type PsListResponse<K extends string, T> = {
  [key in K]: T[];
};
