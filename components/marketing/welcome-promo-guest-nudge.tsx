"use client";

import Link from "next/link";

import { welcomePromo } from "@/config/promotions";
import { buttonClasses } from "@/components/ui/button";
import { routes } from "@/config/site";
import { unitsUntilWelcomeBogo } from "@/lib/welcome-bogo";
import { useSession } from "@/hooks/use-auth";

interface WelcomePromoGuestNudgeProps {
  totalUnits: number;
  className?: string;
}

/** Invite à créer un compte pour bénéficier du 2+1 (invités uniquement). */
export function WelcomePromoGuestNudge({
  totalUnits,
  className,
}: WelcomePromoGuestNudgeProps) {
  const { data: user, isLoading } = useSession();

  if (isLoading || user || !welcomePromo.enabled || totalUnits < 3) {
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
            {missing > 1 ? "s" : ""}, puis{" "}
          </>
        ) : (
          <>Vous avez assez d&apos;articles — </>
        )}
        <strong>créez un compte</strong> pour profiter du{" "}
        {welcomePromo.checkoutLabel.toLowerCase()} sur votre première commande.
      </p>
      <Link
        href={routes.register}
        className={buttonClasses("accent", "md", "mt-4 inline-flex")}
      >
        Créer un compte
      </Link>
    </div>
  );
}
