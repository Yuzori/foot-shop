"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";

import { buttonClasses } from "@/components/ui/button";
import { welcomePromo } from "@/config/promotions";
import { routes } from "@/config/site";
import { useSession } from "@/hooks/use-auth";

const PENDING_KEY = "footshop-welcome-promo-pending";

export function setWelcomePromoPending(): void {
  try {
    sessionStorage.setItem(PENDING_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Bannière après création de compte — offre 2+1. */
export function WelcomePromoNotifier() {
  const { data: user } = useSession();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user || !welcomePromo.enabled) return;
    try {
      if (sessionStorage.getItem(PENDING_KEY) === "1") {
        setVisible(true);
        sessionStorage.removeItem(PENDING_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [user]);

  if (!visible || !welcomePromo.enabled) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -80, opacity: 0 }}
        className="fixed left-0 right-0 top-16 z-50 px-4 sm:top-[4.5rem]"
      >
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 rounded-2xl border border-ink/10 bg-paper px-5 py-4 shadow-lift sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">
              Compte créé
            </p>
            <p className="mt-1 text-sm text-ink/80">
              {welcomePromo.label} sur votre première commande —{" "}
              {welcomePromo.checkoutLabel.toLowerCase()} au paiement.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link href={routes.checkout} className={buttonClasses("primary", "sm")}>
              Commander
            </Link>
            <button
              type="button"
              onClick={() => setVisible(false)}
              className={buttonClasses("ghost", "sm")}
            >
              OK
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
