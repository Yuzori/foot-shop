"use client";

import { useCallback, useEffect, useState } from "react";

import { StripeOrdersSection } from "@/components/admin/stripe-orders-section";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { AdminFlyer } from "@/components/admin/admin-flyer";
import { QuickImportSection } from "@/components/admin/quick-import-section";
import { LiveSiteStatsPanel } from "@/components/admin/live-site-stats-panel";
import { JerseyStudioSection } from "@/components/admin/jersey-studio-section";
import {
  ADMIN_SECRET_KEY,
  purgeVisitorFromLiveStats,
} from "@/lib/admin-session";

const SECRET_KEY = ADMIN_SECRET_KEY;

type ShippingItem = {
  reference: string;
  trackingNumber: string;
  carrierUrl: string;
  customerEmail: string | null;
  sentAt: string | null;
  updatedAt: string;
};

function AdminTempDeleteButton({
  busy,
  onClick,
  className,
}: {
  busy?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={busy}
      onClick={onClick}
      className={className}
    >
      {busy ? <Spinner className="h-3 w-3" /> : "Supprimer"}
    </Button>
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
  const [deletingRef, setDeletingRef] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/shipping", {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { items?: ShippingItem[] };
    setItems(data.items ?? []);
  }, [secret]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(sendEmail: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 25_000);
      const res = await fetch("/api/admin/shipping", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reference: reference.trim().toUpperCase(),
          trackingNumber: trackingNumber.trim(),
          carrierUrl: carrierUrl.trim(),
          customerEmail: customerEmail.trim() || undefined,
          action: sendEmail ? "send" : "save",
        }),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) throw new Error(data?.message ?? "Échec");
      setMessage(
        sendEmail
          ? `Email d'expédition envoyé pour ${reference.trim().toUpperCase()}.`
          : `Suivi enregistré pour ${reference.trim().toUpperCase()}.`,
      );
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
          ? "Délai dépassé - le suivi est peut-être enregistré, rechargez la page."
          : err instanceof Error
            ? err.message
            : "Échec";
      setMessage(msg);
    } finally {
      setBusy(false);
    }
  }

  async function removeShipping(ref: string) {
    if (!window.confirm(`Supprimer le suivi ${ref} ?`)) return;
    setDeletingRef(ref);
    try {
      const res = await fetch(
        `/api/admin/shipping?reference=${encodeURIComponent(ref)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${secret}` },
        },
      );
      if (!res.ok) throw new Error("Échec");
      await load();
    } catch {
      setMessage(`Impossible de supprimer ${ref}.`);
    } finally {
      setDeletingRef(null);
    }
  }

  return (
    <section className="mt-16 rounded-3xl border border-ink/8 p-6 lg:p-8">
      <h2 className="font-display text-xl font-semibold">Expédition & suivi</h2>
      <p className="mt-2 text-sm text-ink/55">
        Référence depuis Stripe ou le récap client. Saisissez le suivi puis envoyez l&apos;email.
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

      {message ? <p className="mt-4 text-sm text-ink/65">{message}</p> : null}

      {items.length > 0 ? (
        <ul className="mt-8 space-y-2 border-t border-ink/8 pt-6 text-sm text-ink/60">
          {items.slice(0, 8).map((item) => (
            <li key={item.reference} className="flex items-center justify-between gap-3">
              <span>
                <strong>{item.reference}</strong> - {item.trackingNumber || "sans suivi"}
                {item.sentAt ? " · email envoyé" : ""}
              </span>
              <AdminTempDeleteButton
                busy={deletingRef === item.reference}
                onClick={() => void removeShipping(item.reference)}
              />
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
  const [loginError, setLoginError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  const verifySecret = useCallback(async (token: string): Promise<boolean> => {
    const res = await fetch("/api/admin/stripe-orders?limit=1", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.status !== 401;
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(SECRET_KEY);
    if (!saved) return;

    void (async () => {
      const ok = await verifySecret(saved);
      if (ok) {
        setSecret(saved);
        void purgeVisitorFromLiveStats();
      } else {
        sessionStorage.removeItem(SECRET_KEY);
        setLoginError("Mot de passe incorrect.");
      }
    })();
  }, [verifySecret]);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputSecret.trim();
    if (!trimmed) return;

    setUnlocking(true);
    setLoginError(null);
    const ok = await verifySecret(trimmed);
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
    void purgeVisitorFromLiveStats();
  }

  function logout() {
    sessionStorage.removeItem(SECRET_KEY);
    setSecret("");
    setInputSecret("");
    setLoginError(null);
  }

  if (!secret) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-sm">
          <div className="text-center">
            <h1 className="font-display text-2xl font-semibold uppercase tracking-[0.12em] text-ink sm:text-3xl">
              Administration
            </h1>
            <p className="mt-2 text-sm text-ink/50">Accès réservé</p>
          </div>
          <form onSubmit={unlock} className="mt-8 space-y-4">
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
      </div>
    );
  }

  return (
    <Container className="py-16 lg:py-24">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="display-2">Administration</h1>
          <Button type="button" variant="ghost" size="sm" onClick={logout}>
            Déconnexion
          </Button>
        </div>

        <div className="mt-10 space-y-3">
          <AdminFlyer
            title="Récapitulatif boutique"
            subtitle="Visiteurs en direct et stats par période"
            tone="stats"
          >
            <LiveSiteStatsPanel secret={secret} embedded />
          </AdminFlyer>

          <AdminFlyer
            title="Import rapide"
            subtitle="Scraping et publication PrestaShop"
            tone="import"
          >
            <QuickImportSection secret={secret} embedded />
          </AdminFlyer>

          <AdminFlyer
            title="Studio Footshop"
            subtitle="Maillots, rendu et import catalogue"
            tone="studio"
          >
            <JerseyStudioSection secret={secret} embedded />
          </AdminFlyer>
        </div>

        <StripeOrdersSection secret={secret} />
        <ShippingForm secret={secret} />
      </div>
    </Container>
  );
}
