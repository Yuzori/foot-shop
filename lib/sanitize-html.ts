import "server-only";

import DOMPurify from "isomorphic-dompurify";

/** Nettoie le HTML PrestaShop avant affichage (anti-XSS). */
export function sanitizeProductHtml(html: string): string {
  if (!html.trim()) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "ul",
      "ol",
      "li",
      "h2",
      "h3",
      "h4",
      "span",
    ],
    ALLOWED_ATTR: [],
  });
}
