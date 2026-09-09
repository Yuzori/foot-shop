"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type {
  AbandonedCheckout,
  StripeAdminOrder,
  StripeAdminOrdersResponse,
} from "@/lib/stripe-admin-types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const POLL_MS = 30_000;
const EMPTY = "n/a";

function OrderLines({ lines }: { lines: StripeAdminOrder["lines"] }) {
  if (lines.length === 0) {
    return <p className="text-sm text-ink/50">Détails produits non disponibles</p>;
  }
  return (
    <ul className="space-y-1 text-sm text-ink/70">
      {lines.map((line, index) => (
        <li key={index}>
          {line.quantity}× {line.name}
          {line.size ? ` · Taille ${line.size}` : ""}
          {line.flocage ? ` · Flocage ${line.flocage}` : ""}
        </li>
      ))}
    </ul>
  );
}

function StripeOrderCard({ order }: { order: StripeAdminOrder }) {
  return (
    <article className="rounded-2xl border border-ink/8 bg-paper px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold">{order.reference}</p>
          <p className="mt-0.5 text-xs text-ink/45">N° commande client</p>
          <p className="mt-1 text-sm text-ink/55">{formatDate(order.paidAt)}</p>
        </div>
        <p className="text-lg font-semibold tabular-nums text-ink">
          {order.amount.toFixed(2)} {order.currency}
        </p>
      </div>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ink/40">Client</dt>
          <dd className="font-medium text-ink">{order.customerName}</dd>
        </div>
        <div>
          <dt className="text-ink/40">N° client PrestaShop</dt>
          <dd className="text-ink/75">{order.customerId || EMPTY}</dd>
        </div>
        {order.orderId ? (
          <div>
            <dt className="text-ink/40">ID commande PrestaShop</dt>
            <dd className="text-ink/75">{order.orderId}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-ink/40">Email</dt>
          <dd className="break-all text-ink/75">{order.email || EMPTY}</dd>
        </div>
        <div>
          <dt className="text-ink/40">Téléphone</dt>
          <dd className="text-ink/75">{order.phone || EMPTY}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-ink/40">Adresse de livraison</dt>
          <dd className="text-ink/75">{order.shippingAddress || EMPTY}</dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-ink/6 pt-4">
        <OrderLines lines={order.lines} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={order.stripeUrl}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "inline-flex items-center rounded-full border border-ink/12 px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:border-ink/25 hover:text-ink",
          )}
        >
          Voir sur Stripe
        </a>
      </div>
    </article>
  );
}

function AbandonCard({ item }: { item: AbandonedCheckout }) {
  return (
    <li className="rounded-2xl border border-dashed border-ink/12 bg-paper-soft/50 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium text-ink">
          {item.customerName}
          <span className="ml-2 text-sm font-normal text-ink/50">{item.email}</span>
        </p>
        <p className="text-xs text-ink/45">
          {item.reference} · {formatDate(item.createdAt)}
        </p>
      </div>
      <p className="mt-2 text-sm font-medium text-accent">{item.cause}</p>
      <div className="mt-3">
        <OrderLines lines={item.lines} />
      </div>
      <p className="mt-2 text-sm tabular-nums text-ink/70">
        {item.total.toFixed(2)} {item.currency}
        {item.phone ? ` · ${item.phone}` : ""}
      </p>
    </li>
  );
}

export function StripeOrdersSection({ secret }: { secret: string }) {
  const [data, setData] = useState<StripeAdminOrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resettingAbandons, setResettingAbandons] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setRefreshing(true);
      try {
        const res = await fetch("/api/admin/stripe-orders", {
          headers: { Authorization: `Bearer ${secret}` },
        });
        if (!res.ok) throw new Error("fetch_failed");
        setData((await res.json()) as StripeAdminOrdersResponse);
        setError(null);
      } catch {
        setError("Impossible de charger les commandes Stripe.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [secret],
  );

  const resetAbandons = useCallback(async () => {
    if (
      !window.confirm(
        "Effacer tous les abandons affichés ? Les prochains abandons réapparaîtront automatiquement.",
      )
    ) {
      return;
    }

    setResettingAbandons(true);
    try {
      const res = await fetch("/api/admin/stripe-orders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "reset_abandons" }),
      });
      if (!res.ok) throw new Error("reset_failed");
      setData((await res.json()) as StripeAdminOrdersResponse);
      setError(null);
    } catch {
      setError("Impossible de réinitialiser les abandons.");
    } finally {
      setResettingAbandons(false);
    }
  }, [secret]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => void load({ silent: true }), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <div className="mt-10 space-y-10">
      <section className="rounded-3xl border border-ink/8 p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Commandes Stripe</h2>
            <p className="mt-1 text-sm text-ink/55">
              Source de vérité : paiements confirmés sur Stripe uniquement.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={refreshing}
            onClick={() => void load()}
          >
            {refreshing ? <Spinner className="h-3.5 w-3.5" /> : null}
            Actualiser
          </Button>
        </div>

        {loading && !data ? (
          <div className="mt-8 flex justify-center">
            <Spinner className="h-6 w-6" />
          </div>
        ) : null}

        {error && !data ? (
          <p className="mt-6 text-sm text-accent">{error}</p>
        ) : null}

        {data && data.orders.length === 0 ? (
          <p className="mt-6 text-sm text-ink/50">Aucune commande payée trouvée sur Stripe.</p>
        ) : null}

        <div className="mt-6 space-y-4">
          {data?.orders.map((order) => (
            <StripeOrderCard key={order.sessionId} order={order} />
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-dashed border-ink/12 bg-paper-soft/30 p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Abandons de panier</h2>
            <p className="mt-2 text-sm text-ink/55">
              Paiements non finalisés, informatif, hors commandes.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={resettingAbandons || refreshing}
            onClick={() => void resetAbandons()}
            className="text-accent hover:bg-accent/10"
          >
            {resettingAbandons ? <Spinner className="h-3.5 w-3.5" /> : null}
            Réinitialiser
          </Button>
        </div>

        {!loading && (data?.abandoned.length ?? 0) === 0 ? (
          <p className="mt-4 text-sm text-ink/50">Aucun abandon récent.</p>
        ) : (
          <ul className="mt-6 space-y-4">
            {data?.abandoned.map((item) => (
              <AbandonCard key={`${item.reference}-${item.createdAt}`} item={item} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
