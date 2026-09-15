"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

import { CloseIcon } from "@/components/layout/icons";
import { routes } from "@/config/site";
import { welcomePromo } from "@/config/promotions";
import { drawerPanelMotion, overlayMotion } from "@/lib/motion";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useUIStore } from "@/store/ui-store";

const quickLinks = [
  { label: "Suivi de commande", href: routes.tracking },
  { label: "Contact & assistance", href: routes.contact },
  { label: "CGV", href: routes.terms },
];

export function AccountDrawer() {
  const pathname = usePathname();
  const open = useUIStore((s) => s.accountOpen);
  const close = useUIStore((s) => s.closeAccount);

  useEffect(() => {
    close();
  }, [pathname, close]);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          {...overlayMotion}
          className="fixed inset-0 z-[70]"
          aria-modal
          role="dialog"
          aria-label="Aide"
        >
          <div
            className="absolute inset-0 bg-ink/30 backdrop-blur-md"
            onClick={close}
          />

          <motion.aside
            {...drawerPanelMotion}
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-paper shadow-lift will-change-transform drawer-safe-top drawer-safe-bottom"
          >
            <header className="flex items-center justify-between border-b border-ink/8 px-5 py-4 sm:px-6 sm:py-5">
              <h2 className="text-lg font-semibold tracking-tightest">Aide</h2>
              <button
                onClick={close}
                aria-label="Fermer"
                className="overlay-close text-ink/60 transition-colors hover:bg-paper-soft hover:text-ink"
              >
                <CloseIcon />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <p className="text-sm leading-relaxed text-ink/55">
                Passez commande sans créer de compte. Conservez votre numéro de
                commande pour suivre votre livraison.
              </p>

              {welcomePromo.enabled ? (
                <div className="mt-6 rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-accent">
                    {welcomePromo.label}
                  </p>
                  <p className="mt-1 text-sm text-ink/75">
                    {welcomePromo.checkoutLabel} sur votre première commande,
                    appliqué automatiquement au paiement.
                  </p>
                </div>
              ) : null}

              <nav className="mt-6 space-y-1">
                {quickLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={close}
                    className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium transition-colors hover:bg-paper-soft"
                  >
                    {link.label}
                    <span className="text-ink/30">→</span>
                  </Link>
                ))}
              </nav>
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
