import "server-only";

import { getSiteUrl } from "@/lib/site-url";

/** URL absolue pour les emails (images produit, liens). */
export function absoluteUrl(path: string | null | undefined): string {
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
