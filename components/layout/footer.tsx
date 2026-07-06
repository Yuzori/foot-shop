import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { Container } from "@/components/ui/container";
import { publicConfig } from "@/config";
import { footerNav, routes } from "@/config/site";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-32 border-t border-ink/5 bg-paper">
      <Container className="py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href={routes.home} aria-label="Accueil" className="inline-block">
              <Logo className="h-14 w-auto" />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink/50">
              La référence du maillot de football. Sélection premium, qualité
              officielle — livraison gratuite sur toute la boutique.
            </p>
          </div>

          {footerNav.map((group) => (
            <div key={group.title}>
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/40">
                {group.title}
              </h4>
              <ul className="mt-5 space-y-3">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-ink/70 transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-ink/5 pt-8 text-xs text-ink/40 sm:flex-row sm:items-center">
          <p>
            © {year} {publicConfig.siteName}. Tous droits réservés.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href={routes.legal} className="hover:text-ink">
              Mentions légales
            </Link>
            <Link href={routes.privacy} className="hover:text-ink">
              Confidentialité
            </Link>
            <Link href={routes.terms} className="hover:text-ink">
              CGV
            </Link>
            <Link href={routes.contact} className="hover:text-ink">
              Contact
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
