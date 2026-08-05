import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { publicConfig } from "@/config";
import { footerNav, routes } from "@/config/site";

const legalLinks = [
  { label: "Mentions légales", href: routes.legal },
  { label: "Confidentialité", href: routes.privacy },
  { label: "CGV", href: routes.terms },
  { label: "Contact", href: routes.contact },
] as const;

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-paper/10 bg-ink text-paper">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-32 top-0 h-64 w-64 rounded-full bg-accent/10 blur-3xl"
        aria-hidden
      />

      <Container className="relative py-12 sm:py-16 lg:py-20">
        <Reveal>
          <div className="flex flex-col gap-10 sm:gap-12 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)] lg:gap-16">
            <div className="max-w-sm">
              <Link href={routes.home} aria-label="Accueil" className="inline-block">
                <Logo variant="footer" className="h-11 w-auto sm:h-14 lg:h-[4.25rem]" />
              </Link>
              <p className="mt-4 text-sm leading-relaxed text-paper/55 sm:mt-5">
                La référence du maillot de football. Sélection premium —
                livraison offerte sur votre 1ʳᵉ commande.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 sm:gap-x-10 sm:gap-y-8">
              {footerNav.map((group) => (
                <div key={group.title}>
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent sm:text-xs sm:tracking-[0.18em]">
                    {group.title}
                  </h4>
                  <ul className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
                    {group.links.map((link) => (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          className="text-[13px] text-paper/65 transition-colors hover:text-accent sm:text-sm"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-12 space-y-8 border-t border-paper/10 pt-8 sm:mt-14 sm:space-y-6 sm:pt-10">
            <div className="flex justify-center">
              <a
                href="https://webley.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-paper/10 bg-paper/[0.04] px-4 py-2 text-xs text-paper/55 transition-colors hover:border-accent/40 hover:text-accent"
              >
                <span className="text-paper/40">by</span>
                <span className="font-semibold tracking-wide">webley.fr</span>
              </a>
            </div>

            <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:text-left">
              <p className="max-w-xs text-xs leading-relaxed text-paper/40 sm:max-w-none">
                © {year} {publicConfig.siteName}. Tous droits réservés.
              </p>
              <nav
                aria-label="Liens légaux"
                className="grid w-full max-w-xs grid-cols-2 gap-x-4 gap-y-3 text-xs text-paper/40 sm:flex sm:max-w-none sm:flex-wrap sm:justify-end sm:gap-x-6 sm:gap-y-2"
              >
                {legalLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="transition-colors hover:text-accent"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </Reveal>
      </Container>
    </footer>
  );
}
