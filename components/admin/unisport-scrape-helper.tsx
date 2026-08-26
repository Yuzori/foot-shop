"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  buildUnisportClipboardBookmarklet,
  buildUnisportFormBookmarklet,
  buildUnisportScriptBookmarklet,
  isUnisportBlockedError,
  parseUnisportClipboardPayload,
  parseUnisportHtml,
} from "@/lib/product-import/parse-unisport-html";
import { isUnisportProductUrl } from "@/lib/product-import/is-unisport-url";

export function UnisportScrapeHelper({
  secret,
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
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const issueToken = useCallback(async () => {
    if (!secret) return;
    setTokenLoading(true);
    setTokenError(null);
    try {
      const res = await fetch("/api/admin/unisport-collect-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (!res.ok) {
        setTokenError("Impossible de générer le favori — reconnectez-vous à l'admin.");
        return;
      }
      const data = (await res.json()) as { token?: string };
      if (!data.token) {
        setTokenError("Réponse serveur invalide.");
        return;
      }
      setToken(data.token);
    } catch {
      setTokenError("Erreur réseau lors de la génération du favori.");
    } finally {
      setTokenLoading(false);
    }
  }, [secret]);

  useEffect(() => {
    if (!secret || !unisportUrls.length) return;
    void issueToken();
  }, [secret, unisportUrls.length, issueToken]);

  const bookmarkletHref = useMemo(() => {
    if (!token || !origin) return null;
    return buildUnisportFormBookmarklet(origin, token);
  }, [origin, token]);

  const scriptBookmarkletHref = useMemo(() => {
    if (!token || !origin) return null;
    return buildUnisportScriptBookmarklet(origin, token);
  }, [origin, token]);

  const clipboardBookmarkletHref = useMemo(() => buildUnisportClipboardBookmarklet(), []);

  if (!unisportUrls.length) return null;

  async function copyBookmarklet(href: string | null) {
    if (!href) return;
    try {
      await navigator.clipboard.writeText(href);
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
          Le serveur est bloqué par Unisport. Installez le favori ci-dessous, cliquez-le
          sur la page produit : le produit apparaît ici automatiquement.
        </p>
      </div>

      <div className="rounded-xl border border-ink/10 bg-white/80 px-3 py-3 space-y-3">
        <p className="text-xs font-medium text-ink/70">
          <strong>Étape 1 —</strong> Ajoutez le favori à la barre de favoris{" "}
          <span className="text-ink/45">(glisser-déposer, ne pas cliquer ici)</span> :
        </p>

        {tokenLoading ? (
          <p className="text-xs text-ink/50">Génération du favori…</p>
        ) : tokenError ? (
          <div className="space-y-2">
            <p className="text-xs text-accent">{tokenError}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void issueToken()}>
              Réessayer
            </Button>
          </div>
        ) : bookmarkletHref ? (
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
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void copyBookmarklet(bookmarkletHref)}
            >
              {copied ? "Copié !" : "Copier le lien favori"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => void issueToken()}>
              Régénérer
            </Button>
          </div>
        ) : null}

        <p className="text-[11px] text-ink/45">
          Chrome / Edge : affichez la barre de favoris (Ctrl+Shift+B), puis glissez le
          bouton bleu dessus. Ou clic droit → « Ajouter aux favoris ».
        </p>

        <p className="text-xs font-medium text-ink/70 pt-1">
          <strong>Étape 2 —</strong> Ouvrez la page produit sur unisportstore.fr et
          cliquez le favori. Un onglet Foot-Shop confirme l&apos;envoi.
        </p>

        <p className="text-xs font-medium text-ink/70">
          <strong>Étape 3 —</strong> Revenez ici : le produit s&apos;importe tout seul
          (quelques secondes).
        </p>
      </div>

      <details className="rounded-xl border border-ink/10 bg-white/60 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-ink/60">
          Si le favori ne fait rien (secours)
        </summary>
        <div className="mt-3 space-y-2 text-xs text-ink/55">
          <p>
            Essayez la variante script (même installation par glisser-déposer) :
          </p>
          {scriptBookmarkletHref ? (
            <a
              href={scriptBookmarkletHref}
              draggable
              className="inline-flex cursor-grab rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper-soft"
              onClick={(e) => e.preventDefault()}
            >
              Variante script · Collecter Unisport
            </a>
          ) : null}
          <p className="pt-1">Ou presse-papier :</p>
          <a
            href={clipboardBookmarkletHref}
            draggable
            className="inline-flex cursor-grab rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper-soft"
            onClick={(e) => e.preventDefault()}
          >
            Variante presse-papier
          </a>
          <Button type="button" size="sm" variant="outline" onClick={() => void importFromClipboard()}>
            Importer presse-papier
          </Button>
        </div>
      </details>

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
