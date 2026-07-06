/**
 * Centralized configuration.
 *
 * Two scopes:
 *  - `serverConfig`  : secrets (PrestaShop URL + key). Only safe on the server.
 *  - `publicConfig`  : values exposed to the browser (NEXT_PUBLIC_*).
 *
 * The storefront stays fully decoupled: nothing references PrestaShop env vars
 * directly except this file and the PrestaShop service.
 */

/** Server-only configuration. Never import this from a client component. */
export const serverConfig = {
  apiUrl: process.env.PRESTASHOP_API_URL ?? "",
  apiKey: process.env.PRESTASHOP_API_KEY ?? "",
  langId: process.env.PRESTASHOP_LANG_ID ?? "1",
  shopId: process.env.PRESTASHOP_SHOP_ID ?? "",
  /** Whether the back office connection is configured. */
  get isConfigured(): boolean {
    return Boolean(this.apiUrl && this.apiKey);
  },
} as const;

/** Values safe to expose in the browser. */
export const publicConfig = {
  siteName: process.env.NEXT_PUBLIC_SITE_NAME ?? "Foot Shop",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  currency: process.env.NEXT_PUBLIC_CURRENCY ?? "EUR",
  locale: process.env.NEXT_PUBLIC_LOCALE ?? "fr-FR",
} as const;

/** Internal API base used by the client to reach our own route handlers. */
export const INTERNAL_API_BASE = "/api";

/** Pagination defaults used across the catalogue. */
export const PAGINATION = {
  defaultLimit: 12,
  catalogueLimit: 24,
} as const;
