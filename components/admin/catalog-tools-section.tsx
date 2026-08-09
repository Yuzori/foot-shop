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

/** Outils catalogue — synchronisation PrestaShop via l'API Foot Shop. */
export function CatalogToolsSection({ secret }: CatalogToolsSectionProps) {
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      while (hasMore && page <= 100) {
        setProgress(`Page ${page} en cours…`);

        const res = await fetch("/api/admin/ensure-xxl", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify({ page, pageSize: 25 }),
        });

        const data = (await res.json()) as SyncResult & {
          hasMore?: boolean;
          processed?: number;
        };

        if (!res.ok) {
          throw new Error(data.message ?? "Synchronisation échouée.");
        }

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
            : "Aucune déclinaison XXL à créer — le catalogue est déjà à jour.",
        ...totals,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setPending(false);
      setProgress(null);
    }
  }

  return (
    <section className="mt-16 rounded-2xl border border-ink/10 bg-paper-soft/50 p-6 sm:p-8">
      <h2 className="text-lg font-bold uppercase tracking-wide text-ink">
        Catalogue PrestaShop
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink/55">
        Gère le catalogue depuis Foot Shop — pas besoin du back office PrestaShop.
        Le site lit les produits via l&apos;API ; le BO PrestaShop peut être
        incomplet ou en retard sans impact sur foot-shop.fr.
      </p>

      <div className="mt-6 rounded-xl border border-ink/8 bg-paper p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-ink">Synchroniser les tailles XXL</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink/55">
          Parcourt <strong className="font-medium text-ink/75">tout le catalogue</strong>{" "}
          page par page, vérifie les déclinaisons via l&apos;API PrestaShop, et crée
          la taille XXL manquante (stock 20). Peut prendre 1 à 2 minutes.
        </p>
        <p className="mt-2 text-xs text-ink/45">
          Si tout est déjà OK : <span className="font-medium">0 créé</span> avec
          des centaines de produits vérifiés — c&apos;est normal.
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

      <div className="mt-6 text-xs leading-relaxed text-ink/45">
        <p className="font-semibold uppercase tracking-wide text-ink/50">
          Workflow Foot Shop
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Importer des maillots → section Import rapide ci-dessous</li>
          <li>Stock et tailles → sync XXL ou import (stock 20 par défaut)</li>
          <li>Commandes fournisseur → onglets En attente / Traitées</li>
          <li>Vérifier le site → foot-shop.fr (pas le BO PrestaShop)</li>
        </ul>
      </div>
    </section>
  );
}
