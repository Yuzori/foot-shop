"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { RecapPeriod, LiveStatsResponse } from "@/lib/live-site-stats-types";
import { publicConfig } from "@/config";
import { cn } from "@/lib/utils";

const POLL_MS = 4_000;

const RECAP_PERIODS: { key: RecapPeriod; label: string }[] = [
  { key: "day", label: "Jour" },
  { key: "week", label: "Semaine" },
  { key: "month", label: "Mois" },
  { key: "year", label: "Année" },
  { key: "all", label: "Total" },
];

type StatsResponse = LiveStatsResponse;

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-paper-soft/70 p-4 sm:p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-ink/45">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-ink sm:text-4xl">
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs text-ink/50">{hint}</p> : null}
    </div>
  );
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(publicConfig.locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

function formatDay(isoDay: string): string {
  const date = new Date(`${isoDay}T12:00:00`);
  return new Intl.DateTimeFormat(publicConfig.locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function LiveSiteStatsPanel({
  secret,
  embedded = false,
}: {
  secret: string;
  embedded?: boolean;
}) {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [period, setPeriod] = useState<RecapPeriod>("day");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setRefreshing(true);
      try {
        const res = await fetch(`/api/admin/live-stats?period=${period}`, {
          headers: { Authorization: `Bearer ${secret}` },
        });
        if (!res.ok) throw new Error("fetch_failed");
        setData((await res.json()) as StatsResponse);
        setError(null);
      } catch {
        setError("Impossible de charger les stats.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period, secret],
  );

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => void load({ silent: true }), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  async function handleReset() {
    if (
      !window.confirm(
        "Réinitialiser tous les compteurs visiteurs (en direct et historique) ?",
      )
    ) {
      return;
    }

    setResetting(true);
    try {
      const res = await fetch("/api/admin/live-stats", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "reset" }),
      });
      if (!res.ok) throw new Error("reset_failed");
      await load({ silent: true });
    } catch {
      setError("Impossible de réinitialiser les compteurs.");
    } finally {
      setResetting(false);
    }
  }

  const live = data?.live;
  const recap = data?.recap;

  const content = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {!embedded ? (
            <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-ink">
              Boutique en direct
            </h2>
          ) : null}
          <p className={cn("text-sm text-ink/50", !embedded && "mt-1")}>
            Mise à jour automatique toutes les 4 s · visiteurs actifs sur les
            45 dernières secondes
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {live ? (
            <p className="text-xs text-ink/40">MAJ {formatTime(live.updatedAt)}</p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={refreshing || resetting}
            onClick={() => void load()}
          >
            {refreshing ? <Spinner className="h-3.5 w-3.5" /> : null}
            Actualiser
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={refreshing || resetting}
            onClick={() => void handleReset()}
            className="text-accent hover:bg-accent/10"
          >
            {resetting ? <Spinner className="h-3.5 w-3.5" /> : null}
            Réinitialiser
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <div className="mt-6 flex justify-center">
          <Spinner className="h-5 w-5" />
        </div>
      ) : null}

      {error && !data ? (
        <p className="mt-6 text-center text-sm text-accent">{error}</p>
      ) : null}

      {live ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Visiteurs en ligne"
            value={live.activeVisitors}
            hint="Onglets actifs sur le site"
          />
          <StatCard
            label="Paniers avec articles"
            value={live.cartsWithItems}
            hint="Visiteurs ayant ajouté au moins 1 article"
          />
          <StatCard
            label="Articles en panier"
            value={live.totalCartItems}
            hint={`${live.totalCartLines} ligne${live.totalCartLines > 1 ? "s" : ""} distincte${live.totalCartLines > 1 ? "s" : ""}`}
          />
        </div>
      ) : null}

      <div className="mt-10 border-t border-ink/8 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold uppercase tracking-wide text-ink">
              Récapitulatif
            </h3>
            {recap ? (
              <p className="mt-1 text-sm text-ink/50">
                {recap.period === "all"
                  ? `Depuis le ${formatDay(recap.from)}`
                  : recap.from === recap.to
                    ? formatDay(recap.from)
                    : `Du ${formatDay(recap.from)} au ${formatDay(recap.to)}`}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-b border-ink/8">
          {RECAP_PERIODS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={cn(
                "border-b-2 px-3 py-2 text-sm font-medium transition-colors sm:px-4",
                period === key
                  ? "border-accent text-ink"
                  : "border-transparent text-ink/45 hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {recap ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Visiteurs uniques"
              value={recap.uniqueVisitors}
              hint="Sessions distinctes sur la période"
            />
            <StatCard
              label="Ont mis au panier"
              value={recap.visitorsWithCart}
              hint="Au moins un article ajouté"
            />
            <StatCard
              label="Articles en panier"
              value={recap.totalCartItems}
              hint="Max cumulé par visiteur"
            />
            <StatCard
              label="Lignes panier"
              value={recap.totalCartLines}
              hint="Références distinctes max"
            />
          </div>
        ) : null}
      </div>
    </>
  );

  if (embedded) {
    return <div className="pt-4">{content}</div>;
  }

  return (
    <section className="mt-10 rounded-2xl border border-ink/10 bg-paper p-5 sm:p-6">
      {content}
    </section>
  );
}
