import "server-only";

import { publicConfig } from "@/config";

/**
 * URL publique canonique du site (emails, cron, liens serveur).
 * Priorité : SITE_URL → NEXT_PUBLIC_SITE_URL → défaut config.
 */
export function getSiteUrl(): string {
  const raw =
    process.env.SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    publicConfig.siteUrl;

  let url = raw.replace(/\/$/, "");

  const isLocalhost = /localhost|127\.0\.0\.1/i.test(url);
  if (process.env.NODE_ENV === "production" && isLocalhost) {
    const renderUrl = process.env.RENDER_EXTERNAL_URL?.trim();
    if (renderUrl && !/localhost|127\.0\.0\.1/i.test(renderUrl)) {
      url = renderUrl.replace(/\/$/, "");
    }
  }

  return url;
}

/** Chemin relatif ou URL absolue → URL absolue sur le domaine du site. */
export function siteUrlPath(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) {
    if (process.env.NODE_ENV === "production") {
      return path.replace(
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i,
        getSiteUrl(),
      );
    }
    return path;
  }
  const base = getSiteUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Lien vers une fiche produit. */
export function productPageUrl(productId: string): string {
  return `${getSiteUrl()}/produit/${productId}`;
}
