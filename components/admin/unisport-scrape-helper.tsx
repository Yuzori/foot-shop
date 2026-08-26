"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  buildUnisportClipboardBookmarklet,
  isUnisportBlockedError,
  parseUnisportClipboardPayload,
  parseUnisportHtml,
} from "@/lib/product-import/parse-unisport-html";
import { isUnisportProductUrl } from "@/lib/product-import/is-unisport-url";

export function UnisportScrapeHelper({
  urls,
  onParsed,
  onClipboardImport,
}: {
  secret: string;
  urls: readonly string[];
  onParsed: (sourceUrl: string, html: string) => void;
  onClipboardImport: (payload: {
    sourceUrl: string;
    name: string;
    imageUrls: string[];
  }) => void;
}) {
  const unisportUrls = useMemo(
    () => urls.filter((url) => isUnisportProductUrl(url)),
    [urls],
  );
  const [pasteByUrl, setPasteByUrl] = useState<Record<string, string>>({});
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const bookmarkletHref = useMemo(() => buildUnisportClipboardBookmarklet(), []);

  if (!unisportUrls.length) return null;

  async function copyBookmarklet() {
    try {
      await navigator.clipboard.writeText(bookmarkletHref);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setPasteError("Impossible de copier — glissez le bouton bleu vers vos favoris.");
    }
  }

  async function importFromClipboard() {
    setPasteError(null);
    try {
      const raw = await navigator.clipboard.readText();
      const payload = parseUnisportClipboardPayload(raw);
      if (!payload) {
        setPasteError(
          "Presse-papier vide ou invalide. Utilisez le favori sur la page Unisport d'abord.",
        );
        return;
      }
      onClipboardImport({
        sourceUrl: payload.sourceUrl,
        name: payload.title,
        imageUrls: payload.imageUrls,
      });
    } catch {
      setPasteError("Accès presse-papier refusé — autorisez le collage dans le navigateur.");
    }
  }

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
          Unisport — via votre navigateur
        </h3>
        <p className="mt-1 text-xs text-ink/55">
          Le serveur est bloqué par Unisport. Utilisez le favori ci-dessous sur la
          page produit, puis importez ici.
        </p>
      </div>

      <div className="rounded-xl border border-ink/10 bg-white/80 px-3 py-3 space-y-3">
        <p className="text-xs font-medium text-ink/70">
          <strong>Étape 1 —</strong> Ajoutez le favori (ne cliquez pas le bouton ici,
          ça ne fait rien) :
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={bookmarkletHref}
            draggable
            className="inline-flex cursor-grab rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 active:cursor-grabbing"
            onClick={(e) => {
              e.preventDefault();
              setPasteError(
                "Glissez ce bouton vers la barre de favoris (Ctrl+Shift+B), ne cliquez pas ici.",
              );
            }}
          >
            ⬇ Glisser vers favoris · Collecter Unisport
          </a>
          <Button type="button" size="sm" variant="outline" onClick={() => void copyBookmarklet()}>
            {copied ? "Copié !" : "Copier le lien favori"}
          </Button>
        </div>
        <p className="text-[11px] text-ink/45">
          Glissez le bouton bleu sur la barre de favoris. Ou : clic droit sur le bouton
          → « Ajouter aux favoris ».
        </p>

        <p className="text-xs font-medium text-ink/70 pt-1">
          <strong>Étape 2 —</strong> Sur unisportstore.fr (page produit), cliquez le
          favori → alerte « Copie OK ».
        </p>

        <p className="text-xs font-medium text-ink/70">
          <strong>Étape 3 —</strong> Revenez ici et cliquez :
        </p>
        <Button type="button" size="sm" onClick={() => void importFromClipboard()}>
          Importer presse-papier
        </Button>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium text-ink/70">
          Alternative : collez le code source (Ctrl+U → tout sélectionner → copier) :
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
