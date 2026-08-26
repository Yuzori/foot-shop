import { NextResponse } from "next/server";

import {
  buildStudioProductFromUnisportClient,
} from "@/lib/jersey-studio/scrape-batch";
import { isUnisportProductUrl } from "@/lib/product-import/is-unisport-url";
import { toHighQualityImageUrl } from "@/lib/product-import/image-url-quality";
import { queueUnisportClientScrape } from "@/lib/pending-unisport-scrapes";
import { isValidUnisportCollectToken } from "@/lib/unisport-collect-token";
import { mailConfig } from "@/config/mail";

export const runtime = "nodejs";

function successHtml(title: string, detail: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Foot-Shop · Unisport</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#111}
    h1{font-size:1.25rem}
    p{color:#444;line-height:1.5}
    .ok{color:#1a7f37;font-weight:600}
    a{color:#0b5cab}
  </style>
</head>
<body>
  <p class="ok">✓ Produit envoyé</p>
  <h1>${title}</h1>
  <p>${detail}</p>
  <p>Retournez sur <a href="/admin/bbdbuy">Foot-Shop admin → Import rapide</a> : le produit apparaît en quelques secondes.</p>
</body>
</html>`;
}

function errorHtml(message: string): string {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8" /><title>Erreur</title></head>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem">
  <h1>Erreur</h1><p>${message}</p>
  <p><a href="/admin/bbdbuy">Retour admin</a></p>
</body></html>`;
}

function parseImageUrls(raw: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const part of raw.split("|")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    try {
      const clean = toHighQualityImageUrl(trimmed);
      const key = clean.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      urls.push(clean);
    } catch {
      // ignore
    }
  }
  return urls;
}

/** Réception GET du bookmarklet Unisport (navigation légère, sans gros POST). */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("t")?.trim() ?? "";
    const sourceUrl = url.searchParams.get("url")?.trim() ?? "";
    const title = url.searchParams.get("title")?.trim() ?? "";
    const imgsRaw = url.searchParams.get("imgs")?.trim() ?? "";

    if (!(await isValidUnisportCollectToken(token))) {
      return new NextResponse(errorHtml("Token invalide ou expiré. Recréez le favori depuis l'admin."), {
        status: 401,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (!sourceUrl || !isUnisportProductUrl(sourceUrl)) {
      return new NextResponse(errorHtml("URL produit Unisport invalide."), {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const imageUrls = parseImageUrls(imgsRaw);
    if (!imageUrls.length) {
      return new NextResponse(errorHtml("Aucune image transmise."), {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const adminSecret = mailConfig.adminSecret;
    if (!adminSecret) {
      return new NextResponse(errorHtml("Admin non configuré sur le serveur."), {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const product = await buildStudioProductFromUnisportClient(sourceUrl, title, imageUrls);
    await queueUnisportClientScrape(adminSecret, product);

    const safeTitle = product.name.replace(/</g, "&lt;").slice(0, 120);
    return new NextResponse(
      successHtml(safeTitle, `${product.imageUrls.length} image(s) importée(s).`),
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  } catch (err) {
    console.error("[outil/unisport]", err);
    return new NextResponse(errorHtml("Erreur serveur lors de l'import."), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
