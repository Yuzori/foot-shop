import Link from "next/link";

import { Reveal } from "@/components/motion/reveal";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { promoPopup } from "@/config/promotions";
import { routes } from "@/config/site";

/**
 * Full-width promotional banner. Reads the active promo from
 * `config/promotions.ts` so it stays in sync with the popup and announcement
 * bar. Hidden automatically when promotions are disabled.
 */
export function PromoBanner() {
  if (!promoPopup.enabled) return null;

  return (
    <Container className="py-10">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-ink px-8 py-14 text-paper sm:px-14">
          <div
            className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-accent/30 blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <p className="eyebrow text-accent">{promoPopup.eyebrow}</p>
              <h2 className="display-2 mt-3 text-paper">{promoPopup.title}</h2>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-paper/65">
                {promoPopup.message}
              </p>
            </div>

            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              {promoPopup.code ? (
                <span className="rounded-full border border-dashed border-paper/40 px-6 py-3 text-sm font-semibold tracking-widest">
                  {promoPopup.code}
                </span>
              ) : null}
              <Link
                href={promoPopup.cta.href || routes.catalogue}
                className={buttonClasses(
                  "primary",
                  "lg",
                  "bg-paper text-ink hover:bg-paper-muted",
                )}
              >
                {promoPopup.cta.label}
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </Container>
  );
}
