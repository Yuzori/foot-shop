"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface CatalogToolsSectionProps {
  secret: string;
}

type ErrorDetail = { productId: string; name: string; error: string };

type SyncResult = {
  message?: string | null;
  scanned?: number;
  created?: number;
  skipped?: number;
  errors?: number;
  pages?: number;
  errorDetails?: ErrorDetail[];
};

type RecloneScan = {
  message?: string;
  totalProducts?: number;
  boListable?: number;
  candidates?: { id: string; name: string; price: number; imageCount: number }[];
  boNameKeys?: string[];
};

type RecloneRun = {
  message?: string;
  cloned?: number;
  failed?: number;
  errors?: { sourceId: string; name: string; error: string }[];
};

async function adminPost<T>(
  secret: string,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { message?: string };
  if (!res.ok) {
    throw new Error(data.message ?? "Requête échouée.");
  }
  return data;
}

/** Outils catalogue — synchronisation PrestaShop via l'API Foot Shop. */
export function CatalogToolsSection({ secret }: CatalogToolsSectionProps) {
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [scanPending, setScanPending] = useState(false);
  const [reclonePending, setReclonePending] = useState(false);
  const [scan, setScan] = useState<RecloneScan | null>(null);
  const [recloneResult, setRecloneResult] = useState<RecloneRun | null>(null);
  const [recloneError, setRecloneError] = useState<string | null>(null);
  const [deactivateSource, setDeactivateSource] = useState(false);

  async function syncXxl() {
    setPending(true);
    setError(null);
    setResult(null);
    setProgress("Démarrage…");

    const totals: Required<
      Pick<SyncResult, "scanned" | "created" | "skipped" | "errors">
    > & { errorDetails: ErrorDetail[]; pages: number } = {
      scanned: 0,
      created: 0,
      skipped: 0,
      errors: 0,
      pages: 0,
      errorDetails: [],
    };

    try {
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 200) {
        setProgress(`Page ${page}…`);

        const data = await adminPost<SyncResult & { hasMore?: boolean; processed?: number }>(
          secret,
          "/api/admin/ensure-xxl",
          { page, pageSize: 25 },
        );

        if (!data.processed) break;

        totals.pages++;
        totals.scanned += data.scanned ?? 0;
        totals.created += data.created ?? 0;
        totals.skipped += data.skipped ?? 0;
        totals.errors += data.errors ?? 0;
        totals.errorDetails.push(...(data.errorDetails ?? []));

        hasMore = Boolean(data.hasMore);
        page++;
      }

      setResult({
        message:
          totals.created > 0
            ? `${totals.created} déclinaison(s) XXL créée(s) sur ${totals.pages} page(s).`
            : "Aucune déclinaison XXL à créer — le catalogue est déjà à jour côté API.",
        ...totals,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setPending(false);
      setProgress(null);
    }
  }

  async function scanReclone() {
    setScanPending(true);
    setRecloneError(null);
    setRecloneResult(null);
    try {
      const data = await adminPost<RecloneScan>(secret, "/api/admin/reclone-products", {
        action: "scan",
      });
      setScan(data);
    } catch (err) {
      setRecloneError(err instanceof Error ? err.message : "Erreur scan.");
    } finally {
      setScanPending(false);
    }
  }

  async function runRecloneBatch() {
    const candidates = scan?.candidates ?? [];
    if (!candidates.length) return;

    setReclonePending(true);
    setRecloneError(null);

    const totals = { cloned: 0, failed: 0, errors: [] as RecloneRun["errors"] };
    const remaining = [...candidates];
    const boNameKeys = scan?.boNameKeys ?? [];

    try {
      while (remaining.length > 0) {
        const batch = remaining.splice(0, 5).map((item) => item.id);
        setProgress(`Recréation ${totals.cloned + 1}–${totals.cloned + batch.length}…`);

        const data = await adminPost<RecloneRun>(secret, "/api/admin/reclone-products", {
          action: "run",
          productIds: batch,
          deactivateSource,
          boNameKeys,
        });

        totals.cloned += data.cloned ?? 0;
        totals.failed += data.failed ?? 0;
        totals.errors?.push(...(data.errors ?? []));
      }

      setRecloneResult({
        message: `${totals.cloned} produit(s) recréé(s) dans le BO PrestaShop.`,
        ...totals,
      });
      setScan((prev) =>
        prev
          ? {
              ...prev,
              candidates: [],
              message: "Recréation terminée.",
            }
          : prev,
      );
    } catch (err) {
      setRecloneError(err instanceof Error ? err.message : "Erreur recréation.");
    } finally {
      setReclonePending(false);
      setProgress(null);
    }
  }

  return (
    <section className="mt-16 rounded-2xl border border-ink/10 bg-paper-soft/50 p-6 sm:p-8">
      <h2 className="text-lg font-bold uppercase tracking-wide text-ink">
        Catalogue PrestaShop
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink/55">
        Foot Shop et le BO PrestaShop ne voient pas toujours les mêmes produits.
        Les imports SQL mettent à jour la base, mais le BO n&apos;affiche souvent
        que les produits créés via l&apos;API webservice (~200 « vrais » produits).
        Le site peut afficher 500+ « fantômes » avec XXL en BDD.
      </p>

      <div className="mt-6 rounded-xl border border-ink/8 bg-paper p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-ink">
          Recréer les produits pour le BO (recommandé)
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-ink/55">
          Recrée via l&apos;API PrestaShop une copie propre de chaque maillot
          fantôme : images, stock 20, tailles S→XXL. Les anciens restent sur le
          site tant que tu ne les désactives pas.
        </p>
        <ol className="mt-3 list-inside list-decimal space-y-1 text-xs text-ink/50">
          <li>Scanner → voir combien de produits sont absents du BO</li>
          <li>Recréer par lots (5 à la fois, ~1–2 min / lot)</li>
          <li>Vérifier le BO PrestaShop + vider le cache (Performances)</li>
          <li>Optionnel : cocher « Désactiver l&apos;ancien » pour éviter les doublons site</li>
        </ol>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={scanPending || reclonePending}
            onClick={() => void scanReclone()}
          >
            {scanPending ? (
              <span className="flex items-center gap-2">
                <Spinner className="h-4 w-4" />
                Scan…
              </span>
            ) : (
              "1. Scanner le catalogue"
            )}
          </Button>

          <Button
            type="button"
            disabled={reclonePending || scanPending || !scan?.candidates?.length}
            onClick={() => void runRecloneBatch()}
          >
            {reclonePending ? (
              <span className="flex items-center gap-2">
                <Spinner className="h-4 w-4" />
                {progress ?? "Recréation…"}
              </span>
            ) : (
              `2. Recréer tout (${scan?.candidates?.length ?? 0})`
            )}
          </Button>
        </div>

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-ink/55">
          <input
            type="checkbox"
            checked={deactivateSource}
            onChange={(event) => setDeactivateSource(event.target.checked)}
            className="rounded border-ink/20"
          />
          Désactiver l&apos;ancien produit après recréation (évite les doublons sur le site)
        </label>

        {scan ? (
          <div className="mt-4 rounded-lg bg-paper-soft px-4 py-3 text-xs text-ink/60">
            <p className="font-medium text-ink">{scan.message}</p>
            <ul className="mt-2 space-y-1">
              <li>Total API : {scan.totalProducts ?? 0}</li>
              <li>Déjà visibles BO : {scan.boListable ?? 0}</li>
              <li>À recréer : {scan.candidates?.length ?? 0}</li>
            </ul>
          </div>
        ) : null}

        {recloneError ? (
          <p className="mt-4 text-sm text-accent" role="alert">
            {recloneError}
          </p>
        ) : null}

        {recloneResult ? (
          <div className="mt-4 rounded-lg bg-paper-soft px-4 py-3 text-xs text-ink/60">
            <p className="font-medium text-ink">{recloneResult.message}</p>
            <p className="mt-1">Échecs : {recloneResult.failed ?? 0}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-6 rounded-xl border border-ink/8 bg-paper p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-ink">Sync XXL rapide (produits déjà BO)</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink/55">
          Ajoute uniquement la déclinaison XXL manquante sur les produits déjà
          gérés par l&apos;API. Ne répare pas les fantômes SQL.
        </p>

        <Button
          type="button"
          className="mt-4"
          variant="outline"
          disabled={pending}
          onClick={() => void syncXxl()}
        >
          {pending ? (
            <span className="flex items-center gap-2">
              <Spinner className="h-4 w-4" />
              {progress ?? "Synchronisation…"}
            </span>
          ) : (
            "Lancer la sync XXL"
          )}
        </Button>

        {error ? (
          <p className="mt-4 text-sm text-accent" role="alert">
            {error}
          </p>
        ) : null}

        {result ? (
          <div className="mt-4 rounded-lg bg-paper-soft px-4 py-3 text-sm text-ink/75">
            <p className="font-medium text-ink">{result.message}</p>
            <ul className="mt-2 space-y-1 text-xs text-ink/60">
              <li>Pages parcourues : {result.pages ?? 0}</li>
              <li>Maillots avec tailles vérifiés : {result.scanned ?? 0}</li>
              <li>XXL créés : {result.created ?? 0}</li>
              <li>Sans déclinaisons (ignorés) : {result.skipped ?? 0}</li>
              <li>Erreurs : {result.errors ?? 0}</li>
            </ul>

            {result.errorDetails && result.errorDetails.length > 0 ? (
              <details className="mt-3 text-xs text-ink/55">
                <summary className="cursor-pointer font-medium text-ink/70">
                  Détail des erreurs ({result.errorDetails.length})
                </summary>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                  {result.errorDetails.map((item) => (
                    <li key={`${item.productId}-${item.error}`}>
                      #{item.productId} {item.name} — {item.error}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
