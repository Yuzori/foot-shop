"use client";

import { welcomePromo } from "@/config/promotions";
import { unitsUntilWelcomeBogo } from "@/lib/welcome-bogo";

interface WelcomePromoGuestNudgeProps {
  totalUnits: number;
  className?: string;
}

/** Rappel offre 2+1 — sans compte, appliquée au paiement si éligible. */
export function WelcomePromoGuestNudge({
  totalUnits,
  className,
}: WelcomePromoGuestNudgeProps) {
  if (!welcomePromo.enabled || totalUnits < 3) {
    return null;
  }

  const missing = unitsUntilWelcomeBogo(totalUnits);

  return (
    <div
      className={
        className ??
        "rounded-2xl border border-accent/25 bg-accent/5 px-5 py-4"
      }
    >
      <p className="text-xs font-bold uppercase tracking-widest text-accent">
        Offre de bienvenue
      </p>
      <p className="mt-2 text-sm text-ink/80">
        {missing > 0 ? (
          <>
            Ajoutez encore <strong>{missing}</strong> article
            {missing > 1 ? "s" : ""}, puis payez : le{" "}
          </>
        ) : (
          <>Au paiement : le </>
        )}
        <strong>{welcomePromo.checkoutLabel.toLowerCase()}</strong> s&apos;applique
        automatiquement sur votre première commande (une utilisation par foyer).
      </p>
    </div>
  );
}
