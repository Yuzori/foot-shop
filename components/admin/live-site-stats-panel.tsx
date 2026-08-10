"use client";

import { useCallback, useEffect, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import type { LiveSiteStats } from "@/lib/live-site-stats";
import { publicConfig } from "@/config";

const POLL_MS = 15_000;

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

export function LiveSiteStatsPanel({ secret }: { secret: string }) {
  const [stats, setStats] = useState<LiveSiteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/live-stats", {
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (!res.ok) throw new Error("fetch_failed");
      setStats((await res.json()) as LiveSiteStats);
      setError(null);
    } catch {
      setError("Impossible de charger les stats en direct.");
    } finally {
      setLoading(false);
    }
  }, [secret]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <section className="mt-10 rounded-2xl border border-ink/10 bg-paper p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-ink">
            Boutique en direct
          </h2>
          <p className="mt-1 text-sm text-ink/50">
            Visiteurs et paniers des 90 dernières secondes
          </p>
        </div>
        {stats ? (
          <p className="text-xs text-ink/40">
            MAJ{" "}
            {new Intl.DateTimeFormat(publicConfig.locale, {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }).format(new Date(stats.updatedAt))}
          </p>
        ) : null}
      </div>

      {loading && !stats ? (
        <div className="mt-6 flex justify-center">
          <Spinner className="h-5 w-5" />
        </div>
      ) : null}

      {error && !stats ? (
        <p className="mt-6 text-center text-sm text-accent">{error}</p>
      ) : null}

      {stats ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Visiteurs en ligne"
            value={stats.activeVisitors}
            hint="Onglets actifs sur le site"
          />
          <StatCard
            label="Paniers avec articles"
            value={stats.cartsWithItems}
            hint="Visiteurs ayant ajouté au moins 1 article"
          />
          <StatCard
            label="Articles en panier"
            value={stats.totalCartItems}
            hint={`${stats.totalCartLines} ligne${stats.totalCartLines > 1 ? "s" : ""} distincte${stats.totalCartLines > 1 ? "s" : ""}`}
          />
        </div>
      ) : null}
    </section>
  );
}
