import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { Container } from "@/components/ui/container";
import { publicConfig } from "@/config";
import { footerNav, routes } from "@/config/site";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-32 overflow-hidden border-t border-ink/[0.06] bg-ink text-paper">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-32 top-0 h-64 w-64 rounded-full bg-accent/10 blur-3xl"
        aria-hidden
      />

      <Container className="relative py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href={routes.home} aria-label="Accueil" className="inline-block">
              <Logo variant="footer" className="h-12 w-auto sm:h-14 lg:h-[4.25rem]" />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-paper/55">
              La référence du maillot de football. Sélection premium, qualité
              officielle — livraison offerte sur votre 1ʳᵉ commande.
            </p>
          </div>

          {footerNav.map((group) => (
            <div key={group.title}>
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                {group.title}
              </h4>
              <ul className="mt-5 space-y-3">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-paper/65 transition-colors hover:text-accent"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-paper/10 pt-8 text-xs text-paper/40 sm:flex-row sm:items-center">
          <p>
            © {year} {publicConfig.siteName}. Tous droits réservés.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href={routes.legal} className="transition-colors hover:text-accent">
              Mentions légales
            </Link>
            <Link href={routes.privacy} className="transition-colors hover:text-accent">
              Confidentialité
            </Link>
            <Link href={routes.terms} className="transition-colors hover:text-accent">
              CGV
            </Link>
            <Link href={routes.contact} className="transition-colors hover:text-accent">
              Contact
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
