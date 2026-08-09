"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface CatalogToolsSectionProps {
  secret: string;
}

type SyncResult = {
  message?: string;
  scanned?: number;
  created?: number;
  skipped?: number;
  errors?: number;
};

/** Outils catalogue — synchronisation PrestaShop via l'API Foot Shop. */
export function CatalogToolsSection({ secret }: CatalogToolsSectionProps) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function syncXxl() {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/ensure-xxl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ maxPages: 50 }),
      });
      const data = (await res.json()) as SyncResult & { message?: string };
      if (!res.ok) {
        throw new Error(data.message ?? "Synchronisation échouée.");
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setPending(false);
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
          Parcourt tous les maillots actifs, vérifie les déclinaisons via
          l&apos;API officielle PrestaShop, et{" "}
          <strong className="font-medium text-ink/75">
            crée la taille XXL manquante
          </strong>{" "}
          (stock 20 par défaut). Utile si un import SQL n&apos;a pas été pris en
          compte par le webservice.
        </p>
        <p className="mt-2 text-xs text-ink/45">
          Si tout est déjà OK, le résultat affichera{" "}
          <span className="font-medium">0 créé</span> — c&apos;est normal.
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
              Synchronisation…
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
              <li>Maillots avec tailles vérifiés : {result.scanned ?? 0}</li>
              <li>XXL créés : {result.created ?? 0}</li>
              <li>Sans déclinaisons (ignorés) : {result.skipped ?? 0}</li>
              <li>Erreurs : {result.errors ?? 0}</li>
            </ul>
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
