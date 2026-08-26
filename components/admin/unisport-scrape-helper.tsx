"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { publicConfig } from "@/config";
import {
  isUnisportBlockedError,
  parseUnisportHtml,
} from "@/lib/product-import/parse-unisport-html";
import { isUnisportProductUrl } from "@/lib/product-import/is-unisport-url";

function buildBookmarklet(siteUrl: string, secret: string): string {
  const api = `${siteUrl.replace(/\/$/, "")}/api/admin/quick-import`;
  const code = `(async()=>{try{const html=document.documentElement.outerHTML;const sourceUrl=location.href.split("#")[0];const r=await fetch(${JSON.stringify(api)},{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+${JSON.stringify(secret)}},body:JSON.stringify({action:"client_scrape",sourceUrl,html})});const d=await r.json();const p=d.products?.[0];alert(p?.name&&!p.error?"Envoye vers Foot-Shop: "+p.name:"Erreur: "+(p?.error||d.message||"inconnue"));}catch(e){alert("Erreur reseau");}})();`;
  return `javascript:${encodeURIComponent(code)}`;
}

export function UnisportScrapeHelper({
  secret,
  urls,
  onParsed,
}: {
  secret: string;
  urls: readonly string[];
  onParsed: (sourceUrl: string, html: string) => void;
}) {
  const unisportUrls = useMemo(
    () => urls.filter((url) => isUnisportProductUrl(url)),
    [urls],
  );
  const [pasteByUrl, setPasteByUrl] = useState<Record<string, string>>({});
  const [pasteError, setPasteError] = useState<string | null>(null);

  const bookmarkletHref = useMemo(
    () => (secret ? buildBookmarklet(publicConfig.siteUrl, secret) : ""),
    [secret],
  );

  if (!unisportUrls.length) return null;

  function parsePastedHtml(sourceUrl: string) {
    const html = pasteByUrl[sourceUrl]?.trim() ?? "";
    if (html.length < 200) {
      setPasteError("Collez le code source complet de la page (Ctrl+U).");
      return;
    }
    const parsed = parseUnisportHtml(html, sourceUrl);
    if (!parsed.imageUrls.length) {
      setPasteError("Aucune image trouvée dans le HTML collé.");
      return;
    }
    setPasteError(null);
    onParsed(sourceUrl, html);
  }

  return (
    <div className="mt-4 space-y-4 rounded-2xl border border-sky-500/30 bg-sky-500/[0.06] p-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">
          Unisport — scrape via votre navigateur
        </h3>
        <p className="mt-1 text-xs text-ink/55">
          Unisport bloque le serveur Foot-Shop (erreur 405). Ouvrez chaque lien
          produit dans votre navigateur, puis utilisez le bookmarklet ou collez
          le code source de la page.
        </p>
      </div>

      {bookmarkletHref ? (
        <div className="rounded-xl border border-ink/10 bg-white/80 px-3 py-3">
          <p className="text-xs font-medium text-ink/70">
            1. Glissez ce bouton dans vos favoris :
          </p>
          <a
            href={bookmarkletHref}
            className="mt-2 inline-flex rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700"
            onClick={(e) => e.preventDefault()}
          >
            Foot-Shop · Collecter Unisport
          </a>
          <p className="mt-2 text-[11px] text-ink/45">
            2. Sur la page produit Unisport, cliquez le favori. Le produit
            apparaît ici automatiquement (quelques secondes).
          </p>
        </div>
      ) : null}

      <div className="space-y-3">
        <p className="text-xs font-medium text-ink/70">
          Ou collez le code source (Ctrl+U → tout sélectionner → copier) :
        </p>
        {unisportUrls.map((url) => (
          <div key={url} className="rounded-xl border border-ink/10 bg-white/70 p-3">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-xs text-accent underline-offset-2 hover:underline"
            >
              {url}
            </a>
            <textarea
              className="mt-2 w-full rounded-lg border border-ink/10 px-2 py-2 font-mono text-[11px]"
              rows={4}
              placeholder="Collez ici le code source HTML de la page produit…"
              value={pasteByUrl[url] ?? ""}
              onChange={(e) =>
                setPasteByUrl((prev) => ({ ...prev, [url]: e.target.value }))
              }
            />
            <Button
              type="button"
              size="sm"
              className="mt-2"
              variant="outline"
              onClick={() => parsePastedHtml(url)}
            >
              Analyser ce HTML
            </Button>
          </div>
        ))}
      </div>

      {pasteError ? <p className="text-xs text-accent">{pasteError}</p> : null}
    </div>
  );
}

export { isUnisportBlockedError, isUnisportProductUrl };
