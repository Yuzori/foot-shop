"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { CloseIcon } from "@/components/layout/icons";
import { buttonClasses } from "@/components/ui/button";
import { promoPopup } from "@/config/promotions";
import { routes } from "@/config/site";
import { useSession } from "@/hooks/use-auth";

// Per-session key: the popup reappears on each new visit/session (recurrent),
// but not repeatedly within the same tab session.
const sessionKey = (id: string) => `promo-seen:${id}`;

/**
 * Promotional popup. Content lives in `config/promotions.ts`.
 *
 * - Recurrent: shown once per browser session (every new visit / login).
 * - The promo CODE is only revealed to logged-in customers ("le code promo
 *   marche uniquement après création de compte"). Guests see a CTA to sign up.
 */
export function PromoPopup() {
  const { data: user } = useSession();
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!promoPopup.enabled) return;
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(sessionKey(promoPopup.id))) return;

    const timer = window.setTimeout(() => setVisible(true), promoPopup.delayMs);
    return () => window.clearTimeout(timer);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.sessionStorage.setItem(sessionKey(promoPopup.id), "1");
    } catch {
      /* ignore */
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(promoPopup.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  const isLoggedIn = Boolean(user);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-4 left-4 right-4 z-[60] mx-auto max-w-sm overflow-hidden rounded-3xl border border-ink/10 bg-paper p-6 shadow-lift sm:left-6 sm:right-auto"
          role="dialog"
          aria-label={promoPopup.title}
        >
          <button
            onClick={dismiss}
            aria-label="Fermer"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-ink/50 transition-colors hover:bg-paper-soft hover:text-ink"
          >
            <CloseIcon className="h-4 w-4" />
          </button>

          <p className="eyebrow text-accent">{promoPopup.eyebrow}</p>
          <h3 className="mt-2 pr-6 text-xl font-semibold tracking-tightest">
            {promoPopup.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink/60">
            {promoPopup.message}
          </p>

          {isLoggedIn ? (
            <>
              {promoPopup.code ? (
                <button
                  onClick={copyCode}
                  className="group mt-5 flex w-full items-center justify-between rounded-2xl border border-dashed border-ink/25 bg-paper-soft px-4 py-3 transition-colors hover:border-ink/50"
                >
                  <span className="text-sm font-semibold tracking-wider">
                    {promoPopup.code}
                  </span>
                  <span className="text-xs font-medium text-ink/50 group-hover:text-ink">
                    {copied ? "Copié ✓" : "Copier"}
                  </span>
                </button>
              ) : null}
              <Link
                href={promoPopup.cta.href}
                onClick={dismiss}
                className={buttonClasses("primary", "md", "mt-4 w-full")}
              >
                {promoPopup.cta.label}
              </Link>
            </>
          ) : (
            <>
              <p className="mt-4 rounded-2xl bg-paper-soft px-4 py-3 text-xs text-ink/60">
                Créez un compte pour débloquer ce code promo.
              </p>
              <Link
                href={routes.register}
                onClick={dismiss}
                className={buttonClasses("primary", "md", "mt-4 w-full")}
              >
                Créer un compte
              </Link>
              <Link
                href={routes.login}
                onClick={dismiss}
                className="mt-3 block text-center text-xs text-ink/55 hover:text-ink"
              >
                J&apos;ai déjà un compte
              </Link>
            </>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
