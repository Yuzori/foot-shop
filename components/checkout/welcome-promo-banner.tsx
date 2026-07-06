"use client";

import { useQuery } from "@tanstack/react-query";

import { welcomePromo } from "@/config/promotions";
import { formatPrice } from "@/lib/format";
import {
  calculateWelcomeBogo,
  unitsUntilWelcomeBogo,
  type BogoLine,
} from "@/lib/welcome-bogo";

type PromoResponse = {
  status: "none" | "eligible" | "used";
  enabled: boolean;
  code: string | null;
  label: string;
  checkoutLabel: string;
  shortLabel: string;
};

async function fetchWelcomePromo(): Promise<PromoResponse> {
  const res = await fetch("/api/account/welcome-promo");
  return res.json() as Promise<PromoResponse>;
}

export function useWelcomePromo() {
  return useQuery({
    queryKey: ["welcome-promo"],
    queryFn: fetchWelcomePromo,
    staleTime: 120_000,
    refetchOnMount: false,
  });
}

export function WelcomePromoCheckoutBanner({
  subtotal,
  lines,
  appliedBogoDiscount = 0,
  appliedFreeUnits = 0,
}: {
  subtotal: number;
  lines: BogoLine[];
  appliedBogoDiscount?: number;
  appliedFreeUnits?: number;
}) {
  const { data } = useWelcomePromo();

  if (!welcomePromo.enabled || data?.status !== "eligible") {
    return null;
  }

  const preview = calculateWelcomeBogo(lines);
  const discount =
    appliedBogoDiscount > 0 ? appliedBogoDiscount : preview.discountTotal;
  const freeUnits =
    appliedFreeUnits > 0 ? appliedFreeUnits : preview.freeUnits;
  const totalUnits = lines.reduce((sum, line) => sum + line.quantity, 0);
  const missing = unitsUntilWelcomeBogo(totalUnits);

  if (discount > 0 && freeUnits > 0) {
    return (
      <div className="rounded-2xl border border-accent/25 bg-accent/5 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">
          Offre de bienvenue appliquée
        </p>
        <p className="mt-2 text-sm text-ink/80">
          {welcomePromo.checkoutLabel} — {freeUnits} article
          {freeUnits > 1 ? "s" : ""} offert{freeUnits > 1 ? "s" : ""} (une seule
          utilisation).
        </p>
        <div className="mt-3 flex justify-between text-sm">
          <span className="text-ink/55">Économie</span>
          <span className="font-medium text-accent">−{formatPrice(discount)}</span>
        </div>
        <div className="mt-1 flex justify-between text-sm font-semibold">
          <span>Total estimé</span>
          <span>{formatPrice(Math.max(0, subtotal - discount))}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-accent/20 bg-accent/5 px-5 py-4">
      <p className="text-xs font-bold uppercase tracking-widest text-accent">
        Offre de bienvenue
      </p>
      <p className="mt-2 text-sm text-ink/80">
        {welcomePromo.label} sur votre première commande — ajoutez encore{" "}
        <strong>{missing}</strong> article{missing > 1 ? "s" : ""} pour le{" "}
        {welcomePromo.checkoutLabel.toLowerCase()}.
      </p>
    </div>
  );
}

export function shouldApplyWelcomePromo(
  promo: PromoResponse | undefined,
): boolean {
  return Boolean(welcomePromo.enabled && promo?.status === "eligible");
}
