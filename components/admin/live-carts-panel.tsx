"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { LiveActiveCart, LiveStatsResponse } from "@/lib/live-site-stats-types";
import { publicConfig } from "@/config";

const POLL_MS = 4_000;

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(publicConfig.locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

function formatPath(pathname: string): string {
  if (pathname === "/") return "Accueil";
  if (pathname.startsWith("/produit/")) return "Fiche produit";
  if (pathname.startsWith("/panier")) return "Panier";
  if (pathname.startsWith("/paiement")) return "Checkout";
  if (pathname.startsWith("/catalogue")) return "Catalogue";
  if (pathname.startsWith("/categories")) return "Catégories";
  return pathname;
}

function CartRow({ cart }: { cart: LiveActiveCart }) {
  return (
    <li className="rounded-xl border border-ink/8 bg-paper px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium text-ink">{cart.displayName}</p>
        <p className="text-xs text-ink/40">
          {formatPath(cart.pathname)} · {formatTime(cart.updatedAt)}
        </p>
      </div>
      {cart.products.length === 0 ? (
        <p className="mt-2 text-sm text-ink/50">Panier vide</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm text-ink/70">
          {cart.products.map((product, index) => (
            <li key={`${cart.sessionId}-${index}`}>
              {product.quantity}× {product.name}
              {product.optionsLabel ? ` · ${product.optionsLabel}` : ""}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function LiveCartsPanel({
  secret,
  embedded = false,
}: {
  secret: string;
  embedded?: boolean;
}) {
  const [carts, setCarts] = useState<LiveActiveCart[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setRefreshing(true);
      try {
        const res = await fetch("/api/admin/live-stats?period=day", {
          headers: { Authorization: `Bearer ${secret}` },
        });
        if (!res.ok) throw new Error("fetch_failed");
        const data = (await res.json()) as LiveStatsResponse;
        setCarts(data.live?.activeCarts ?? []);
        setUpdatedAt(data.live?.updatedAt ?? null);
        setError(null);
      } catch {
        setError("Impossible de charger les paniers.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [secret],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => void load({ silent: true }), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const content = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink/50">
          Mise à jour toutes les 4 s · visiteurs avec articles au panier
        </p>
        <div className="flex items-center gap-2">
          {updatedAt ? (
            <p className="text-xs text-ink/40">MAJ {formatTime(updatedAt)}</p>
          ) : null}
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
      </div>

      {loading && carts.length === 0 ? (
        <div className="mt-6 flex justify-center">
          <Spinner className="h-5 w-5" />
        </div>
      ) : null}

      {error && carts.length === 0 ? (
        <p className="mt-6 text-sm text-accent">{error}</p>
      ) : null}

      {!loading && carts.length === 0 ? (
        <p className="mt-6 text-sm text-ink/50">Aucun panier actif pour le moment.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {carts.map((cart) => (
            <CartRow key={cart.sessionId} cart={cart} />
          ))}
        </ul>
      )}
    </>
  );

  if (embedded) {
    return <div className="pt-4">{content}</div>;
  }

  return <section className="mt-10">{content}</section>;
}
