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
  processed?: number;
  withVariants?: number;
  alreadyHasXxl?: number;
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
      Pick<
        SyncResult,
        "processed" | "withVariants" | "alreadyHasXxl" | "created" | "skipped" | "errors"
      >
    > & { errorDetails: ErrorDetail[]; pages: number } = {
      processed: 0,
      withVariants: 0,
      alreadyHasXxl: 0,
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
        setProgress(`Produits ${totals.processed} → ${totals.processed + 25} (page ${page})…`);

        const data = await adminPost<
          SyncResult & { hasMore?: boolean; processed?: number }
        >(secret, "/api/admin/ensure-xxl", { page, pageSize: 25 });

        if (!data.processed) break;

        totals.pages++;
        totals.processed += data.processed ?? 0;
        totals.withVariants += data.withVariants ?? 0;
        totals.alreadyHasXxl += data.alreadyHasXxl ?? 0;
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
            ? `${totals.created} XXL ajouté(s) sur ${totals.withVariants} maillots (${totals.processed} produits actifs parcourus).`
            : totals.withVariants > 0
              ? `${totals.withVariants} maillots vérifiés sur ${totals.processed} produits actifs — tous avaient déjà le XXL côté API.`
              : `${totals.processed} produits parcourus, aucun avec déclinaisons taille.`,
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
        prev ? { ...prev, candidates: [], message: "Recréation terminée." } : prev,
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
        Objectif : parcourir <strong className="font-medium text-ink/75">tous les produits actifs</strong>{" "}
        (~275 maillots) et ajouter la taille <strong className="font-medium text-ink/75">XXL</strong>{" "}
        là où elle manque encore côté API PrestaShop (stock 20).
      </p>

      <div className="mt-6 rounded-xl border border-ink/8 bg-paper p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-ink">Ajouter XXL à tout le catalogue</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink/55">
          Parcourt chaque produit actif PrestaShop. Si le maillot a déjà S/M/L/XL
          mais pas XXL → crée la déclinaison. Si le XXL est déjà là (ex. après
          un import SQL) → compté comme « déjà OK », rien n&apos;est recréé.
        </p>
        <p className="mt-2 text-xs text-ink/45">
          Attendu après un passage complet : ~275 produits parcourus, ~250+ maillots
          avec tailles, 0 créé si tout est déjà en place.
        </p>

        <Button
          type="button"
          className="mt-4"
          disabled={pending}
          onClick={() => void syncXxl()}
        >
          {pending ? (
            <span className="flex items-center gap-2">
              <Spinner className="h-4 w-4" />
              {progress ?? "Synchronisation…"}
            </span>
          ) : (
            "Parcourir tout le catalogue et ajouter XXL"
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
              <li>Produits actifs parcourus : {result.processed ?? 0}</li>
              <li>Maillots avec tailles (S/M/L…) : {result.withVariants ?? 0}</li>
              <li>Déjà XXL (rien à faire) : {result.alreadyHasXxl ?? 0}</li>
              <li>XXL ajoutés maintenant : {result.created ?? 0}</li>
              <li>Sans déclinaisons (accessoires…) : {result.skipped ?? 0}</li>
              <li>Erreurs : {result.errors ?? 0}</li>
            </ul>

            {result.withVariants &&
            result.alreadyHasXxl === result.withVariants &&
            (result.created ?? 0) === 0 ? (
              <p className="mt-3 text-xs leading-relaxed text-ink/50">
                Tous les maillots ont le XXL côté API. Si le back office PrestaShop
                ne l&apos;affiche toujours pas, c&apos;est un problème d&apos;affichage BO
                (pas de taille manquante) — voir l&apos;option avancée ci-dessous.
              </p>
            ) : null}

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

      <details className="mt-6 rounded-xl border border-ink/8 bg-paper p-4 sm:p-5">
        <summary className="cursor-pointer text-sm font-semibold text-ink">
          Avancé — réparer l&apos;affichage du back office PrestaShop
        </summary>
        <p className="mt-3 text-sm leading-relaxed text-ink/55">
          <strong className="font-medium text-ink/75">Ce n&apos;est pas l&apos;outil XXL.</strong>{" "}
          Il recrée des copies de produits « fantômes » pour qu&apos;ils apparaissent
          dans le BO. À utiliser seulement si le XXL est déjà en API mais invisible
          dans PrestaShop.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={scanPending || reclonePending}
            onClick={() => void scanReclone()}
          >
            {scanPending ? "Scan BO…" : "Scanner les fantômes BO"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={reclonePending || scanPending || !scan?.candidates?.length}
            onClick={() => void runRecloneBatch()}
          >
            {reclonePending
              ? progress ?? "Recréation…"
              : `Recréer (${scan?.candidates?.length ?? 0})`}
          </Button>
        </div>

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-ink/55">
          <input
            type="checkbox"
            checked={deactivateSource}
            onChange={(event) => setDeactivateSource(event.target.checked)}
            className="rounded border-ink/20"
          />
          Désactiver l&apos;ancien produit après recréation
        </label>

        {scan ? (
          <div className="mt-4 rounded-lg bg-paper-soft px-4 py-3 text-xs text-ink/60">
            <p className="font-medium text-ink">{scan.message}</p>
            <ul className="mt-2 space-y-1">
              <li>Total API (tous statuts) : {scan.totalProducts ?? 0}</li>
              <li>Déjà visibles BO : {scan.boListable ?? 0}</li>
              <li>Fantômes à recréer : {scan.candidates?.length ?? 0}</li>
            </ul>
          </div>
        ) : null}

        {recloneError ? (
          <p className="mt-4 text-sm text-accent" role="alert">
            {recloneError}
          </p>
        ) : null}

        {recloneResult ? (
          <p className="mt-4 text-xs text-ink/60">{recloneResult.message}</p>
        ) : null}
      </details>
    </section>
  );
}
