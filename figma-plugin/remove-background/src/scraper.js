const BAD_URL =
  /logo|icon|avatar|sprite|banner|payment|visa|mastercard|paypal|amex|shipping|delivery|trust|badge|star|rating|review|social|facebook|twitter|instagram|whatsapp|tiktok|flag|placeholder|spinner|loading|empty|no[_-]?image|default[_-]?image|favicon|pixel|tracking|newsletter|popup|advert|ads?[_-]|promo[_-]bar|header|footer|nav|menu|cart|wishlist|compare|share|zoom[_-]icon|play[_-]button|video|cap|casquette|hat|beanie|snapback|shoe|chaussure|sneaker|ballon|ball|sock|chaussette|pant|hoodie|sweat|jacket|veste|related|recommend|similar|also|bundle|size[_-]?chart|guide|measure|\.svg(\?|$)|\.gif(\?|$)/i;

const THUMB_IN_URL =
  /[_\-.](thumb|thumbnail|small|mini|icon|xs|sm|compact|preview)([_\-.]|$)|[_-](\d{1,2}x\d{1,2}|\d{2,3}x\d{2,3})(\.|[_-]|$)|\/thumb\/|\/cache\/|w_\d{2,3}\b|h_\d{2,3}\b|[?&](w|width|h|height)=\d{1,3}(?:&|$)/i;

const PRODUCT_HINT =
  /product|gallery|zoom|slider|swiper|maillot|jersey|kit|pdp|detail|item[_-]?image|main[_-]?image|large|original|full|hd|media\/image/i;

const MODEL_BAD =
  /mannequin|manikin|manne?qin|model|worn|wear|lifestyle|lookbook|outfit|on[_-]?body|person|player[_-]?wear|portrait|styling|editorial|couple|holding|human|torso|runway|campaign|fitness|gym|training|shoot|couverture|cover[_-]?image|hero|banner|look[_-]?book/i;

const JERSEY_GOOD =
  /flat|lay|packshot|pack[_-]?shot|ghost|isolated|product[_-]?only|vue[_-]?de[_-]?face|sans[_-]?mannequin|without[_-]?model|front|avant|recto|jersey|maillot|kit|shirt|gallery|pdp|article|articleimage/i;

const DIRECT_IMAGE = /\.(jpe?g|png|webp)(\?|$)/i;

const FETCH_HEADERS = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)));
}

function absolutize(base, href) {
  try {
    const trimmed = href.trim();
    if (!trimmed || trimmed.startsWith("data:")) return null;
    return new URL(trimmed, base).toString();
  } catch {
    return null;
  }
}

function normalizePageUrl(raw) {
  const url = new URL(raw.trim());
  if (url.hostname === "bbdbuy.com") url.hostname = "www.bbdbuy.com";
  return url.toString();
}

