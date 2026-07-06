"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { routes } from "@/config/site";
import { useMyOrders, useSession } from "@/hooks/use-auth";
import { formatDate, formatPrice } from "@/lib/format";
import type { OrderStatus } from "@/types/domain";

const statusTone: Record<OrderStatus, "neutral" | "accent" | "dark" | "muted"> = {
  pending: "muted",
  processing: "neutral",
  shipped: "dark",
  delivered: "accent",
  cancelled: "muted",
  refunded: "muted",
  unknown: "muted",
};

export function OrdersView() {
  const { data: user, isLoading: sessionLoading } = useSession();
  const { data: orders, isLoading: ordersLoading } = useMyOrders(Boolean(user));

  if (sessionLoading) {
    return (
      <Container className="py-12">
        <h1 className="display-2 mb-10">Mes commandes</h1>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      </Container>
    );
  }

  if (!user) {
    return (
      <Container className="py-12">
        <h1 className="display-2 mb-4">Mes commandes</h1>
        <EmptyState
          title="Connectez-vous pour voir vos commandes"
          description="L'historique des commandes est lié à votre compte client. Vous pouvez aussi suivre une commande avec sa référence."
          action={{ label: "Se connecter", href: routes.login }}
        />
      </Container>
    );
  }

  return (
    <Container className="py-12">
      <h1 className="display-2 mb-10">Mes commandes</h1>

      {ordersLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : !orders || orders.length === 0 ? (
        <EmptyState
          title="Aucune commande"
          description="Vous n'avez pas encore passé de commande."
          action={{ label: "Découvrir la boutique", href: routes.catalogue }}
        />
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li
              key={order.id}
              className="rounded-2xl border border-ink/8 p-6 transition-colors hover:border-ink/20"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-ink/40">Commande</p>
                  <p className="font-semibold">{order.reference}</p>
                </div>
                <Badge tone={statusTone[order.status]}>{order.statusLabel}</Badge>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-ink/55">{formatDate(order.createdAt)}</span>
                <span className="font-medium tabular-nums">
                  {formatPrice(order.total, order.currency)}
                </span>
              </div>
              {order.lines.length > 0 ? (
                <p className="mt-3 truncate text-xs text-ink/50">
                  {order.lines.map((l) => `${l.name} ×${l.quantity}`).join(" · ")}
                </p>
              ) : null}
              <div className="mt-4">
                <Link
                  href={`${routes.tracking}?ref=${encodeURIComponent(order.reference)}`}
                  className={buttonClasses("outline", "sm")}
                >
                  Suivre cette commande
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-10 text-sm text-ink/50">
        Besoin de suivre une commande précise ?{" "}
        <Link href={routes.tracking} className="text-ink underline-offset-2 hover:underline">
          Suivi de commande
        </Link>
      </p>
    </Container>
  );
}
