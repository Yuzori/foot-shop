import "server-only";

import { productImportConfig } from "@/config/product-import";
import { formatProductName, detectAudience, type ProductAudience } from "@/lib/product-import/format-product-name";
import { fetchProductPageHtml } from "@/lib/product-import/fetch-page";
import { validateSourceUrl } from "@/lib/product-import/validate-url";

export interface ScrapedProduct {
  sourceUrl: string;
  name: string;
  images: string[];
  audience: ProductAudience;
}

const BAD_URL =
  /logo|icon|avatar|sprite|banner|payment|visa|mastercard|paypal|amex|shipping|delivery|trust|badge|star|rating|review|social|facebook|twitter|instagram|whatsapp|tiktok|flag|placeholder|spinner|loading|empty|no[_-]?image|default[_-]?image|favicon|pixel|tracking|newsletter|popup|advert|ads?[_-]|promo[_-]bar|header|footer|nav|menu|cart|wishlist|compare|share|zoom[_-]icon|play[_-]button|video|cap|casquette|hat|beanie|snapback|shoe|chaussure|sneaker|ballon|ball|sock|chaussette|pant|hoodie|sweat|jacket|veste|\.svg(\?|$)|\.gif(\?|$)/i;

const THUMB_IN_URL =
  /[_\-.](thumb|thumbnail|small|mini|icon|xs|sm|compact|preview)([_\-.]|$)|[_-](\d{1,2}x\d{1,2}|\d{2,3}x\d{2,3})(\.|[_-]|$)|\/thumb\/|\/cache\/|w_\d{2,3}\b|h_\d{2,3}\b|[?&](w|width|h|height)=\d{1,3}(?:&|$)/i;

const PRODUCT_HINT =
  /product|gallery|zoom|slider|swiper|maillot|jersey|kit|pdp|detail|item[_-]?image|main[_-]?image|large|original|full|hd|media\/image/i;

const MODEL_BAD =
  /mannequin|manikin|manne?qin|model|worn|wear|lifestyle|lookbook|outfit|on[_-]?body|person|player[_-]?wear|portrait|styling|editorial|couple|holding|human|torso|face|head|runway|campaign|fitness|gym|training|shoot|couverture|cover[_-]?image|hero|banner|look[_-]?book/i;

const JERSEY_GOOD =
  /flat|lay|packshot|pack[_-]?shot|ghost|isolated|product[_-]?only|vue[_-]?de[_-]?face|sans[_-]?mannequin|without[_-]?model|front|face|avant|recto|dos|back|rear|verso|side|profil|lateral|jersey|maillot|kit|shirt|detail|zoom|macro|gallery|pdp|article|articleimage/i;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)));
}

function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) return decodeHtmlEntities(match[1].trim());
  }
  return null;
}

function extractAllMeta(html: string, property: string): string[] {
  const urls: string[] = [];
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "gi",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
      "gi",
    ),
  ];
  for (const re of patterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
      if (match[1]) urls.push(decodeHtmlEntities(match[1].trim()));
    }
  }
  return urls;
}

function extractTitle(html: string): string | null {
  const og = extractMeta(html, "og:title");
  if (og) return og;
  const twitter = extractMeta(html, "twitter:title");
  if (twitter) return twitter;
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1?.[1]) {
    return decodeHtmlEntities(h1[1].replace(/<[^>]+>/g, "").trim());
  }
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title?.[1]) return decodeHtmlEntities(title[1].trim());
  return null;
}

function absolutize(base: URL, href: string): string | null {
  try {
    const trimmed = href.trim();
    if (!trimmed || trimmed.startsWith("data:")) return null;
    return new URL(trimmed, base).toString();
  } catch {
    return null;
  }
}

