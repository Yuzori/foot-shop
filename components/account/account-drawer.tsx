"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

import { CloseIcon } from "@/components/layout/icons";
import { buttonClasses } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { routes } from "@/config/site";
import { welcomePromo } from "@/config/promotions";
import { useWelcomePromo } from "@/components/checkout/welcome-promo-banner";
import { useLogout, useSession } from "@/hooks/use-auth";
import { useUIStore } from "@/store/ui-store";

const EASE = [0.16, 1, 0.3, 1] as const;

const quickLinks = [
  { label: "Mes commandes", href: routes.orders },
  { label: "Suivi de commande", href: routes.tracking },
  { label: "Assistance", href: routes.contact },
];

export function AccountDrawer() {
  const pathname = usePathname();
  const router = useRouter();
  const open = useUIStore((s) => s.accountOpen);
  const close = useUIStore((s) => s.closeAccount);
  const { data: user, isLoading } = useSession();
  const { data: promo } = useWelcomePromo();
  const logout = useLogout();

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70]"
          aria-modal
          role="dialog"
          aria-label="Compte"
        >
          <div
            className="absolute inset-0 bg-ink/30 backdrop-blur-xl"
            onClick={close}
          />

          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.45, ease: EASE }}
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-paper shadow-lift drawer-safe-top drawer-safe-bottom"
          >
            <header className="flex items-center justify-between border-b border-ink/8 px-5 py-4 sm:px-6 sm:py-5">
              <h2 className="text-lg font-semibold tracking-tightest">Compte</h2>
              <button
                onClick={close}
                aria-label="Fermer le compte"
                className="overlay-close text-ink/60 transition-colors hover:bg-paper-soft hover:text-ink"
              >
                <CloseIcon />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {isLoading ? (
                <div className="flex justify-center py-16">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : user ? (
                <div className="space-y-6">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-ink/45">
                      Connecté
                    </p>
                    <p className="mt-2 text-lg font-semibold">
                      Bonjour, {user.firstName}
                    </p>
                    <p className="mt-1 text-sm text-ink/55">{user.email}</p>
                  </div>

                  {welcomePromo.enabled && promo?.status === "eligible" ? (
                    <div className="rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-widest text-accent">
                        {welcomePromo.label}
                      </p>
                      <p className="mt-1 text-sm">
                        {welcomePromo.checkoutLabel} — appliqué au paiement (1ʳᵉ
                        commande).
                      </p>
                    </div>
                  ) : null}

                  <nav className="space-y-1">
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

                  <button
                    type="button"
                    disabled={logout.isPending}
                    onClick={async () => {
                      await logout.mutateAsync();
                      close();
                      router.refresh();
                    }}
                    className={buttonClasses("outline", "md", "w-full")}
                  >
                    {logout.isPending ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      "Se déconnecter"
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <p className="text-sm leading-relaxed text-ink/55">
                    Connectez-vous pour retrouver vos commandes, votre panier
                    sauvegardé et vos favoris.
                  </p>
                  <Link
                    href={routes.login}
                    onClick={close}
                    className={buttonClasses("primary", "lg", "w-full")}
                  >
                    Se connecter
                  </Link>
                  <Link
                    href={routes.register}
                    onClick={close}
                    className={buttonClasses("outline", "lg", "w-full")}
                  >
                    Créer un compte
                  </Link>
                </div>
              )}
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
