import "server-only";

import {
  extractUnisportGalleryImages,
  extractUnisportProductId,
  extractUnisportTitle,
  parseUnisportHtml,
} from "@/lib/product-import/parse-unisport-html";
import { isUnisportProductUrl } from "@/lib/product-import/is-unisport-url";
import { fetchProductPageHtml } from "@/lib/product-import/fetch-page";
import { validateSourceUrl } from "@/lib/product-import/validate-url";

export {
  extractUnisportGalleryImages,
  extractUnisportProductId,
  extractUnisportTitle,
  parseUnisportHtml,
};

/** Télécharge une page produit Unisport (profils fetch adaptés anti-405). */
export async function fetchUnisportProductPage(rawUrl: string): Promise<{
  url: URL;
  html: string;
}> {
  const url = await validateSourceUrl(rawUrl);
  const html = await fetchProductPageHtml(url);
  return { url, html };
}

export function isUnisportScrapeUrl(rawUrl: string): boolean {
  return isUnisportProductUrl(rawUrl);
}
