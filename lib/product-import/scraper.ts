import "server-only";

import { productImportConfig } from "@/config/product-import";
import { formatProductName, detectAudienceFromProduct, type ProductAudience } from "@/lib/product-import/format-product-name";
import { fetchProductPageHtml } from "@/lib/product-import/fetch-page";
import {
  isLikelyThumbnailUrl,
  normalizeImageDedupeKey,
  toHighQualityImageUrl,
} from "@/lib/product-import/image-url-quality";
import { validateSourceUrl } from "@/lib/product-import/validate-url";

export interface ScrapedProduct {
  sourceUrl: string;
  name: string;
  images: string[];
  audience: ProductAudience;
  rawTitle: string;
  description: string;
}

const BAD_URL =
  /logo|wordmark|watermark|site[_-]?logo|store[_-]?logo|brand[_-]?logo|icon|avatar|sprite|banner|payment|visa|mastercard|paypal|amex|shipping|delivery|trust|badge[_-]?icon|star|rating|review|social|facebook|twitter|instagram|whatsapp|tiktok|flag|placeholder|spinner|loading|empty|no[_-]?image|default[_-]?image|favicon|pixel|tracking|newsletter|popup|advert|ads?[_-]|promo[_-]bar|header|footer|nav|menu|cart|wishlist|compare|share|zoom[_-]icon|play[_-]button|video|cap|casquette|hat|beanie|snapback|shoe|chaussure|sneaker|ballon|ball|sock|chaussette|pant|hoodie|sweat|jacket|veste|partner|affiliate|size[_-]?guide|measure|chart|\.svg(\?|$)|\.gif(\?|$)/i;

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

function extractJsonLdName(html: string): string | null {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = re.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      const name = findProductNameInJsonLd(JSON.parse(raw) as unknown);
      if (name) return name;
    } catch {
      // ignore invalid JSON-LD blocks
    }
  }

  return null;
}

function findProductNameInJsonLd(node: unknown): string | null {
  if (!node) return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findProductNameInJsonLd(item);
      if (found) return found;
    }
    return null;
  }

  if (typeof node !== "object") return null;
  const record = node as Record<string, unknown>;
  const type = String(record["@type"] ?? "").toLowerCase();

  if (type.includes("product") && typeof record.name === "string") {
    const name = record.name.trim();
    if (name.length >= 2) return name;
  }

  if (record["@graph"]) {
    const found = findProductNameInJsonLd(record["@graph"]);
    if (found) return found;
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === "object") {
      const found = findProductNameInJsonLd(value);
      if (found) return found;
    }
  }

  return null;
}

function extractTitleFromUrl(url: URL): string | null {
  const segments = url.pathname.split("/").filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    const raw = segments[i] ?? "";
    if (!raw || /^\d+$/.test(raw) || raw.length < 3) continue;
    const decoded = decodeURIComponent(raw)
      .replace(/\.[a-z]{2,4}$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (decoded.length >= 3) return decoded;
  }
  return null;
}

