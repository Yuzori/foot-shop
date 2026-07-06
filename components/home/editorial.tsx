import Link from "next/link";

import { Reveal } from "@/components/motion/reveal";
import { ResponsiveBackground } from "@/components/ui/responsive-background";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { routes } from "@/config/site";

/**
 * Editorial split section — brand storytelling that drives engagement without
 * relying on any product data.
 */
export function Editorial() {
  return (
    <Container className="py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-ink">
            {/* Independent image (public/bkd2.jpg + /bkd2-tel.jpg) */}
            <ResponsiveBackground src="/bkd2.jpg" />
            <div
              className="absolute inset-0 bg-gradient-to-tr from-ink/80 via-ink/20 to-transparent"
              aria-hidden
            />
            <div className="absolute bottom-0 left-0 p-8">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-paper/70">
                Flocage premium
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tightest text-paper">
                Votre nom. Votre numéro.
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="eyebrow text-accent">L&apos;expérience Foot Shop</p>
          <h2 className="display-2 mt-3">
            Plus qu&apos;un maillot, une signature.
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-ink/60">
            Des matières officielles, des finitions soignées et une
            personnalisation à la hauteur des plus grands clubs. Chaque pièce est
            sélectionnée pour les vrais passionnés.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              "Maillots authentiques contrôlés un à un",
              "Flocage nom & numéro de qualité professionnelle",
              "Expédition rapide et soignée",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-ink/75">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {item}
              </li>
            ))}
          </ul>
          <Link
            href={routes.catalogue}
            className={buttonClasses("primary", "lg", "mt-10")}
          >
            Composer mon maillot
          </Link>
        </Reveal>
      </div>
    </Container>
  );
}
