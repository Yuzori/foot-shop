function stripThumbnailTokens(u: string): string {
  return u
    .replace(/_small|_thumb|_thumbnail|_medium|_compact|_mini|_xs|_sm/gi, "_large")
    .replace(/\/thumb\//gi, "/large/")
    .replace(/\/cache\/[a-z0-9]+\//gi, "/")
    .replace(/\/cache\/\d+x\d+\//gi, "/cache/")
    .replace(/([?&])(w|width|h|height)=\d+/gi, "$1$2=3000")
    .replace(
      /([/_-])(\d{2,3})x(\d{2,3})(\.[a-z]{3,4})(\?.*)?$/i,
      (_m, sep: string, _w: string, _h: string, ext: string, qs?: string) =>
        `${sep}3000x3000${ext}${qs ?? ""}`,
    );
}

/**
 * Transforme une URL d'image produit en version haute résolution (sans miniature).
 */
export function toHighQualityImageUrl(url: string): string {
  let u = stripThumbnailTokens(url);

  if (/cdn\.shopify\.com/i.test(u)) {
    u = u.replace(/_\d+x(\.|$)/, "_3000x$1");
    if (!/[?&]width=/i.test(u)) {
      u += (u.includes("?") ? "&" : "?") + "width=3000";
    }
  }

  if (/unisportstore|ztat\.net/i.test(u)) {
    u = u
      .replace(/([?&])w=\d+/gi, "$1w=3000")
      .replace(/([?&])h=\d+/gi, "$1h=3000")
      .replace(/\/(\d{2,3})x(\d{2,3})\//gi, "/3000x3000/");
  }

  if (/bbdbuy\.com/i.test(u)) {
    u = u
      .replace(/\/cache\/\d+x\d+\//gi, "/cache/")
      .replace(/([?&])(w|width|h|height|size)=\d+/gi, "");
  }

  if (/footshop|footlocker|prod-images/i.test(u)) {
    u = u
      .replace(/([?&])w=\d+/gi, "$1w=2000")
      .replace(/([?&])h=\d+/gi, "$1h=2000")
      .replace(/\/w_\d+,h_\d+/gi, "/w_2000,h_2000");
  }

  if (/adidas|assets\.adidas/i.test(u)) {
    u = u.replace(/w_\d+,h_\d+/gi, "w_2000,h_2000");
  }

  if (/nike|images\.nike/i.test(u)) {
    u = u.replace(/t_default/gi, "t_PDP_1728");
  }

  if (/intersport|decathlon|go-sport|gosport/i.test(u)) {
    u = u
      .replace(/\/(\d{2,3})x(\d{2,3})\//gi, "/2000x2000/")
      .replace(/([?&])sw=\d+/gi, "$1sw=2000");
  }

  return u;
}

/** Génère plusieurs variantes d'URL pour contourner les miniatures CDN. */
export function buildImageUrlCandidates(url: string): string[] {
  const trimmed = url.trim();
  if (!trimmed) return [];

  const candidates: string[] = [trimmed];

  if (isLikelyThumbnailUrl(trimmed)) {
    candidates.push(toHighQualityImageUrl(trimmed), toMaximumQualityImageUrl(trimmed));
  } else {
    candidates.push(toHighQualityImageUrl(trimmed));
  }

  try {
    const parsed = new URL(trimmed);
    const pathNoQuery = `${parsed.origin}${parsed.pathname}`;
    if (pathNoQuery !== trimmed) {
      candidates.push(pathNoQuery);
      if (isLikelyThumbnailUrl(trimmed)) {
        candidates.push(
          toHighQualityImageUrl(pathNoQuery),
          toMaximumQualityImageUrl(pathNoQuery),
        );
      }
    }
  } catch {
    // ignore invalid URLs
  }

  return candidates.filter((u, i, all) => all.indexOf(u) === i);
}
/** Retire toute limite de taille dans l'URL (second essai si l'image est trop petite). */
export function toMaximumQualityImageUrl(url: string): string {
  let u = toHighQualityImageUrl(url);

  u = u
    .replace(/([?&])(w|width|h|height|size|quality|q)=\d+/gi, "")
    .replace(/[?&]$/, "")
    .replace(/\?&/, "?");

  return u;
}

/** Clé de déduplication stable — ignore query string et variantes de taille. */
export function normalizeImageDedupeKey(url: string): string {
  try {
    const u = new URL(toHighQualityImageUrl(url));
    u.search = "";
    u.hash = "";
    const path = u.pathname
      .replace(/\/cache\/\d+x\d+\//gi, "/cache/")
      .replace(/_\d+x\d+/gi, "")
      .replace(/\d{2,4}x\d{2,4}/gi, "")
      .replace(/\/(\d+)\.(jpe?g|png|webp)$/i, "/$1")
      .replace(/\.(jpe?g|png|webp)$/i, "");
    return `${u.hostname}${path}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export function isLikelyThumbnailUrl(url: string): boolean {
  return /[_\-.](thumb|thumbnail|small|mini|compact|preview)([_\-.]|$)|\/thumb\/|w_\d{2,3}\b|h_\d{2,3}\b|[?&](w|width)=\d{1,3}(?:&|$)/i.test(
    url,
  );
}
