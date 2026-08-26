import { NextResponse } from "next/server";

import { parseUnisportHtml } from "@/lib/product-import/parse-unisport-html";
import { queueUnisportClientScrape } from "@/lib/pending-unisport-scrapes";
import { scrapeStudioProductFromHtml } from "@/lib/jersey-studio/scrape-batch";
import { isValidUnisportCollectToken } from "@/lib/unisport-collect-token";
import { mailConfig } from "@/config/mail";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  </style>
</head>
<body>
  <p class="ok">✓ Produit envoyé</p>
  <h1>${title}</h1>
  <p>${detail}</p>
  <p>Vous pouvez fermer cet onglet et retourner sur <strong>Foot-Shop admin → Import rapide</strong>.</p>
</body>
</html>`;
}

function errorHtml(message: string): string {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8" /><title>Erreur</title></head>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem">
  <h1>Erreur</h1><p>${message}</p>
</body></html>`;
}

/** Réception formulaire bookmarklet Unisport (navigateur → Foot-Shop). */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const token = String(form.get("token") ?? "").trim();
    const sourceUrl = String(form.get("sourceUrl") ?? "").trim();
    const html = String(form.get("html") ?? "");

    if (!(await isValidUnisportCollectToken(token))) {
      return new NextResponse(errorHtml("Token invalide ou expiré. Recréez le favori depuis l'admin."), {
        status: 401,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (!sourceUrl || html.length < 200) {
      return new NextResponse(errorHtml("Page produit invalide ou vide."), {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const parsed = parseUnisportHtml(html, sourceUrl);
    if (!parsed.imageUrls.length) {
      return new NextResponse(errorHtml("Aucune image trouvée sur cette page."), {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const product = await scrapeStudioProductFromHtml(sourceUrl, html);
    if (!product.imageUrls.length) {
      return new NextResponse(errorHtml("Impossible d'extraire les images du produit."), {
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

    await queueUnisportClientScrape(adminSecret, product);

    const safeTitle = product.name.replace(/</g, "&lt;").slice(0, 120);
    return new NextResponse(
      successHtml(safeTitle, `${product.imageUrls.length} image(s) importée(s).`),
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  } catch (err) {
    console.error("[unisport-collect]", err);
    return new NextResponse(errorHtml("Erreur serveur lors de l'import."), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

/** Émet le script injecté par le bookmarklet. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim() ?? "";

  if (!(await isValidUnisportCollectToken(token))) {
    return new NextResponse("// Token invalide", {
      status: 401,
      headers: { "Content-Type": "application/javascript; charset=utf-8" },
    });
  }

  const collectUrl = `${url.origin}/api/admin/unisport-collect`;
  const js = `(function(){
  try {
    var pageUrl = location.href.split("#")[0];
    if (!/unisportstore/i.test(pageUrl)) {
      alert("Ouvrez une page produit sur unisportstore.fr");
      return;
    }
    var html = document.documentElement.outerHTML;
    var form = document.createElement("form");
    form.method = "POST";
    form.action = ${JSON.stringify(collectUrl)};
    form.target = "_blank";
    form.acceptCharset = "UTF-8";
    function field(name, value) {
      var input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    field("token", ${JSON.stringify(token)});
    field("sourceUrl", pageUrl);
    field("html", html);
    document.body.appendChild(form);
    form.submit();
  } catch (e) {
    alert("Erreur Foot-Shop : " + (e && e.message ? e.message : e));
  }
})();`;

  return new NextResponse(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