function toHighQuality(url: string): string {
  let u = url;

  u = u
    .replace(/_small|_thumb|_thumbnail|_medium|_compact|_mini/gi, "_large")
    .replace(/\/thumb\//gi, "/large/")
    .replace(/\/cache\/[a-z0-9]+\//gi, "/")
    .replace(/([?&])(w|width|h|height)=\d+/gi, "$1$2=2000")
    .replace(
      /([/_-])(\d{2,3})x(\d{2,3})(\.[a-z]{3,4})(\?.*)?$/i,
      (_m, sep: string, _w: string, _h: string, ext: string, qs?: string) =>
        `${sep}2000x2000${ext}${qs ?? ""}`,
    );

  if (/cdn\.shopify\.com/i.test(u)) {
    u = u.replace(/_\d+x(\.|$)/, "_2000x$1");
    if (!/[?&]width=/i.test(u)) {
      u += (u.includes("?") ? "&" : "?") + "width=2000";
    }
  }

  return u;
}

function imageDedupeKey(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname
      .replace(/_\d+x\d+/gi, "")
      .replace(/\d{2,4}x\d{2,4}/gi, "")
      .replace(/\.(jpe?g|png|webp)$/i, "");
    return `${u.hostname}${path}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function scoreImage(url: string, context = "", alt = ""): number {
  const hay = `${url} ${context} ${alt}`.toLowerCase();

  if (BAD_URL.test(url)) return -100;
  if (MODEL_BAD.test(hay) && !JERSEY_GOOD.test(hay)) return -80;

  let score = 0;
  if (THUMB_IN_URL.test(url)) score -= 25;
  if (PRODUCT_HINT.test(hay)) score += 18;
  if (JERSEY_GOOD.test(hay)) score += 28;
  if (/\.(jpe?g|webp)(\?|$)/i.test(url)) score += 8;
  if (/\.png(\?|$)/i.test(url) && !PRODUCT_HINT.test(hay)) score -= 5;

  const dim = url.match(/(\d{3,4})x(\d{3,4})/i);
  if (dim) score += Math.min(25, Number(dim[1]) / 40);

  if (/gallery|product|zoom|main|swiper|pdp/i.test(context)) score += 18;
  if (/white|blanc|#fff|#ffffff|isolated|packshot|ghost|studio[_-]?white|fond[_-]?blanc/i.test(hay)) {
    score += 30;
  }
  if (/og:image|twitter:image/i.test(context) && MODEL_BAD.test(hay)) score -= 30;

  if (/front|face|avant|recto|_f\b|_front|vue[_-]?1/i.test(hay)) score += 22;
  else if (/back|dos|verso|rear|_b\b|_back|vue[_-]?2/i.test(hay)) score += 18;
  else if (/side|profil|lateral|_s\b|_side|vue[_-]?3/i.test(hay)) score += 14;

  return score;
}

function imageSortRank(url: string, alt: string, context: string): number {
  const hay = `${url} ${alt} ${context}`.toLowerCase();
  if (/front|face|avant|recto|_f\b|_front|vue[_-]?1/i.test(hay)) return 0;
  if (/back|dos|verso|rear|_b\b|_back|vue[_-]?2/i.test(hay)) return 1;
  if (/side|profil|lateral|_s\b|_side|vue[_-]?3/i.test(hay)) return 2;
  return 3;
}

/** Isole la zone galerie produit (évite header, reco, accessoires…). */
function extractProductGalleryHtml(html: string): string {
  const patterns = [
    /<div[^>]+class="[^"]*(?:product[_-]gallery|gallery[_-]product|pdp[_-]gallery|product[_-]images|image[_-]gallery|productGallery)[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    /<section[^>]+(?:data-testid|class)="[^"]*product[_-]image[^"]*"[^>]*>[\s\S]*?<\/section>/gi,
    /<figure[^>]+class="[^"]*(?:product|gallery)[^"]*"[^>]*>[\s\S]*?<\/figure>/gi,
  ];

  let best = "";
  for (const re of patterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
      const block = match[0];
      if (block.length > best.length && block.length < 80_000) best = block;
    }
  }

  return best || html;
}

function pickLargestFromSrcset(srcset: string, base: URL): string | null {
  const candidates: { url: string; width: number }[] = [];
  for (const part of srcset.split(",")) {
    const bits = part.trim().split(/\s+/);
    const raw = bits[0];
    if (!raw) continue;
    const abs = absolutize(base, raw);
    if (!abs) continue;
    const w = bits[1]?.endsWith("w")
      ? Number.parseInt(bits[1], 10) || 0
      : 0;
    candidates.push({ url: abs, width: w });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.width - a.width);
  return candidates[0]?.url ?? null;
}

function extractJsonLdImages(html: string, base: URL): string[] {
  const urls: string[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = re.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      collectJsonImages(parsed, urls, base);
    } catch {
      // ignore invalid JSON-LD blocks
    }
  }

  return urls;
}

function collectJsonImages(node: unknown, urls: string[], base: URL): void {
  if (!node) return;

  if (Array.isArray(node)) {
    for (const item of node) collectJsonImages(item, urls, base);
    return;
  }

  if (typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  const type = String(record["@type"] ?? "").toLowerCase();

  if (type.includes("product") || record.image) {
    const image = record.image;
    if (typeof image === "string") {
      const abs = absolutize(base, image);
      if (abs) urls.push(abs);
    } else if (Array.isArray(image)) {
      for (const item of image) {
        if (typeof item === "string") {
          const abs = absolutize(base, item);
          if (abs) urls.push(abs);
        } else if (item && typeof item === "object") {
          const url = (item as { url?: string }).url;
          if (url) {
            const abs = absolutize(base, url);
            if (abs) urls.push(abs);
          }
        }
      }
    } else if (image && typeof image === "object") {
      const url = (image as { url?: string }).url;
      if (url) {
        const abs = absolutize(base, url);
        if (abs) urls.push(abs);
      }
    }
  }

  if (record["@graph"]) collectJsonImages(record["@graph"], urls, base);
}

function extractScriptGalleryImages(html: string, base: URL): string[] {
  const urls: string[] = [];
  const arrayPatterns = [
    /"images"\s*:\s*\[([\s\S]*?)\]/gi,
    /"productImages"\s*:\s*\[([\s\S]*?)\]/gi,
    /"galleryImages"\s*:\s*\[([\s\S]*?)\]/gi,
    /"gallery"\s*:\s*\[([\s\S]*?)\]/gi,
  ];

  for (const re of arrayPatterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
      const block = match[1] ?? "";
      const urlRe = /"(https?:\/\/[^"]+\.(?:jpe?g|png|webp)[^"]*)"/gi;
      let urlMatch: RegExpExecArray | null;
      while ((urlMatch = urlRe.exec(block)) !== null) {
        const abs = absolutize(base, urlMatch[1] ?? "");
        if (abs) urls.push(abs);
      }
    }
  }

  return urls;
}

interface ScoredImage {
  url: string;
  score: number;
  alt: string;
  context: string;
}

function extractImages(html: string, base: URL, galleryOnly = true): string[] {
  const scopedHtml = galleryOnly ? extractProductGalleryHtml(html) : html;
  const scored: ScoredImage[] = [];
  const push = (raw: string, context = "", alt = "", bonus = 0) => {
    const hq = toHighQuality(raw);
    const abs = absolutize(base, hq);
    if (!abs) return;
    const s = scoreImage(abs, context, alt) + bonus;
    if (s >= 14) scored.push({ url: abs, score: s, alt, context });
  };

  if (!galleryOnly) {
    for (const url of extractAllMeta(html, "og:image")) push(url, "og:image", "", 5);
  }

  for (const url of extractJsonLdImages(html, base)) {
    push(url, "jsonld product gallery", "", 35);
  }
  for (const url of extractScriptGalleryImages(scopedHtml, base)) {
    push(url, "gallery script product", "", 32);
  }

  const imgTagRe = /<img\b[^>]*>/gi;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgTagRe.exec(scopedHtml)) !== null) {
    const tag = imgMatch[0];
    const context = html.slice(
      Math.max(0, imgMatch.index - 300),
      imgMatch.index + tag.length + 300,
    );
    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    const alt = altMatch?.[1] ? decodeHtmlEntities(altMatch[1]) : "";

    const attrs = [
      "data-zoom-image",
      "data-zoom",
      "data-large",
      "data-large-img",
      "data-original",
      "data-full",
      "data-src",
      "data-lazy-src",
      "data-image",
      "src",
    ];

    for (const attr of attrs) {
      const re = new RegExp(`${attr}=["']([^"']+)["']`, "i");
      const m = tag.match(re);
      if (m?.[1]) push(m[1], context, alt, attr.startsWith("data-") ? 14 : 6);
    }

    const srcsetMatch = tag.match(/srcset=["']([^"']+)["']/i);
    if (srcsetMatch?.[1]) {
      const best = pickLargestFromSrcset(srcsetMatch[1], base);
      if (best) push(best, context, alt, 20);
    }
  }

  const sourceRe = /<source[^>]+srcset=["']([^"']+)["'][^>]*>/gi;
  let sourceMatch: RegExpExecArray | null;
  while ((sourceMatch = sourceRe.exec(html)) !== null) {
    const context = html.slice(
      Math.max(0, sourceMatch.index - 200),
      sourceMatch.index + 200,
    );
    const best = pickLargestFromSrcset(sourceMatch[1] ?? "", base);
    if (best) push(best, context, "", 16);
  }

  scored.sort((a, b) => {
    const rankA = imageSortRank(a.url, a.alt, a.context);
    const rankB = imageSortRank(b.url, b.alt, b.context);
    if (rankA !== rankB) return rankA - rankB;
    return b.score - a.score;
  });

  const seen = new Set<string>();
  const result: string[] = [];

  for (const { url } of scored) {
    const key = imageDedupeKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(url);
    if (result.length >= productImportConfig.maxImages) break;
  }

  return result;
}

/** Récupère nom + images produit depuis une page. */
export async function scrapeProductPage(rawUrl: string): Promise<ScrapedProduct> {
  const url = await validateSourceUrl(rawUrl);
  const html = await fetchProductPageHtml(url);

  const rawName = extractTitle(html)?.replace(/\s+/g, " ").trim();
  if (!rawName || rawName.length < 2) {
    throw new Error("Impossible d'extraire le nom du produit depuis cette page.");
  }

  const description = extractMeta(html, "description") ?? "";
  const audience = detectAudience(`${rawName} ${description}`);
  const name = formatProductName(rawName, description).slice(0, 250);

  let images = extractImages(html, url, true);
  if (images.length === 0) {
    images = extractImages(html, url, false);
  }
  if (images.length === 0) {
    for (const og of extractAllMeta(html, "og:image")) {
      const abs = absolutize(url, og);
      if (abs) {
        images.push(abs);
        break;
      }
    }
  }
  if (images.length === 0) {
    throw new Error("Aucune image maillot (fond blanc) trouvée sur cette page.");
  }

  return {
    sourceUrl: url.toString(),
    name,
    images,
    audience,
  };
}
