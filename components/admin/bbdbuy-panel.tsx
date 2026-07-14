"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import type { BbdBuyOrderDraft } from "@/lib/bbdbuy/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/components/product/product-image";
import { JerseyStudioSection } from "@/components/admin/jersey-studio-section";

const SECRET_KEY = "footshop-admin-secret";

type DraftList = {
  pending: BbdBuyOrderDraft[];
  submitted: BbdBuyOrderDraft[];
  archived: BbdBuyOrderDraft[];
};

type AdminTab = "pending" | "submitted" | "archived";

type ShippingItem = {
  reference: string;
  trackingNumber: string;
  carrierUrl: string;
  customerEmail: string | null;
  sentAt: string | null;
  updatedAt: string;
};

async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

function CopyField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  if (!value.trim()) return null;

  async function handleCopy() {
    await copyText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="rounded-xl border border-ink/8 bg-paper-soft/80 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink/40">
            {label}
          </p>
          {multiline ? (
            <pre className="mt-1.5 whitespace-pre-wrap font-sans text-sm text-ink/85">
              {value}
            </pre>
          ) : (
            <p className="mt-1.5 break-all text-sm font-medium text-ink/85">
              {value}
            </p>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
          {copied ? "Copié" : "Copier"}
        </Button>
      </div>
    </div>
  );
}

function DraftCard({
  draft,
  secret,
  onSubmitted,
  onArchived,
}: {
  draft: BbdBuyOrderDraft;
  secret: string;
  onSubmitted: () => void;
  onArchived: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function markSubmitted() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/supplier-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ reference: draft.reference, action: "mark_submitted" }),
      });
      if (!res.ok) throw new Error("Échec");
      onSubmitted();
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/supplier-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ reference: draft.reference, action: "archive" }),
      });
      if (!res.ok) throw new Error("Échec");
      onArchived();
    } finally {
      setBusy(false);
    }
  }

  const clientName = `${draft.customer.firstName} ${draft.customer.lastName}`.trim();
  const address = [
    draft.shipping.address1,
    draft.shipping.address2,
    `${draft.shipping.postcode} ${draft.shipping.city}`,
    draft.shipping.country,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <article className="rounded-3xl border border-ink/8 p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-ink/40">Commande</p>
          <h2 className="mt-1 font-display text-2xl font-semibold">{draft.reference}</h2>
          <p className="mt-1 text-sm text-ink/55">{formatDate(draft.createdAt)}</p>
        </div>
        <a
          href="https://www.bbdbuy.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-accent underline-offset-2 hover:underline"
        >
          Ouvrir BBDBuy
        </a>
      </div>

      <div className="mt-6 space-y-3">
        <CopyField label="Référence" value={draft.reference} />
        <CopyField label="Client" value={clientName} />
        {draft.customer.phone ? (
          <CopyField label="Téléphone" value={draft.customer.phone} />
        ) : null}
        {draft.customer.email ? (
          <CopyField label="Email" value={draft.customer.email} />
        ) : null}
        <CopyField label="Adresse de livraison" value={address} multiline />
        {draft.flocageNote ? (
          <CopyField label="Flocage" value={draft.flocageNote} multiline />
        ) : null}
      </div>

      <h3 className="mt-8 text-sm font-semibold uppercase tracking-wide text-ink/50">
        Articles
      </h3>
      <ul className="mt-4 space-y-4">
        {draft.lines.map((line, index) => (
          <li
            key={`${line.productId}-${line.variantId ?? "0"}-${index}`}
            className="rounded-2xl border border-ink/8 p-4"
          >
            <div className="flex gap-4">
              {line.imageUrl ? (
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-paper-soft">
                  <ProductImage
                    src={line.imageUrl}
                    alt={line.name}
                    sizes="96px"
                    className="object-contain p-1"
                  />
                </div>
              ) : null}
              <div className="min-w-0 flex-1 space-y-3">
                <CopyField
                  label="Produit"
                  value={`${line.name} × ${line.quantity}`}
                />
                <CopyField
                  label="Taille"
                  value={line.size ?? "À confirmer"}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>

      {draft.status === "pending" ? (
        <div className="mt-8 flex flex-wrap gap-3">
          <Button type="button" onClick={markSubmitted} disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : "Marquer comme traitée"}
          </Button>
          <Button type="button" variant="outline" onClick={archive} disabled={busy}>
            Archiver
          </Button>
        </div>
      ) : draft.status === "submitted" ? (
        <Button
          type="button"
          variant="outline"
          className="mt-8"
          onClick={archive}
          disabled={busy}
        >
          {busy ? <Spinner className="h-4 w-4" /> : "Archiver"}
        </Button>
      ) : null}
    </article>
  );
}

type ArchiveRow = {
  id: string;
  reference: string;
  createdAt: string;
  paidAt: string | null;
  status: string;
  email: string;
  total: number;
  lineCount: number;
};

function OrderArchiveSection({ secret }: { secret: string }) {
  const [records, setRecords] = useState<ArchiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/order-archive?limit=100", {
        headers: { Authorization: `Bearer ${secret}` },
      });
      const data = (await res.json()) as { records?: ArchiveRow[]; message?: string };
      if (!res.ok) throw new Error(data.message ?? "Chargement impossible.");
      setRecords(data.records ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [secret]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="mt-16 rounded-3xl border border-ink/8 bg-paper-soft/40 p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Historique des commandes</h2>
          <p className="mt-1 text-sm text-ink/55">
            Sauvegarde sécurisée de toutes les commandes (y compris tests) — accessible admin uniquement.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          Actualiser
        </Button>
      </div>

      {loading ? (
        <div className="mt-6 flex justify-center py-8">
          <Spinner className="h-6 w-6" />
        </div>
      ) : error ? (
        <p className="mt-4 text-sm text-accent">{error}</p>
      ) : records.length === 0 ? (
        <p className="mt-4 text-sm text-ink/50">Aucune commande archivée pour le moment.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-ink/8">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-ink/[0.03] text-xs uppercase tracking-wide text-ink/45">
              <tr>
                <th className="px-4 py-3">Référence</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Lignes</th>
              </tr>
            </thead>
            <tbody>
              {records.map((row) => (
                <tr key={row.id} className="border-t border-ink/6">
                  <td className="px-4 py-3 font-medium">{row.reference}</td>
                  <td className="px-4 py-3 text-ink/65">{row.email}</td>
                  <td className="px-4 py-3 text-ink/55">{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-3 capitalize text-ink/55">{row.status}</td>
                  <td className="px-4 py-3 tabular-nums">{row.total.toFixed(2)} €</td>
                  <td className="px-4 py-3">{row.lineCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ShippingForm({ secret }: { secret: string }) {
  const [reference, setReference] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrierUrl, setCarrierUrl] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [items, setItems] = useState<ShippingItem[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/shipping", {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { items: ShippingItem[] };
      setItems(data.items ?? []);
    }
  }, [secret]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(sendEmail: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 45_000);

      const res = await fetch("/api/admin/shipping", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          reference,
          trackingNumber,
          carrierUrl,
          customerEmail: customerEmail || undefined,
          action: sendEmail ? "send" : undefined,
        }),
      });
      window.clearTimeout(timeout);

      const data = (await res.json().catch(() => null)) as {
        message?: string;
        emailSent?: boolean;
        emailError?: string | null;
      } | null;
      if (!res.ok) throw new Error(data?.message ?? "Échec");

      if (sendEmail && data?.emailSent === false) {
        setMessage(
          `Suivi enregistré pour ${reference.trim().toUpperCase()}, mais l'email n'a pas pu être envoyé : ${data.emailError ?? "erreur SMTP"}. Vérifiez SMTP_* sur Render (port 587 souvent).`,
        );
      } else {
        setMessage(
          sendEmail
            ? `Email d'expédition envoyé pour ${reference.trim().toUpperCase()}.`
            : `Suivi enregistré pour ${reference.trim().toUpperCase()}.`,
        );
      }
      if (!sendEmail) {
        setReference("");
        setTrackingNumber("");
        setCarrierUrl("");
        setCustomerEmail("");
      }
      await load();
    } catch (err) {
      const msg =
        err instanceof Error && err.name === "AbortError"
          ? "Délai dépassé — le suivi est peut-être enregistré, rechargez la page."
          : err instanceof Error
            ? err.message
            : "Échec";
      setMessage(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-16 rounded-3xl border border-ink/8 p-6 lg:p-8">
      <h2 className="font-display text-xl font-semibold">Expédition & suivi</h2>
      <p className="mt-2 text-sm text-ink/55">
        Saisissez le numéro de suivi et le lien transporteur, puis envoyez l&apos;email au client.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field
          label="Référence commande"
          name="shipRef"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Ex. QZYXJKEOE"
        />
        <Field
          label="Email client (optionnel)"
          name="shipEmail"
          type="email"
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
          placeholder="Auto si vide"
        />
        <Field
          label="Numéro de suivi"
          name="tracking"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
        />
        <Field
          label="Lien transporteur"
          name="carrier"
          value={carrierUrl}
          onChange={(e) => setCarrierUrl(e.target.value)}
          placeholder="https://..."
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={busy || !reference.trim()}
          onClick={() => save(false)}
        >
          Enregistrer
        </Button>
        <Button
          type="button"
          disabled={busy || !reference.trim() || !trackingNumber.trim() || !carrierUrl.trim()}
          onClick={() => save(true)}
        >
          {busy ? <Spinner className="h-4 w-4" /> : "Enregistrer et envoyer l'email"}
        </Button>
      </div>

      {message ? (
        <p className="mt-4 text-sm text-ink/65">{message}</p>
      ) : null}

      {items.length > 0 ? (
        <ul className="mt-8 space-y-2 border-t border-ink/8 pt-6 text-sm text-ink/60">
          {items.slice(0, 8).map((item) => (
            <li key={item.reference}>
              <strong>{item.reference}</strong> — {item.trackingNumber || "sans suivi"}
              {item.sentAt ? " · email envoyé" : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function BbdBuyPanel() {
  const [secret, setSecret] = useState("");
  const [inputSecret, setInputSecret] = useState("");
  const [data, setData] = useState<DraftList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [tab, setTab] = useState<AdminTab>("pending");

  const load = useCallback(async (token: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/supplier-orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        setError("Mot de passe incorrect.");
        setData(null);
        return false;
      }
      if (!res.ok) throw new Error("Impossible de charger les commandes.");
      setData((await res.json()) as DraftList);
      return true;
    } catch {
      setError("Impossible de charger les commandes.");
      setData(null);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(SECRET_KEY);
    if (!saved) return;

    void (async () => {
      const ok = await load(saved);
      if (ok) {
        setSecret(saved);
      } else {
        sessionStorage.removeItem(SECRET_KEY);
        setSecret("");
        setLoginError("Mot de passe incorrect.");
      }
    })();
  }, [load]);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputSecret.trim();
    if (!trimmed) return;

    setUnlocking(true);
    setLoginError(null);
    const ok = await load(trimmed);
    setUnlocking(false);

    if (!ok) {
      sessionStorage.removeItem(SECRET_KEY);
      setSecret("");
      setLoginError("Mot de passe incorrect.");
      return;
    }

    sessionStorage.setItem(SECRET_KEY, trimmed);
    setSecret(trimmed);
    setInputSecret("");
  }

  function logout() {
    sessionStorage.removeItem(SECRET_KEY);
    setSecret("");
    setData(null);
    setInputSecret("");
    setLoginError(null);
    setError(null);
  }

  const tabDrafts =
    tab === "pending"
      ? data?.pending ?? []
      : tab === "submitted"
        ? data?.submitted ?? []
        : data?.archived ?? [];

  if (!secret) {
    return (
      <Container className="py-16 lg:py-24">
        <div className="mx-auto max-w-md">
          <h1 className="display-2 text-center">Administration</h1>
          <form onSubmit={unlock} className="mt-10 space-y-4">
            <Field
              label="Secret admin"
              name="secret"
              type="password"
              value={inputSecret}
              onChange={(e) => {
                setInputSecret(e.target.value);
                setLoginError(null);
              }}
              autoComplete="current-password"
              required
            />
            {loginError ? (
              <p className="text-center text-sm text-accent">{loginError}</p>
            ) : null}
            <Button type="submit" size="lg" className="w-full" disabled={unlocking}>
              {unlocking ? <Spinner className="h-4 w-4" /> : "Accéder"}
            </Button>
          </form>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-16 lg:py-24">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="display-2">Administration</h1>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => load(secret)}>
              Actualiser
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={logout}>
              Déconnexion
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="mt-12 flex justify-center">
            <Spinner className="h-6 w-6" />
          </div>
        ) : null}

        {error ? (
          <p className="mt-8 rounded-xl bg-paper-soft px-4 py-3 text-center text-sm text-ink/60">
            {error}
          </p>
        ) : null}

        <div className="mt-10 flex gap-2 border-b border-ink/8">
          {(
            [
              ["pending", "En attente", data?.pending.length],
              ["submitted", "Traitées", data?.submitted.length],
              ["archived", "Archivées", data?.archived.length],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                tab === key
                  ? "border-accent text-ink"
                  : "border-transparent text-ink/45 hover:text-ink",
              )}
            >
              {label}
              {typeof count === "number" ? ` (${count})` : ""}
            </button>
          ))}
        </div>

        {!loading && tabDrafts.length === 0 ? (
          <p className="mt-12 text-center text-sm text-ink/50">
            {tab === "pending"
              ? "Aucune commande en attente."
              : tab === "submitted"
                ? "Aucune commande traitée."
                : "Aucune commande archivée."}
          </p>
        ) : null}

        <div className="mt-10 space-y-8">
          {tabDrafts.map((draft) => (
            <DraftCard
              key={draft.reference}
              draft={draft}
              secret={secret}
              onSubmitted={() => load(secret)}
              onArchived={() => load(secret)}
            />
          ))}
        </div>

        <OrderArchiveSection secret={secret} />
        <ShippingForm secret={secret} />
        <JerseyStudioSection secret={secret} />
      </div>
    </Container>
  );
}