function extractItempropName(html: string): string | null {
  const patterns = [
    /<[^>]+itemprop=["']name["'][^>]+content=["']([^"']+)["']/i,
    /<[^>]+content=["']([^"']+)["'][^>]+itemprop=["']name["']/i,
    /<[^>]+itemprop=["']name["'][^>]*>([\s\S]*?)<\//i,
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1].replace(/<[^>]+>/g, "").trim());
    }
  }
  return null;
}

function isGenericSlugName(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return true;
  if (/^team\s+(domicile|exterieur|exterior|away|home|third)\b/.test(n)) return true;
  if (/^(maillot|jersey|shirt|kit)\s+(domicile|exterieur|away|home)\b/.test(n) && n.length < 28) {
    return true;
  }
  if (/^(product|article|item|sku)[-_]?\d+$/i.test(n)) return true;
  return false;
}

function scoreProductNameCandidate(name: string, source: "page" | "url"): number {
  const cleaned = name.replace(/\s+/g, " ").trim();
  if (cleaned.length < 3) return -100;

  let score = source === "page" ? 50 : 5;
  if (isGenericSlugName(cleaned)) score -= 70;
  if (/\b(20[2-3]\d)\b/.test(cleaned)) score += 8;
  if (/\b(maillot|jersey|shirt|kit)\b/i.test(cleaned)) score += 6;
  if (/\b(domicile|extérieur|exterieur|away|home|third)\b/i.test(cleaned)) score += 4;
  if (cleaned.length >= 18) score += 10;
  if (/[|•·]/.test(cleaned)) score += 3;
  if (/\.(fr|com|net|de)\b/i.test(cleaned)) score -= 25;
  if (/^(www\.|http)/i.test(cleaned)) score -= 40;

  return score;
}

function extractProductName(html: string, url: URL): string {
  const candidates: { name: string; score: number }[] = [];

  const pageSources = [
    extractItempropName(html),
    extractJsonLdName(html),
    extractMeta(html, "og:title"),
    extractMeta(html, "twitter:title"),
    extractTitle(html),
    extractMeta(html, "product:name"),
  ];

  for (const candidate of pageSources) {
    const cleaned = candidate?.replace(/\s+/g, " ").trim();
    if (!cleaned || cleaned.length < 2) continue;
    candidates.push({
      name: cleaned,
      score: scoreProductNameCandidate(cleaned, "page"),
    });
  }

  const slug = extractTitleFromUrl(url);
  if (slug) {
    candidates.push({
      name: slug,
      score: scoreProductNameCandidate(slug, "url"),
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates.find((c) => c.score > 0);
  if (best) return best.name;

  throw new Error("Impossible d'extraire le nom du produit depuis cette page.");
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

function imageDedupeKey(url: string): string {
  return normalizeImageDedupeKey(url);
}

const IMG_URL_ATTRS = [
  "data-zoom-image",
  "data-zoom",
  "data-original",
  "data-large-img",
  "data-large",
  "data-full",
  "data-image",
  "data-src",
  "data-lazy-src",
  "src",
] as const;

function pickBestUrlFromImgTag(tag: string): string | null {
  for (const attr of IMG_URL_ATTRS) {
    const m = tag.match(new RegExp(`${attr}=["']([^"']+)["']`, "i"));
    const raw = m?.[1]?.trim();
    if (raw && !raw.startsWith("data:")) return raw;
  }
  return null;
}

function scoreImage(url: string, context = "", alt = "", galleryIndex = 99): number {
  const hay = `${url} ${context} ${alt}`.toLowerCase();

  if (BAD_URL.test(url)) return -100;
  if (/logo|wordmark|watermark|site[_-]?logo|brand[_-]?logo|favicon|icon|sprite|partner|affiliate/i.test(hay)) {
    return -100;
  }
  if (MODEL_BAD.test(hay) && !JERSEY_GOOD.test(hay)) return -80;

  let score = 0;
  if (THUMB_IN_URL.test(url) || isLikelyThumbnailUrl(url)) score -= 60;
  if (PRODUCT_HINT.test(hay)) score += 18;
  if (JERSEY_GOOD.test(hay)) score += 28;
  if (/\.(jpe?g|webp)(\?|$)/i.test(url)) score += 8;
  if (/\.png(\?|$)/i.test(url) && !PRODUCT_HINT.test(hay)) score -= 15;

  const dim = url.match(/(\d{3,4})x(\d{3,4})/i);
  if (dim) score += Math.min(25, Number(dim[1]) / 40);

  if (/gallery|product|zoom|main|swiper|pdp/i.test(context)) score += 18;
  if (/white|blanc|#fff|#ffffff|isolated|packshot|ghost|studio[_-]?white|fond[_-]?blanc/i.test(hay)) {
    score += 30;
  }
  if (/og:image|twitter:image/i.test(context)) score -= 25;
  if (/og:image|twitter:image/i.test(context) && MODEL_BAD.test(hay)) score -= 30;

  if (/front|face|avant|recto|_f\b|_front|vue[_-]?1/i.test(hay)) score += 22;
  else if (/back|dos|verso|rear|_b\b|_back|vue[_-]?2/i.test(hay)) score += 20;
  else if (/side|profil|lateral|_s\b|_side|vue[_-]?3/i.test(hay)) score += 16;
  else if (/detail|zoom|macro|close|texture|fabric/i.test(hay)) score += 14;

  if (galleryIndex === 0) score += 12;
  else if (galleryIndex === 1) score += 8;
  else if (galleryIndex >= 0 && galleryIndex < 8) score += 4;

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
    /"picList"\s*:\s*\[([\s\S]*?)\]/gi,
    /"imageList"\s*:\s*\[([\s\S]*?)\]/gi,
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

interface GalleryCandidate {
  url: string;
  score: number;
  galleryIndex: number;
  viewRank: number;
}

function pushGalleryCandidate(
  list: GalleryCandidate[],
  seen: Set<string>,
  raw: string,
  base: URL,
  context: string,
  alt: string,
  galleryIndex: number,
  bonus = 0,
): void {
  const hq = toHighQualityImageUrl(raw);
  const abs = absolutize(base, hq);
  if (!abs || !/\.(jpe?g|png|webp)(\?|$)/i.test(abs)) return;

  const key = imageDedupeKey(abs);
  if (seen.has(key)) return;

  const score = scoreImage(abs, context, alt, galleryIndex) + bonus;
  if (score < 14) return;

  seen.add(key);
  list.push({
    url: abs,
    score,
    galleryIndex,
    viewRank: imageSortRank(abs, alt, context),
  });
}

function extractImages(html: string, base: URL, galleryOnly: boolean, maxImages: number): string[] {
  const scopedHtml = galleryOnly ? extractProductGalleryHtml(html) : html;
  const candidates: GalleryCandidate[] = [];
  const seen = new Set<string>();
  let galleryIndex = 0;

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
    const order = galleryIndex++;

    const best = pickBestUrlFromImgTag(tag);
    if (best) {
      pushGalleryCandidate(candidates, seen, best, base, context, alt, order, 10);
    }

    const srcsetMatch = tag.match(/srcset=["']([^"']+)["']/i);
    if (srcsetMatch?.[1]) {
      const largest = pickLargestFromSrcset(srcsetMatch[1], base);
      if (largest) {
        pushGalleryCandidate(candidates, seen, largest, base, context, alt, order, 16);
      }
    }
  }

  const linkRe = /<a\b[^>]+href=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["'][^>]*>/gi;
  let linkMatch: RegExpExecArray | null;
  let linkIndex = 0;
  while ((linkMatch = linkRe.exec(scopedHtml)) !== null) {
    pushGalleryCandidate(
      candidates,
      seen,
      linkMatch[1] ?? "",
      base,
      "gallery link",
      "",
      linkIndex++,
      8,
    );
  }

  const styleRe =
    /background-image\s*:\s*url\(["']?([^"')]+\.(?:jpe?g|png|webp)[^"')]*)["']?\)/gi;
  let styleMatch: RegExpExecArray | null;
  while ((styleMatch = styleRe.exec(scopedHtml)) !== null) {
    pushGalleryCandidate(
      candidates,
      seen,
      styleMatch[1] ?? "",
      base,
      "gallery background",
      "",
      galleryIndex++,
      6,
    );
  }

  if (!galleryOnly) {
    for (const url of extractAllMeta(html, "og:image")) {
      pushGalleryCandidate(candidates, seen, url, base, "og:image", "", 0, -10);
    }
  }

  for (const [idx, url] of extractJsonLdImages(html, base).entries()) {
    pushGalleryCandidate(candidates, seen, url, base, "jsonld product gallery", "", idx, 30);
  }
  for (const [idx, url] of extractScriptGalleryImages(scopedHtml, base).entries()) {
    pushGalleryCandidate(candidates, seen, url, base, "gallery script product", "", idx, 28);
  }

  const sourceRe = /<source[^>]+srcset=["']([^"']+)["'][^>]*>/gi;
  let sourceMatch: RegExpExecArray | null;
  let sourceIndex = 0;
  while ((sourceMatch = sourceRe.exec(scopedHtml)) !== null) {
    const best = pickLargestFromSrcset(sourceMatch[1] ?? "", base);
    if (best) {
      pushGalleryCandidate(candidates, seen, best, base, "gallery source", "", sourceIndex++, 14);
    }
  }

  candidates.sort((a, b) => {
    if (a.galleryIndex !== b.galleryIndex) return a.galleryIndex - b.galleryIndex;
    if (a.viewRank !== b.viewRank) return a.viewRank - b.viewRank;
    return b.score - a.score;
  });

  const result: string[] = [];
  const resultSeen = new Set<string>();

  for (const { url } of candidates) {
    const key = imageDedupeKey(url);
    if (resultSeen.has(key)) continue;
    resultSeen.add(key);
    result.push(isLikelyThumbnailUrl(url) ? toHighQualityImageUrl(url) : url);
    if (result.length >= maxImages) break;
  }

  return result;
}

/** Récupère nom + images produit depuis une page. */
export async function scrapeProductPage(
  rawUrl: string,
  opts?: { maxImages?: number },
): Promise<ScrapedProduct> {
  const url = await validateSourceUrl(rawUrl);
  const html = await fetchProductPageHtml(url);

  const rawName = extractProductName(html, url);

  const maxImages = opts?.maxImages ?? productImportConfig.maxImages;
  const seenKeys = new Set<string>();
  const images: string[] = [];

  function mergeImages(urls: string[]) {
    for (const img of urls) {
      const key = imageDedupeKey(img);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      images.push(img);
      if (images.length >= maxImages) break;
    }
  }

  mergeImages(extractImages(html, url, true, maxImages));
  if (images.length < maxImages) {
    mergeImages(extractImages(html, url, false, maxImages));
  }
  if (images.length === 0) {
    for (const og of extractAllMeta(html, "og:image")) {
      const abs = absolutize(url, og);
      if (abs) {
        mergeImages([abs]);
        break;
      }
    }
  }

  const audience = detectAudienceFromProduct(rawName, "");
  const name = formatProductName(rawName, url.toString()).slice(0, 250);

  return {
    sourceUrl: url.toString(),
    name,
    images,
    audience,
    rawTitle: rawName,
    description: "",
  };
}
