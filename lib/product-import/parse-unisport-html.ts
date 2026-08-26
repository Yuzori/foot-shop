import { toHighQualityImageUrl } from "@/lib/product-import/image-url-quality";

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
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
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) return decodeHtmlEntities(match[1].trim());
  }
  return null;
}

/** ID produit numérique en fin d'URL Unisport (ex. …/377529/). */
export function extractUnisportProductId(rawUrl: string): string | null {
  try {
    const path = new URL(rawUrl).pathname;
    const match = path.match(/\/(\d{4,})\/?$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Images galerie Unisport (CDN thumblr.uniid.it). */
export function extractUnisportGalleryImages(html: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  const patterns = [
    /https?:\/\/thumblr\.uniid\.it\/product\/\d+\/[a-f0-9]+\.jpg[^"'\s>]*/gi,
    /thumblr\.uniid\.it\/product\/\d+\/[a-f0-9]+\.jpg[^"'\s>]*/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      let raw = decodeHtmlEntities(match[0].trim());
      if (!raw.startsWith("http")) raw = `https://${raw}`;
      try {
        const parsed = new URL(raw);
        parsed.search = "";
        const clean = toHighQualityImageUrl(parsed.toString());
        const key = clean.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        urls.push(clean);
      } catch {
        // ignore invalid URL
      }
    }
  }

  return urls;
}

export function extractUnisportTitle(html: string): string | null {
  return (
    extractMeta(html, "og:title") ??
    extractMeta(html, "twitter:title") ??
    null
  );
}

export type ParsedUnisportHtml = {
  title: string;
  imageUrls: string[];
};

/** Extrait titre + images depuis le code source d'une page produit Unisport. */
export function parseUnisportHtml(html: string, sourceUrl: string): ParsedUnisportHtml {
  const title =
    extractUnisportTitle(html)?.trim() ||
    extractUnisportProductId(sourceUrl) ||
    "Produit Unisport";

  const imageUrls = extractUnisportGalleryImages(html);
  if (!imageUrls.length) {
    const og = extractMeta(html, "og:image");
    if (og) imageUrls.push(toHighQualityImageUrl(og));
  }

  return { title, imageUrls };
}

export type UnisportClipboardPayload = {
  v: 1;
  sourceUrl: string;
  title: string;
  imageUrls: string[];
};

export function parseUnisportClipboardPayload(
  raw: string,
): UnisportClipboardPayload | null {
  try {
    const data = JSON.parse(raw) as Partial<UnisportClipboardPayload>;
    if (data.v !== 1 || !data.sourceUrl || !data.title) return null;
    const imageUrls = Array.isArray(data.imageUrls)
      ? data.imageUrls.map((u) => String(u).trim()).filter(Boolean)
      : [];
    if (!imageUrls.length) return null;
    return {
      v: 1,
      sourceUrl: data.sourceUrl,
      title: data.title,
      imageUrls,
    };
  } catch {
    return null;
  }
}

/** Bookmarklet : envoie la page vers Foot-Shop via formulaire POST (sans fetch ni presse-papier). */
export function buildUnisportFormBookmarklet(origin: string, token: string): string {
  const collectUrl = `${origin.replace(/\/$/, "")}/api/admin/unisport-collect`;
  const code = `(function(){try{var u=location.href.split("#")[0];if(!/unisportstore/i.test(u)){alert("Ouvrez une page produit sur unisportstore.fr");return}var h=document.documentElement.outerHTML,a=${JSON.stringify(collectUrl)},t=${JSON.stringify(token)},f=document.createElement("form");f.method="POST";f.action=a;f.target="_blank";f.acceptCharset="UTF-8";function field(n,v){var i=document.createElement("input");i.type="hidden";i.name=n;i.value=v;f.appendChild(i)}field("token",t);field("sourceUrl",u);field("html",h);document.body.appendChild(f);f.submit()}catch(e){try{var fd=new FormData();fd.append("token",${JSON.stringify(token)});fd.append("sourceUrl",location.href.split("#")[0]);fd.append("html",document.documentElement.outerHTML);if(navigator.sendBeacon&&navigator.sendBeacon(${JSON.stringify(collectUrl)},fd)){alert("Envoye ! Retournez sur Foot-Shop admin.");return}}catch(e2){}alert("Erreur Foot-Shop : "+(e&&e.message?e.message:e))}})();`;
  return `javascript:${encodeURIComponent(code)}`;
}

/** Variante courte : charge le script depuis Foot-Shop (si le POST inline est bloque). */
export function buildUnisportScriptBookmarklet(origin: string, token: string): string {
  const scriptUrl = `${origin.replace(/\/$/, "")}/api/admin/unisport-collect?token=${encodeURIComponent(token)}`;
  const code = `(function(){var s=document.createElement("script");s.src=${JSON.stringify(scriptUrl)};document.head.appendChild(s);})();`;
  return `javascript:${encodeURIComponent(code)}`;
}

/** Bookmarklet presse-papier (secours si CSP bloque tout le reste). */
export function buildUnisportClipboardBookmarklet(): string {
  const code = `(function(){try{var h=document.documentElement.outerHTML,u=location.href.split("#")[0];if(!/unisportstore/i.test(u))return alert("Ouvrez une page produit Unisport");var t=(document.querySelector('meta[property="og:title"]')||{}).content||document.title;var imgs=[],seen={},re=/thumblr\\.uniid\\.it\\/product\\/\\d+\\/[a-f0-9]+\\.jpg/gi,m;while(m=re.exec(h)){var x="https://"+m[0].split("?")[0];if(!seen[x]){seen[x]=1;imgs.push(x);}}if(!imgs.length)return alert("Aucune image trouvee");var payload=JSON.stringify({v:1,sourceUrl:u,title:t,imageUrls:imgs});var done=function(){alert("Copie OK ! Retournez sur Foot-Shop admin et cliquez Importer presse-papier");};if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(payload).then(done,function(){prompt("Copiez ce texte:",payload);});else prompt("Copiez ce texte:",payload);}catch(e){alert("Erreur: "+(e&&e.message?e.message:e));}})();`;
  return `javascript:${encodeURIComponent(code)}`;
}

export function isUnisportBlockedError(message: string | null | undefined): boolean {
  if (!message) return false;
  return /405|403|accès refusé|method not allowed/i.test(message);
}