function toHighQuality(url) {
  let u = url
    .replace(/_small|_thumb|_thumbnail|_medium|_compact|_mini/gi, "_large")
    .replace(/\/thumb\//gi, "/large/")
    .replace(/\/cache\/[a-z0-9]+\//gi, "/")
    .replace(/([?&])(w|width|h|height)=\d+/gi, "$1$2=2000");

  if (/cdn\.shopify\.com/i.test(u)) {
    u = u.replace(/_\d+x(\.|$)/, "_2000x$1");
    if (!/[?&]width=/i.test(u)) u += (u.includes("?") ? "&" : "?") + "width=2000";
  }

  return u;
}

function scoreImage(url, context = "", alt = "", galleryIndex = 99) {
  const hay = `${url} ${context} ${alt}`.toLowerCase();
  if (BAD_URL.test(url)) return -100;
  if (THUMB_IN_URL.test(url)) return -100;
  if (isDefinitelyNotFront(url, alt, context, galleryIndex)) return -100;
  if (MODEL_BAD.test(hay) && !JERSEY_GOOD.test(hay)) return -80;

  let score = 0;
  if (PRODUCT_HINT.test(hay)) score += 18;
  if (JERSEY_GOOD.test(hay)) score += 28;
  if (/\.(jpe?g|webp)(\?|$)/i.test(url)) score += 8;

  if (/gallery|product|main|swiper|pdp/i.test(context)) score += 18;
  if (/white|blanc|#fff|#ffffff|isolated|packshot|ghost|studio[_-]?white|fond[_-]?blanc/i.test(hay)) {
    score += 30;
  }

  if (/front|face|avant|recto|_f\b|_front|vue[_-]?1/i.test(hay)) score += 30;
  if (galleryIndex === 0) score += 45;
  else if (galleryIndex === 1) score += 5;
  else if (galleryIndex >= 3) score -= 15;

  const dim = url.match(/(\d{3,4})x(\d{3,4})/i);
  if (dim) score += Math.min(20, Number(dim[1]) / 50);

  return score;
}

function imageDedupeKey(url) {
  try {
    const u = new URL(url);
    const path = u.pathname
      .replace(/_\d+x\d+/gi, "")
      .replace(/\d{2,4}x\d{2,4}/gi, "")
      .replace(/\/(\d+)\.(jpe?g|png|webp)$/i, "/$1")
      .replace(/\.(jpe?g|png|webp)$/i, "");
    return `${u.hostname}${path}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function extractMeta(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) return decodeHtmlEntities(match[1].trim());
  }
  return null;
}

function extractAllMeta(html, property) {
  const urls = [];
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "gi"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "gi"),
  ];
  for (const re of patterns) {
    let match;
    while ((match = re.exec(html)) !== null) {
      if (match[1]) urls.push(decodeHtmlEntities(match[1].trim()));
    }
  }
  return urls;
}

function extractTitle(html) {
  const og = extractMeta(html, "og:title");
  if (og) return og;
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1?.[1]) return decodeHtmlEntities(h1[1].replace(/<[^>]+>/g, "").trim());
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title?.[1]) return decodeHtmlEntities(title[1].trim());
  return null;
}

function extractProductGalleryHtml(html) {
  const patterns = [
    /<div[^>]+class="[^"]*(?:product[_-]gallery|gallery[_-]product|pdp[_-]gallery|product[_-]images|image[_-]gallery|productGallery|product-detail|product_detail|goods[_-]gallery|detail[_-]pic|goods[_-]photo|pro[_-]img|item[_-]photo)[^"]*"[^>]*>[\s\S]*$/gi,
    /<section[^>]+class="[^"]*(?:product[_-]image|product[_-]gallery)[^"]*"[^>]*>[\s\S]*?<\/section>/gi,
    /<ul[^>]+class="[^"]*(?:product|gallery|swiper|slider|thumb)[^"]*"[^>]*>[\s\S]*?<\/ul>/gi,
    /<div[^>]+id="[^"]*(?:gallery|product[_-]?image|photos)[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
  ];

  let best = "";
  for (const re of patterns) {
    let match;
    while ((match = re.exec(html)) !== null) {
      const block = match[0];
      if (block.length > best.length && block.length < 150_000) best = block.slice(0, 150_000);
    }
  }

  return best || html;
}

function pickLargestFromSrcset(srcset, base) {
  const candidates = [];
  for (const part of srcset.split(",")) {
    const bits = part.trim().split(/\s+/);
    const raw = bits[0];
    if (!raw) continue;
    const abs = absolutize(base, raw);
    if (!abs) continue;
    const w = bits[1]?.endsWith("w") ? Number.parseInt(bits[1], 10) || 0 : 0;
    candidates.push({ url: abs, width: w });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.width - a.width);
  return candidates[0]?.url ?? null;
}

function collectJsonImages(node, urls, base) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) collectJsonImages(item, urls, base);
    return;
  }
  if (typeof node !== "object") return;

  const type = String(node["@type"] ?? "").toLowerCase();
  if (type.includes("product") || node.image) {
    const image = node.image;
    if (typeof image === "string") {
      const abs = absolutize(base, image);
      if (abs) urls.push(abs);
    } else if (Array.isArray(image)) {
      for (const item of image) {
        if (typeof item === "string") {
          const abs = absolutize(base, item);
          if (abs) urls.push(abs);
        } else if (item?.url) {
          const abs = absolutize(base, item.url);
          if (abs) urls.push(abs);
        }
      }
    } else if (image?.url) {
      const abs = absolutize(base, image.url);
      if (abs) urls.push(abs);
    }
  }

  if (node["@graph"]) collectJsonImages(node["@graph"], urls, base);
}

function extractJsonLdImages(html, base) {
  const urls = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      collectJsonImages(JSON.parse(raw), urls, base);
    } catch {
      // ignore
    }
  }
  return urls;
}

function extractScriptGalleryImages(html, base) {
  const urls = [];
  const arrayPatterns = [
    /"images"\s*:\s*\[([\s\S]*?)\]/gi,
    /"productImages"\s*:\s*\[([\s\S]*?)\]/gi,
    /"galleryImages"\s*:\s*\[([\s\S]*?)\]/gi,
    /"picList"\s*:\s*\[([\s\S]*?)\]/gi,
    /"imageList"\s*:\s*\[([\s\S]*?)\]/gi,
  ];

  for (const re of arrayPatterns) {
    let match;
    while ((match = re.exec(html)) !== null) {
      const block = match[1] ?? "";
      const urlRe = /"(https?:\/\/[^"]+\.(?:jpe?g|png|webp)[^"]*)"/gi;
      let urlMatch;
      while ((urlMatch = urlRe.exec(block)) !== null) {
        const abs = absolutize(base, urlMatch[1] ?? "");
        if (abs) urls.push(abs);
      }
    }
  }

  return urls;
}

function pushCandidate(list, seen, raw, base, context, alt, galleryIndex, bonus = 0) {
  const hq = toHighQuality(raw);
  const abs = absolutize(base, hq);
  if (!abs || !/\.(jpe?g|png|webp)(\?|$)/i.test(abs)) return;

  const key = imageDedupeKey(abs);
  if (seen.has(key)) return;
  if (isDefinitelyNotFront(abs, alt, context, galleryIndex)) return;

  const score = scoreImage(abs, context, alt, galleryIndex) + bonus;
  if (score < 20) return;

  seen.add(key);
  list.push({ url: abs, score, alt, context, galleryIndex });
}

function extractImageCandidates(html, baseUrl) {
  const base = new URL(baseUrl);
  const galleryHtml = extractProductGalleryHtml(html);
  const candidates = [];
  const seen = new Set();
  let galleryIndex = 0;

  const imgTagRe = /<img\b[^>]*>/gi;
  let imgMatch;
  while ((imgMatch = imgTagRe.exec(galleryHtml)) !== null) {
    const tag = imgMatch[0];
    const context = galleryHtml.slice(
      Math.max(0, imgMatch.index - 250),
      imgMatch.index + tag.length + 250,
    );
    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    const alt = altMatch?.[1] ? decodeHtmlEntities(altMatch[1]) : "";
    const order = galleryIndex++;

    for (const attr of [
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
    ]) {
      const re = new RegExp(`${attr}=["']([^"']+)["']`, "i");
      const m = tag.match(re);
      if (m?.[1]) pushCandidate(candidates, seen, m[1], base, context, alt, order, attr.startsWith("data-") ? 12 : 4);
    }

    const srcsetMatch = tag.match(/srcset=["']([^"']+)["']/i);
    if (srcsetMatch?.[1]) {
      const best = pickLargestFromSrcset(srcsetMatch[1], base);
      if (best) pushCandidate(candidates, seen, best, base, context, alt, order, 16);
    }
  }

  const linkRe = /<a\b[^>]+href=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["'][^>]*>/gi;
  let linkMatch;
  let linkIndex = 0;
  while ((linkMatch = linkRe.exec(galleryHtml)) !== null) {
    pushCandidate(candidates, seen, linkMatch[1], base, "gallery link", "", linkIndex++, 10);
  }

  const styleRe = /background-image\s*:\s*url\(["']?([^"']+\.(?:jpe?g|png|webp)[^"']*)["']?\)/gi;
  let styleMatch;
  while ((styleMatch = styleRe.exec(galleryHtml)) !== null) {
    pushCandidate(candidates, seen, styleMatch[1], base, "gallery bg", "", galleryIndex++, 8);
  }

  for (const [idx, url] of extractJsonLdImages(html, base).entries()) {
    pushCandidate(candidates, seen, url, base, "jsonld product", "", idx, 30);
  }

  for (const [idx, url] of extractScriptGalleryImages(html, base).entries()) {
    pushCandidate(candidates, seen, url, base, "script gallery", "", idx, 25);
  }

  if (!candidates.length) {
    const fullImgRe = /<img\b[^>]*>/gi;
    let fullMatch;
    let idx = 0;
    while ((fullMatch = fullImgRe.exec(html)) !== null) {
      const tag = fullMatch[0];
      const context = html.slice(Math.max(0, fullMatch.index - 200), fullMatch.index + 300);
      const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
      if (src) pushCandidate(candidates, seen, src, base, context, "", idx++, 0);
    }
  }

  candidates.sort((a, b) => {
    if (a.galleryIndex !== b.galleryIndex) return a.galleryIndex - b.galleryIndex;
    return b.score - a.score;
  });

  return candidates;
}

function nameFromUrl(urlString) {
  try {
    const url = new URL(urlString);
    const segment = url.pathname.split("/").pop() ?? "Maillot";
    return decodeURIComponent(segment.replace(/\.[^.]+$/, "")).replace(/[-_]+/g, " ").trim() || "Maillot";
  } catch {
    return "Maillot";
  }
}

function cleanProductName(name) {
  return name.replace(/\s+/g, " ").replace(/\|.*$/, "").trim().slice(0, 120);
}

async function fetchPageHtml(pageUrl, signal) {
  const normalized = normalizePageUrl(pageUrl);
  const res = await fetchWithRetry(normalized, {
    signal,
    headers: {
      ...FETCH_HEADERS,
      Referer: new URL(normalized).origin + "/",
    },
  });

  const contentType = res.headers.get("content-type") ?? "";
  if (
    !contentType.includes("text/html") &&
    !contentType.includes("application/xhtml") &&
    !contentType.includes("text/plain")
  ) {
    throw new Error("Ce lien ne pointe pas vers une page produit.");
  }

  return res.text();
}

async function fetchImageBytes(imageUrl, referer, signal) {
  const res = await fetchWithRetry(imageUrl, {
    signal,
    headers: {
      ...FETCH_HEADERS,
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      Referer: referer || new URL(imageUrl).origin + "/",
    },
  });

  const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!bytes.length) throw new Error("Image vide.");
  return { bytes, mimeType };
}

async function pickValidatedFrontJersey(candidates, pageUrl, signal) {
  if (!candidates.length) {
    throw new Error("Aucune image trouvée sur cette page.");
  }

  const sorted = candidates.slice().sort((a, b) => {
    if (a.galleryIndex !== b.galleryIndex) return a.galleryIndex - b.galleryIndex;
    return b.score - a.score;
  });

  const toTry = sorted.slice(0, 8);
  const errors = [];

  for (const candidate of toTry) {
    checkCancelled();
    try {
      const { bytes, mimeType } = await fetchImageBytes(candidate.url, pageUrl, signal);
      const analysis = await analyzePackshot(bytes, mimeType);

      if (analysis.ok) {
        return { bytes, mimeType, imageUrl: candidate.url };
      }

      errors.push(analysis.reason || "rejetée");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err;
      errors.push(err instanceof Error ? err.message : "erreur");
    }
  }

  throw new Error(
    `Aucun maillot de face à plat trouvé (${errors.slice(0, 2).join(", ") || "images non conformes"}).`,
  );
}

function parseUrlLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Lien produit → une seule image vue de face validée par analyse pixel. */
async function resolveJerseyFromUrl(rawUrl) {
  checkCancelled();

  const trimmed = rawUrl.trim();
  if (!trimmed) throw new Error("URL vide.");

  let url;
  try {
    url = new URL(normalizePageUrl(trimmed));
  } catch {
    throw new Error(`URL invalide : ${trimmed}`);
  }

  const signal = typeof getFetchSignal === "function" ? getFetchSignal() : undefined;

  if (DIRECT_IMAGE.test(`${url.pathname}${url.search}`)) {
    const { bytes, mimeType } = await fetchImageBytes(url.toString(), url.origin + "/", signal);
    const analysis = await analyzePackshot(bytes, mimeType);
    if (!analysis.ok) {
      throw new Error(`Image directe non conforme (${analysis.reason || "pas un packshot face"}).`);
    }
    return { name: nameFromUrl(url.toString()), bytes, mimeType };
  }

  const html = await fetchPageHtml(url.toString(), signal);
  const name = cleanProductName(extractTitle(html) || nameFromUrl(url.toString()));

  let candidates = extractImageCandidates(html, url.toString());

  if (!candidates.length) {
    for (const raw of extractAllMeta(html, "og:image")) {
      pushCandidate(candidates, new Set(), raw, url, "og:image", "", 0, 5);
    }
  }

  const picked = await pickValidatedFrontJersey(candidates, url.toString(), signal);
  return { name, bytes: picked.bytes, mimeType: picked.mimeType };
}
