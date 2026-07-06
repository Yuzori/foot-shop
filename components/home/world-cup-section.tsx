"use client";

import Link from "next/link";

import { ResponsiveBackground } from "@/components/ui/responsive-background";
import { buttonClasses } from "@/components/ui/button";
import { worldCupConfig } from "@/config/world-cup";

/** Bannière World Cup pleine largeur — le visuel porte le texte, pas d’overlay rouge. */
export function WorldCupSection() {
  if (!worldCupConfig.enabled) return null;

  return (
    <section className="relative w-full overflow-hidden">
      <Link
        href={worldCupConfig.href}
        aria-label={worldCupConfig.ariaLabel}
        className="group relative block w-full"
      >
        <div className="relative min-h-[200px] w-full sm:min-h-[260px] lg:min-h-[320px]">
          <ResponsiveBackground
            src={worldCupConfig.bannerDesktop}
            mobileSrc={worldCupConfig.bannerMobile}
            className="transition-transform duration-700 ease-premium group-hover:scale-[1.015]"
          />

          {worldCupConfig.subline || worldCupConfig.ctaLabel ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-4 pb-4 sm:px-6 sm:pb-5">
              <div className="flex flex-col items-center gap-3 text-center">
                {worldCupConfig.ctaLabel ? (
                  <span
                    className={buttonClasses(
                      "outline",
                      "md",
                      "border-paper/80 bg-ink/40 text-paper backdrop-blur-sm transition-colors group-hover:border-paper group-hover:bg-ink/60",
                    )}
                  >
                    {worldCupConfig.ctaLabel}
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
    </section>
  );
}
