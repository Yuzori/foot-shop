"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

  // <define:__PLUGIN_API_ORIGINS__>
  var define_PLUGIN_API_ORIGINS_default = ["https://foot-shop.onrender.com", "https://foot-shop.fr", "https://www.foot-shop.fr"];

  // src/scrape-main.js
  var DETAIL_BAD = /detail|zoom|macro|closeup|close[_-]?up|crop|patch|badge|logo|label|tag|size[_-]?chart|size[_-]?guide|measure|fabric|texture|sponsor|collar|neck|sleeve|button|stitch|embroidery|crest|numero|number|print|close|fragment|part|section|area|focus|thumb|mini|small|preview|banner|hero|slider|nav|related|recommend|similar|also|bundle|set|pair|shorts|pant|sock|ball|cap|hat|shoe|sneaker|kids?[_-]?model|child[_-]?model/i;
  var BACK_SIDE_STRICT = /back|dos|verso|rear|_b\b|_back|vue[_-]?2\b|side|profil|lateral|_s\b|_side|vue[_-]?3\b|inside|interior|lining|2\.(?:jpe?g|png|webp)|_2\.(?:jpe?g|png|webp)|\/2[\./_-]|image[_-]?2|photo[_-]?2|pic[_-]?2/i;
  function isDefinitelyNotFront(url, alt = "", context = "", galleryIndex = 99) {
    const hay = `${url} ${alt} ${context}`.toLowerCase();
    if (/front|face|avant|recto|_f\b|_front|vue[_-]?1\b|1\.(?:jpe?g|png|webp)|_1\.(?:jpe?g|png|webp)|image[_-]?1|photo[_-]?1|pic[_-]?1/i.test(hay)) {
      if (!BACK_SIDE_STRICT.test(hay) && !DETAIL_BAD.test(hay)) return false;
    }
    if (BACK_SIDE_STRICT.test(hay)) return true;
    if (DETAIL_BAD.test(hay)) return true;
    if (galleryIndex > 0 && !/front|face|avant|recto|gallery|product|main/i.test(hay)) {
      if (/2\.|_2\.|\/2[./_-]|image.?2|photo.?2/i.test(hay)) return true;
    }
    return false;
  }
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function hostFromUrl(url) {
    const parsed = manualParseHttpUrl(url);
    return (parsed == null ? void 0 : parsed.hostname) || "domaine inconnu";
  }
  async function fetchWithRetry(url, options = {}, retries = 4) {
    let lastError = "failed to fetch";
    const fetchOptions = {};
    if (options.headers) fetchOptions.headers = options.headers;
    if (options.method) fetchOptions.method = options.method;
    if (options.body) fetchOptions.body = options.body;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = await fetch(url, fetchOptions);
        if (res.ok) return res;
        if (res.status === 403 || res.status === 429 || res.status >= 500) {
          lastError = `HTTP ${res.status}`;
          await sleep(600 * (attempt + 1));
          continue;
        }
        throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        lastError = err instanceof Error ? err.message : lastError;
        if (attempt < retries - 1) await sleep(600 * (attempt + 1));
      }
    }
    throw new Error(
      `R\xE9seau Figma bloqu\xE9 vers ${hostFromUrl(url)} (${lastError}) \u2014 importe manifest.json v3 (Plugins \u2192 Development \u2192 Import plugin from manifest).`
    );
  }
  var BAD_URL = /logo|icon|avatar|sprite|banner|payment|visa|mastercard|paypal|amex|shipping|delivery|trust|badge|star|rating|review|social|facebook|twitter|instagram|whatsapp|tiktok|flag|placeholder|spinner|loading|empty|no[_-]?image|default[_-]?image|favicon|pixel|tracking|newsletter|popup|advert|ads?[_-]|promo[_-]bar|header|footer|nav|menu|cart|wishlist|compare|share|zoom[_-]icon|play[_-]button|video|cap|casquette|hat|beanie|snapback|shoe|chaussure|sneaker|ballon|ball|sock|chaussette|pant|hoodie|sweat|jacket|veste|related|recommend|similar|also|bundle|size[_-]?chart|guide|measure|\.svg(\?|$)|\.gif(\?|$)/i;
  var THUMB_IN_URL = /[_\-.](thumb|thumbnail|small|mini|icon|xs|sm|compact|preview)([_\-.]|$)|[_-](\d{1,2}x\d{1,2}|\d{2,3}x\d{2,3})(\.|[_-]|$)|\/thumb\/|\/cache\/|w_\d{2,3}\b|h_\d{2,3}\b|[?&](w|width|h|height)=\d{1,3}(?:&|$)/i;
  var PRODUCT_HINT = /product|gallery|zoom|slider|swiper|maillot|jersey|kit|pdp|detail|item[_-]?image|main[_-]?image|large|original|full|hd|media\/image/i;
  var MODEL_BAD = /mannequin|manikin|manne?qin|model|worn|wear|lifestyle|lookbook|outfit|on[_-]?body|person|player[_-]?wear|portrait|styling|editorial|couple|holding|human|torso|runway|campaign|fitness|gym|training|shoot|couverture|cover[_-]?image|hero|banner|look[_-]?book/i;
  var JERSEY_GOOD = /flat|lay|packshot|pack[_-]?shot|ghost|isolated|product[_-]?only|vue[_-]?de[_-]?face|sans[_-]?mannequin|without[_-]?model|front|avant|recto|jersey|maillot|kit|shirt|gallery|pdp|article|articleimage/i;
  var DIRECT_IMAGE = /\.(jpe?g|png|webp)(\?|$)/i;
  var FETCH_HEADERS = {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  };
  function decodeHtmlEntities(value) {
    return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16))).replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)));
  }
  function resolveBaseHref(base) {
    if (!base) return "";
    if (typeof base === "string") return base;
    if (base.href) return base.href;
    if (typeof base.toString === "function") return base.toString();
    return String(base);
  }
  function absolutize(base, href) {
    const trimmed = href.trim();
    if (!trimmed || trimmed.startsWith("data:")) return null;
    if (/^https?:\/\//i.test(trimmed)) {
      const parsed = manualParseHttpUrl(trimmed);
      return parsed ? parsed.href : trimmed;
    }
    const baseParsed = manualParseHttpUrl(resolveBaseHref(base));
    if (!baseParsed) return null;
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return `${baseParsed.origin}${path}`;
  }
  function sanitizeRawUrl(raw) {
    return String(raw || "").trim().replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/^[Ee]rreur\s*:\s*(?:URL invalide\s*:\s*)?/i, "").replace(/[\u2026…]+$/g, "").replace(/[)\]},.;]+$/g, "");
  }
  function manualParseHttpUrl(raw) {
    let value = String(raw || "").trim().split(/[?#]/)[0];
    if (!value) return null;
    const match = value.match(/^(https?):\/\/([^/?#]+)(\/[^?#]*)?$/i);
    if (!match) return null;
    const protocol = match[1].toLowerCase();
    const host = match[2];
    const pathname = match[3] || "/";
    const hostname = host.replace(/:\d+$/, "");
    const origin = `${protocol}://${host}`;
    const href = origin + pathname;
    return {
      href,
      protocol: `${protocol}:`,
      hostname,
      host,
      pathname,
      search: "",
      hash: "",
      origin,
      toString() {
        return href;
      }
    };
  }
  function getUrlOrigin(raw) {
    const parsed = manualParseHttpUrl(raw);
    return parsed ? `${parsed.origin}/` : String(raw || "");
  }
  function parsePageUrl(raw) {
    let value = sanitizeRawUrl(raw);
    if (!value) throw new Error("URL vide.");
    const extracted = value.match(/https?:\/\/[^\s<>"']+/i);
    if (extracted) value = extracted[0];
    while (/%[0-9A-Fa-f]?$/.test(value)) {
      value = value.replace(/(%[0-9A-Fa-f]?)+$/g, "");
    }
    if (!/^https?:\/\//i.test(value)) {
      value = `https://${value.replace(/^\/+/, "")}`;
    }
    const parsed = manualParseHttpUrl(value);
    if (parsed) return parsed;
    throw new Error(
      `URL invalide : ${value.slice(0, 120)}${value.length > 120 ? "\u2026" : ""}`
    );
  }
  function normalizePageUrl(raw) {
    const url = parsePageUrl(raw);
    if (url.hostname === "bbdbuy.com") {
      return parsePageUrl(url.href.replace("://bbdbuy.com", "://www.bbdbuy.com")).toString();
    }
    return url.toString();
  }
  function toHighQuality(url) {
    let u = url.replace(/_small|_thumb|_thumbnail|_medium|_compact|_mini/gi, "_large").replace(/\/thumb\//gi, "/large/").replace(/\/cache\/[a-z0-9]+\//gi, "/").replace(/([?&])(w|width|h|height)=\d+/gi, "$1$2=2000");
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
      const path = u.pathname.replace(/_\d+x\d+/gi, "").replace(/\d{2,4}x\d{2,4}/gi, "").replace(/\/(\d+)\.(jpe?g|png|webp)$/i, "/$1").replace(/\.(jpe?g|png|webp)$/i, "");
      return `${u.hostname}${path}`.toLowerCase();
    } catch (e) {
      return url.toLowerCase();
    }
  }
  function extractMeta(html, property) {
    const patterns = [
      new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i")
    ];
    for (const re of patterns) {
      const match = html.match(re);
      if (match == null ? void 0 : match[1]) return decodeHtmlEntities(match[1].trim());
    }
    return null;
  }
  function extractAllMeta(html, property) {
    const urls = [];
    const patterns = [
      new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "gi"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "gi")
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
    if (h1 == null ? void 0 : h1[1]) return decodeHtmlEntities(h1[1].replace(/<[^>]+>/g, "").trim());
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (title == null ? void 0 : title[1]) return decodeHtmlEntities(title[1].trim());
    return null;
  }
  function extractProductGalleryHtml(html) {
    const patterns = [
      /<div[^>]+class="[^"]*(?:product[_-]gallery|gallery[_-]product|pdp[_-]gallery|product[_-]images|image[_-]gallery|productGallery|product-detail|product_detail|goods[_-]gallery|detail[_-]pic|goods[_-]photo|pro[_-]img|item[_-]photo)[^"]*"[^>]*>[\s\S]*$/gi,
      /<section[^>]+class="[^"]*(?:product[_-]image|product[_-]gallery)[^"]*"[^>]*>[\s\S]*?<\/section>/gi,
      /<ul[^>]+class="[^"]*(?:product|gallery|swiper|slider|thumb)[^"]*"[^>]*>[\s\S]*?<\/ul>/gi,
      /<div[^>]+id="[^"]*(?:gallery|product[_-]?image|photos)[^"]*"[^>]*>[\s\S]*?<\/div>/gi
    ];
    let best = "";
    for (const re of patterns) {
      let match;
      while ((match = re.exec(html)) !== null) {
        const block = match[0];
        if (block.length > best.length && block.length < 15e4) best = block.slice(0, 15e4);
      }
    }
    return best || html;
  }
  function pickLargestFromSrcset(srcset, base) {
    var _a, _b, _c;
    const candidates = [];
    for (const part of srcset.split(",")) {
      const bits = part.trim().split(/\s+/);
      const raw = bits[0];
      if (!raw) continue;
      const abs = absolutize(base, raw);
      if (!abs) continue;
      const w = ((_a = bits[1]) == null ? void 0 : _a.endsWith("w")) ? Number.parseInt(bits[1], 10) || 0 : 0;
      candidates.push({ url: abs, width: w });
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => b.width - a.width);
    return (_c = (_b = candidates[0]) == null ? void 0 : _b.url) != null ? _c : null;
  }
  function collectJsonImages(node, urls, base) {
    var _a;
    if (!node) return;
    if (Array.isArray(node)) {
      for (const item of node) collectJsonImages(item, urls, base);
      return;
    }
    if (typeof node !== "object") return;
    const type = String((_a = node["@type"]) != null ? _a : "").toLowerCase();
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
          } else if (item == null ? void 0 : item.url) {
            const abs = absolutize(base, item.url);
            if (abs) urls.push(abs);
          }
        }
      } else if (image == null ? void 0 : image.url) {
        const abs = absolutize(base, image.url);
        if (abs) urls.push(abs);
      }
    }
    if (node["@graph"]) collectJsonImages(node["@graph"], urls, base);
  }
  function extractJsonLdImages(html, base) {
    var _a;
    const urls = [];
    const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = re.exec(html)) !== null) {
      const raw = (_a = match[1]) == null ? void 0 : _a.trim();
      if (!raw) continue;
      try {
        collectJsonImages(JSON.parse(raw), urls, base);
      } catch (e) {
      }
    }
    return urls;
  }
  function extractScriptGalleryImages(html, base) {
    var _a, _b;
    const urls = [];
    const arrayPatterns = [
      /"images"\s*:\s*\[([\s\S]*?)\]/gi,
      /"productImages"\s*:\s*\[([\s\S]*?)\]/gi,
      /"galleryImages"\s*:\s*\[([\s\S]*?)\]/gi,
      /"picList"\s*:\s*\[([\s\S]*?)\]/gi,
      /"imageList"\s*:\s*\[([\s\S]*?)\]/gi
    ];
    for (const re of arrayPatterns) {
      let match;
      while ((match = re.exec(html)) !== null) {
        const block = (_a = match[1]) != null ? _a : "";
        const urlRe = /"(https?:\/\/[^"]+\.(?:jpe?g|png|webp)[^"]*)"/gi;
        let urlMatch;
        while ((urlMatch = urlRe.exec(block)) !== null) {
          const abs = absolutize(base, (_b = urlMatch[1]) != null ? _b : "");
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
    var _a;
    const base = parsePageUrl(baseUrl);
    const galleryHtml = extractProductGalleryHtml(html);
    const candidates = [];
    const seen = /* @__PURE__ */ new Set();
    let galleryIndex = 0;
    const imgTagRe = /<img\b[^>]*>/gi;
    let imgMatch;
    while ((imgMatch = imgTagRe.exec(galleryHtml)) !== null) {
      const tag = imgMatch[0];
      const context = galleryHtml.slice(
        Math.max(0, imgMatch.index - 250),
        imgMatch.index + tag.length + 250
      );
      const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
      const alt = (altMatch == null ? void 0 : altMatch[1]) ? decodeHtmlEntities(altMatch[1]) : "";
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
        "src"
      ]) {
        const re = new RegExp(`${attr}=["']([^"']+)["']`, "i");
        const m = tag.match(re);
        if (m == null ? void 0 : m[1]) pushCandidate(candidates, seen, m[1], base, context, alt, order, attr.startsWith("data-") ? 12 : 4);
      }
      const srcsetMatch = tag.match(/srcset=["']([^"']+)["']/i);
      if (srcsetMatch == null ? void 0 : srcsetMatch[1]) {
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
        const src = (_a = tag.match(/\bsrc=["']([^"']+)["']/i)) == null ? void 0 : _a[1];
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
    const parsed = manualParseHttpUrl(urlString);
    if (!parsed) return "Maillot";
    const segment = parsed.pathname.split("/").pop() || "Maillot";
    try {
      return decodeURIComponent(segment.replace(/\.[^.]+$/, "")).replace(/[-_]+/g, " ").trim() || "Maillot";
    } catch (e) {
      return segment.replace(/[-_]+/g, " ").trim() || "Maillot";
    }
  }
  function cleanProductName(name) {
    return name.replace(/\s+/g, " ").replace(/\|.*$/, "").trim().slice(0, 120);
  }
  async function fetchPageHtml(pageUrl) {
    var _a;
    const normalized = normalizePageUrl(pageUrl);
    const res = await fetchWithRetry(normalized, {
      headers: __spreadProps(__spreadValues({}, FETCH_HEADERS), {
        Referer: getUrlOrigin(normalized)
      })
    });
    const contentType = (_a = res.headers.get("content-type")) != null ? _a : "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml") && !contentType.includes("text/plain")) {
      throw new Error("Ce lien ne pointe pas vers une page produit.");
    }
    return res.text();
  }
  async function fetchImageBytes(imageUrl, referer) {
    var _a, _b;
    const res = await fetchWithRetry(imageUrl, {
      headers: __spreadProps(__spreadValues({}, FETCH_HEADERS), {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: referer || getUrlOrigin(imageUrl)
      })
    });
    const mimeType = ((_b = (_a = res.headers.get("content-type")) == null ? void 0 : _a.split(";")[0]) == null ? void 0 : _b.trim()) || "image/jpeg";
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length) throw new Error("Image vide.");
    return { bytes, mimeType };
  }
  async function pickBestCandidateImage(candidates, pageUrl) {
    if (!candidates.length) {
      throw new Error("Aucune image trouv\xE9e sur cette page.");
    }
    const sorted = candidates.slice().sort((a, b) => {
      if (a.galleryIndex !== b.galleryIndex) return a.galleryIndex - b.galleryIndex;
      return b.score - a.score;
    });
    const errors = [];
    for (const candidate of sorted.slice(0, 8)) {
      try {
        const { bytes, mimeType } = await fetchImageBytes(candidate.url, pageUrl);
        if (bytes.length < 8e3) {
          errors.push("image trop petite");
          continue;
        }
        return { bytes, mimeType, imageUrl: candidate.url };
      } catch (err) {
        errors.push(err instanceof Error ? err.message : "erreur");
      }
    }
    throw new Error(
      `Impossible de t\xE9l\xE9charger une image (${errors.slice(0, 2).join(", ") || "\xE9chec r\xE9seau"}).`
    );
  }
  async function scrapeProductUrl(rawUrl) {
    const url = parsePageUrl(rawUrl);
    if (DIRECT_IMAGE.test(`${url.pathname}${url.search}`)) {
      const { bytes, mimeType } = await fetchImageBytes(url.toString(), url.origin + "/");
      return { name: nameFromUrl(url.toString()), bytes, mimeType };
    }
    const html = await fetchPageHtml(url.toString());
    const name = cleanProductName(extractTitle(html) || nameFromUrl(url.toString()));
    let candidates = extractImageCandidates(html, url.toString());
    if (!candidates.length) {
      for (const raw of extractAllMeta(html, "og:image")) {
        pushCandidate(candidates, /* @__PURE__ */ new Set(), raw, url, "og:image", "", 0, 5);
      }
    }
    const picked = await pickBestCandidateImage(candidates, url.toString());
    return { name, bytes: picked.bytes, mimeType: picked.mimeType };
  }

  // src/code.ts
  var STORAGE_CATEGORY = "footshop_category_id";
  var CARD_W = 328;
  var CARD_H = 411;
  var CARD_GAP = 20;
  var CARD_COLS = 3;
  var CARD_BG = { r: 238 / 255, g: 238 / 255, b: 238 / 255 };
  var HALO_BLUR = 119.1;
  async function sendInit() {
    const categoryId = await figma.clientStorage.getAsync(STORAGE_CATEGORY);
    const networkChecks = await probeNetworkAccess();
    figma.ui.postMessage({
      type: "init",
      categoryId: typeof categoryId === "string" ? categoryId : "",
      networkChecks
    });
  }
  figma.ui.onmessage = async (msg) => {
    var _a, _b, _c;
    if (msg.type === "ui-ready") {
      await sendInit();
      return;
    }
    if (msg.type === "network-test") {
      const checks = await probeNetworkAccess();
      figma.ui.postMessage({
        type: "network-test-result",
        requestId: msg.requestId,
        checks
      });
      return;
    }
    if (msg.type === "api-request") {
      const origins = uniqueOrigins(define_PLUGIN_API_ORIGINS_default, "https://foot-shop.onrender.com");
      const headers = __spreadValues({
        Authorization: `Bearer ${"mdp"}`,
        "x-admin-secret": "mdp"
      }, (_a = msg.headers) != null ? _a : {});
      if (msg.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
      let lastError = "Network error";
      for (const origin of origins) {
        const url = `${origin.replace(/\/$/, "")}${msg.path}`;
        try {
          const res = await fetch(url, {
            method: (_b = msg.method) != null ? _b : "GET",
            headers,
            body: msg.body
          });
          const body = await res.text();
          figma.ui.postMessage({
            type: "api-response",
            requestId: msg.requestId,
            ok: res.ok,
            status: res.status,
            body
          });
          return;
        } catch (err) {
          lastError = err instanceof Error && err.message ? err.message : "Network error";
        }
      }
      figma.ui.postMessage({
        type: "api-response",
        requestId: msg.requestId,
        ok: false,
        status: 0,
        body: "",
        error: lastError
      });
      return;
    }
    if (msg.type === "save-category") {
      await figma.clientStorage.setAsync(STORAGE_CATEGORY, msg.categoryId.trim());
      return;
    }
    if (msg.type === "scrape-product") {
      try {
        const result = await scrapeProductUrl(msg.url);
        figma.ui.postMessage({
          type: "scrape-done",
          requestId: msg.requestId,
          name: result.name,
          mimeType: result.mimeType,
          bytes: Array.from(result.bytes)
        });
      } catch (err) {
        figma.ui.postMessage({
          type: "scrape-error",
          requestId: msg.requestId,
          message: err instanceof Error ? err.message : "Scrape impossible."
        });
      }
      return;
    }
    if (msg.type === "export-frame") {
      try {
        const node = await figma.getNodeByIdAsync(msg.frameId);
        if (!node || !("exportAsync" in node) || typeof node.exportAsync !== "function") {
          throw new Error("Fiche Figma introuvable.");
        }
        const bytes = await node.exportAsync({
          format: "PNG",
          constraint: { type: "SCALE", value: 2 }
        });
        figma.ui.postMessage({
          type: "frame-exported",
          requestId: msg.requestId,
          bytes: Array.from(bytes)
        });
      } catch (err) {
        figma.ui.postMessage({
          type: "export-error",
          requestId: msg.requestId,
          message: err instanceof Error ? err.message : "Export impossible."
        });
      }
      return;
    }
    if (msg.type === "apply-result") {
      try {
        const { x, y } = resolveCardPosition(msg);
        const frame = buildProductCard(new Uint8Array(msg.bytes), msg.nodeName, x, y);
        figma.ui.postMessage({
          type: "card-created",
          requestId: msg.requestId,
          frameId: frame.id,
          nodeName: msg.nodeName,
          sourceUrl: (_c = msg.sourceUrl) != null ? _c : ""
        });
      } catch (err) {
        figma.ui.postMessage({
          type: "card-error",
          requestId: msg.requestId,
          message: err instanceof Error ? err.message : "Impossible de cr\xE9er la fiche."
        });
      }
      return;
    }
  };
  figma.showUI(__html__, { width: 380, height: 480 });
  function resolveCardPosition(msg) {
    var _a, _b;
    const total = Math.max(1, (_a = msg.batchTotal) != null ? _a : 1);
    const index = (_b = msg.placementIndex) != null ? _b : 0;
    const rows = Math.ceil(total / CARD_COLS);
    const cols = Math.min(total, CARD_COLS);
    const gridW = cols * CARD_W + (cols - 1) * CARD_GAP;
    const gridH = rows * CARD_H + (rows - 1) * CARD_GAP;
    const originX = figma.viewport.center.x - gridW / 2;
    const originY = figma.viewport.center.y - gridH / 2;
    const col = index % CARD_COLS;
    const row = Math.floor(index / CARD_COLS);
    return {
      x: originX + col * (CARD_W + CARD_GAP),
      y: originY + row * (CARD_H + CARD_GAP)
    };
  }
  function buildProductCard(imageBytes, name, x, y) {
    const image = figma.createImage(imageBytes);
    const imageFill = {
      type: "IMAGE",
      scaleMode: "FILL",
      imageHash: image.hash
    };
    const frame = figma.createFrame();
    frame.name = name || "Maillot";
    frame.resize(CARD_W, CARD_H);
    frame.x = x;
    frame.y = y;
    frame.fills = [{ type: "SOLID", color: CARD_BG }];
    frame.clipsContent = true;
    const halo = figma.createRectangle();
    halo.name = "Halo";
    halo.resize(CARD_W, CARD_H);
    halo.opacity = 0.37;
    halo.fills = [imageFill];
    halo.effects = [{ type: "LAYER_BLUR", radius: HALO_BLUR, visible: true }];
    const jersey = figma.createRectangle();
    jersey.name = "Maillot";
    jersey.resize(CARD_W, CARD_H);
    jersey.fills = [{ type: "IMAGE", scaleMode: "FILL", imageHash: image.hash }];
    frame.appendChild(halo);
    frame.appendChild(jersey);
    figma.currentPage.appendChild(frame);
    return frame;
  }
  function uniqueOrigins(originsJson, fallbackOrigin) {
    const origins = [];
    const add = (value) => {
      const normalized = value.replace(/\/$/, "");
      if (normalized && !origins.includes(normalized)) origins.push(normalized);
    };
    try {
      const parsed = JSON.parse(originsJson);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === "string") add(item);
        }
      }
    } catch (e) {
    }
    add("https://foot-shop.onrender.com");
    add(fallbackOrigin);
    add("https://foot-shop.fr");
    add("https://www.foot-shop.fr");
    return origins;
  }
  async function probeNetworkAccess() {
    const origins = uniqueOrigins(define_PLUGIN_API_ORIGINS_default, "https://foot-shop.onrender.com");
    const authHeaders = {
      Authorization: `Bearer ${"mdp"}`,
      "x-admin-secret": "mdp"
    };
    const checks = [];
    const tasks = [
      { label: "internet", url: "https://httpbin.org/get" }
    ];
    for (const origin of origins.slice(0, 3)) {
      tasks.push({
        label: origin.replace(/^https:\/\//, ""),
        url: `${origin.replace(/\/$/, "")}/api/admin/product-import?pluginSecret=${encodeURIComponent("mdp")}`,
        headers: authHeaders
      });
    }
    for (const task of tasks) {
      try {
        const res = await fetch(task.url, { headers: task.headers });
        checks.push({ label: task.label, ok: true, status: res.status });
      } catch (err) {
        checks.push({
          label: task.label,
          ok: false,
          status: 0,
          error: err instanceof Error ? err.message : "failed to fetch"
        });
      }
    }
    return checks;
  }
})();
