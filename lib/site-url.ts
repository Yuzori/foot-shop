import "server-only";

import { publicConfig } from "@/config";

/** Domaine public de la boutique en production. */
export const CANONICAL_SITE_URL = "https://foot-shop.fr";

/**
 * URL utilisée dans les emails et liens serveur (jamais localhost).
 */
export function getEmailSiteUrl(): string {
  const candidates = [
    process.env.SITE_URL?.trim(),
    process.env.NEXT_PUBLIC_SITE_URL?.trim(),
  ].filter(Boolean) as string[];

  for (const raw of candidates) {
    if (!/localhost|127\.0\.0\.1/i.test(raw)) {
      return raw.replace(/\/$/, "");
    }
  }

  return CANONICAL_SITE_URL;
}

/**
 * URL publique canonique du site (emails, cron, liens serveur).
 */
export function getSiteUrl(): string {
  return getEmailSiteUrl();
}

/**
 * Base pour les retours de paiement (localhost en dev, domaine en prod).
 */
export function getCheckoutBaseUrl(): string {
  const explicit =
    process.env.SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    publicConfig.siteUrl;

  const url = explicit.replace(/\/$/, "");
  const isLocalhost = /localhost|127\.0\.0\.1/i.test(url);

  if (process.env.NODE_ENV === "production" && isLocalhost) {
    return CANONICAL_SITE_URL;
  }

  return url;
}

/** Chemin relatif ou URL absolue → URL absolue sur le domaine du site. */
export function siteUrlPath(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path.replace(
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i,
      getEmailSiteUrl(),
    );
  }
  const base = getEmailSiteUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Lien vers une fiche produit. */
export function productPageUrl(productId: string): string {
  return `${getEmailSiteUrl()}/produit/${productId}`;
}
