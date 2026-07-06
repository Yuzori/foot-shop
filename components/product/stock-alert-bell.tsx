"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { useSession } from "@/hooks/use-auth";
import { http, getErrorMessage } from "@/lib/http";
import { cn } from "@/lib/utils";

interface StockAlertBellProps {
  productId: string;
  productName: string;
  variantId?: string | null;
  variantLabel?: string | null;
  className?: string;
  overlay?: boolean;
  onFeedback?: (message: string | null) => void;
}

async function fetchAlertStatus(
  productId: string,
  variantId: string | null,
  email: string | undefined,
): Promise<boolean> {
  if (!email) return false;
  const params = new URLSearchParams({ productId });
  if (variantId) params.set("variantId", variantId);
  const res = await fetch(`/api/stock-alert/status?${params}`);
  if (!res.ok) return false;
  const data = (await res.json()) as { subscribed?: boolean };
  return Boolean(data.subscribed);
}

export function StockAlertBell({
  productId,
  productName,
  variantId = null,
  variantLabel = null,
  className,
  overlay = false,
  onFeedback,
}: StockAlertBellProps) {
  const { data: user } = useSession();
  const userEmail = user?.email?.trim().toLowerCase();

  const statusQuery = useQuery({
    queryKey: ["stock-alert-status", productId, variantId, userEmail],
    queryFn: () => fetchAlertStatus(productId, variantId, userEmail),
    enabled: Boolean(userEmail),
    staleTime: 30_000,
  });

  const subscribed = Boolean(statusQuery.data);

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [justSubscribed, setJustSubscribed] = useState(false);

  useEffect(() => {
    setJustSubscribed(false);
  }, [userEmail, productId, variantId]);

  function playDingDong() {
    setRinging(true);
    window.setTimeout(() => setRinging(false), 1200);
  }

  async function subscribe(targetEmail?: string) {
    onFeedback?.(null);
    setPending(true);
    const target = (
      targetEmail ?? (email.trim() || user?.email || "")
    ).toLowerCase();
    if (!target) {
      setOpen(true);
      setPending(false);
      return;
    }
    try {
      const { data } = await http.post<{
        message: string;
        alreadyInStock?: boolean;
        subscribed?: boolean;
      }>("/stock-alert", {
        email: target,
        productId,
        variantId,
        productName,
        variantLabel,
      });
      onFeedback?.(data.message);
      if (data.subscribed || data.message.includes("déjà inscrit")) {
        playDingDong();
        setJustSubscribed(true);
        await statusQuery.refetch();
      }
      if (!data.alreadyInStock) setOpen(false);
    } catch (err) {
      onFeedback?.(getErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  const active = subscribed || justSubscribed;

  function handleBellClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (active) return;
    setOpen((o) => !o);
  }

  const accountPanel = user?.email ? (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-ink/65">
        La notification sera envoyée à l&apos;adresse de votre compte :
      </p>
      <p className="truncate rounded-lg bg-paper-soft px-3 py-2 text-sm font-semibold text-ink">
        {user.email}
      </p>
      <button
        type="button"
        onClick={() => subscribe(user.email)}
        disabled={pending}
        className="w-full rounded-full bg-ink py-2 text-xs font-semibold text-paper"
      >
        {pending ? <Spinner className="mx-auto h-3.5 w-3.5 border-paper/30 border-t-paper" /> : "Activer l'alerte"}
      </button>
    </div>
  ) : (
    <div className="space-y-3">
      <p className="text-xs text-ink/55">Votre email pour l&apos;alerte :</p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="votre@email.com"
        className="h-10 w-full rounded-lg border border-ink/15 px-3 text-sm outline-none focus:border-accent"
      />
      <button
        type="button"
        onClick={() => subscribe()}
        disabled={pending}
        className="w-full rounded-full bg-ink py-2 text-xs font-semibold text-paper"
      >
        {pending ? <Spinner className="mx-auto h-3.5 w-3.5 border-paper/30 border-t-paper" /> : "Confirmer"}
      </button>
    </div>
  );

  return (
    <div className={cn(overlay ? "contents" : "relative", className)}>
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        animate={
          ringing
            ? {
                rotate: [0, -22, 20, -16, 14, -8, 6, 0],
                scale: [1, 1.08, 1.05, 1.1, 1.02, 1],
              }
            : { rotate: 0, scale: 1 }
        }
        transition={
          ringing
            ? { duration: 1.1, ease: "easeInOut" }
            : { duration: 0.2 }
        }
        onClick={handleBellClick}
        disabled={pending || active || statusQuery.isLoading}
        className={cn(
          "relative flex items-center justify-center rounded-full transition-colors",
          overlay
            ? "absolute -right-1 -top-1 z-10 h-6 w-6 border border-paper bg-paper text-ink/70 shadow-sm hover:bg-accent hover:text-paper"
            : "gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide",
          active && overlay && "border-accent bg-accent text-paper",
          active && !overlay && "border-accent bg-accent/10 text-accent",
          !active &&
            !overlay &&
            "border-ink/15 hover:border-accent hover:text-accent",
        )}
        aria-label={active ? "Alerte activée" : "Alerte retour en stock"}
        aria-pressed={active}
      >
        <AnimatePresence>
          {ringing ? (
            <motion.span
              key="ring"
              className="pointer-events-none absolute inset-0 rounded-full border-2 border-accent"
              initial={{ scale: 0.7, opacity: 0.9 }}
              animate={{ scale: 1.8, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          ) : null}
        </AnimatePresence>

        {pending || statusQuery.isLoading ? (
          <Spinner className="h-2.5 w-2.5" />
        ) : (
          <svg
            width={overlay ? 12 : 16}
            height={overlay ? 12 : 16}
            viewBox="0 0 24 24"
            fill={active ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            className="relative"
            aria-hidden
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        )}
        {!overlay ? (
          <span>{active ? "Alerte activée" : "Alerte stock"}</span>
        ) : null}
      </motion.button>

      {open && !active && !overlay ? (
        <div className="mt-2 rounded-xl border border-ink/10 bg-paper p-3 shadow-soft">
          {accountPanel}
        </div>
      ) : null}

      {open && !active && overlay ? (
        <div className="absolute left-1/2 top-full z-30 mt-2 min-w-[240px] -translate-x-1/2 rounded-xl border border-ink/10 bg-paper p-3 shadow-lift">
          {accountPanel}
        </div>
      ) : null}
    </div>
  );
}
