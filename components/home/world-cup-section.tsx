"use client";

import Link from "next/link";

import { Reveal } from "@/components/motion/reveal";
import { buttonClasses } from "@/components/ui/button";
import { ResponsiveBackground } from "@/components/ui/responsive-background";
import { worldCupConfig } from "@/config/world-cup";
import { cn } from "@/lib/utils";

/** Bannière World Cup pleine largeur — le visuel porte le texte, pas d’overlay rouge. */
export function WorldCupSection() {
  if (!worldCupConfig.enabled) return null;

  return (
    <section className="relative w-full overflow-hidden">
      <Reveal y={32}>
        <Link
          href={worldCupConfig.href}
          aria-label={worldCupConfig.ariaLabel}
          className="relative block w-full"
        >
          <div className="relative min-h-[200px] w-full sm:min-h-[260px] lg:min-h-[320px]">
            <ResponsiveBackground
              src={worldCupConfig.bannerDesktop}
              mobileSrc={worldCupConfig.bannerMobile}
            />

            {worldCupConfig.subline || worldCupConfig.ctaLabel ? (
              <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-4 sm:px-6 sm:pb-5">
                <div className="flex flex-col items-center gap-3 text-center">
                  {worldCupConfig.ctaLabel ? (
                    <span
                      className={cn(
                        buttonClasses("outline", "md", "btn-brand-light wc-banner-cta"),
                        "relative overflow-hidden transition-all duration-300",
                        "hover:!scale-[1.02] hover:-translate-y-px",
                      )}
                    >
                      <span
                        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/30 to-transparent"
                        aria-hidden
                      />
                      <span className="relative z-10">{worldCupConfig.ctaLabel}</span>
                    </span>
                  ) : null}
                  {worldCupConfig.subline ? (
                    <p className="max-w-md text-xs font-medium uppercase tracking-[0.2em] text-paper/90 sm:text-sm">
                      {worldCupConfig.subline}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </Link>
      </Reveal>
    </section>
  );
}
