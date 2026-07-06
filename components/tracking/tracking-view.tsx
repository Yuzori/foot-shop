"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useMyOrders, useSession } from "@/hooks/use-auth";
import { useOrderTracking } from "@/hooks/use-order-tracking";
import { getErrorMessage } from "@/lib/http";
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

type TrackedOrder = {
  reference: string;
  status: OrderStatus;
  statusLabel: string;
  total: number;
  currency: string;
  createdAt: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippingPending?: boolean;
  lines: { name: string; quantity: number; unitPrice: number }[];
};

/** Suivi de commande par référence. */
export function TrackingView() {
  const searchParams = useSearchParams();
  const initialRef = searchParams.get("ref") ?? "";
  const { data: user } = useSession();
  const { data: orders } = useMyOrders(Boolean(user));

  const [reference, setReference] = useState(initialRef);
  const [touched, setTouched] = useState(false);
  const tracking = useOrderTracking();
  const order = tracking.data as TrackedOrder | undefined;

  const latestReference = useMemo(() => orders?.[0]?.reference ?? "", [orders]);
  const orderReferences = useMemo(
    () => orders?.map((o) => o.reference) ?? [],
    [orders],
  );

  useEffect(() => {
    if (initialRef.trim()) {
      tracking.mutate(initialRef.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRef]);

  const hasTracking = Boolean(order?.trackingNumber);
  const showPreparation = order && !hasTracking;

  function handleFocusReference() {
    if (!touched && !reference.trim() && latestReference) {
      setReference(latestReference);
    }
    setTouched(true);
  }

  return (
    <Container className="py-16 lg:py-24">
      <div className="mx-auto max-w-xl">
        <h1 className="display-2 text-center">Suivi de commande</h1>
        <p className="mt-3 text-center text-sm text-ink/55">
          Saisissez la référence reçue par email pour suivre votre commande.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (reference.trim()) tracking.mutate(reference.trim());
          }}
          className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <Field
            label="Référence de commande"
            name="reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            onFocus={handleFocusReference}
            placeholder={
              latestReference ? `Ex. ${latestReference}` : "Ex. XKBKNABJK"
            }
            list={orderReferences.length > 0 ? "order-refs-list" : undefined}
            className="flex-1"
            required
          />
          {orderReferences.length > 0 ? (
            <datalist id="order-refs-list">
              {orderReferences.map((ref) => (
                <option key={ref} value={ref} />
              ))}
            </datalist>
          ) : null}
          <Button type="submit" size="lg" disabled={tracking.isPending}>
            {tracking.isPending ? <Spinner className="h-4 w-4" /> : "Suivre"}
          </Button>
        </form>

        {user && latestReference && !reference ? (
          <p className="mt-3 text-center text-xs text-ink/45">
            Cliquez dans le champ pour utiliser votre dernière commande (
            {latestReference}).
          </p>
        ) : null}

        {tracking.isError ? (
          <p className="mt-6 rounded-xl bg-paper-soft px-4 py-3 text-center text-sm text-ink/60">
            {getErrorMessage(tracking.error)}
          </p>
        ) : null}

        {order ? (
          <div className="mt-10 rounded-3xl border border-ink/8 p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-ink/40">Référence</p>
                <p className="text-lg font-semibold">{order.reference}</p>
              </div>
              <Badge tone={statusTone[order.status]}>{order.statusLabel}</Badge>
            </div>

            {showPreparation ? (
              <div className="mt-6 rounded-2xl border border-ink/8 bg-paper-soft/80 px-5 py-4">
                <p className="text-sm font-semibold text-ink">
                  Colis en cours de préparation
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink/60">
                  Numéro de suivi bientôt disponible. Vous recevrez un email
                  dès qu&apos;il sera prêt.
                </p>
              </div>
            ) : null}

            {hasTracking ? (
              <div className="mt-6 rounded-2xl border border-accent/20 bg-accent/5 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-widest text-accent">
                  Expédition
                </p>
                <p className="mt-2 text-sm text-ink/70">Numéro de suivi</p>
                <p className="mt-1 font-mono text-base font-semibold">
                  {order.trackingNumber}
                </p>
                {order.trackingUrl ? (
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink/90"
                  >
                    Cliquez ici pour suivre la livraison
                  </a>
                ) : null}
              </div>
            ) : null}

            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-ink/40">Date</dt>
                <dd>{formatDate(order.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-ink/40">Total</dt>
                <dd className="tabular-nums">
                  {formatPrice(order.total, order.currency)}
                </dd>
              </div>
            </dl>

            {order.lines.length > 0 ? (
              <ul className="mt-6 divide-y divide-ink/5 border-t border-ink/5">
                {order.lines.map((line, i) => (
                  <li key={i} className="flex justify-between py-3 text-sm">
                    <span className="text-ink/70">
                      {line.name}
                      <span className="text-ink/40"> × {line.quantity}</span>
                    </span>
                    <span className="tabular-nums">
                      {formatPrice(line.unitPrice * line.quantity, order.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </Container>
  );
}
