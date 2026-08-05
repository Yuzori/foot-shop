"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { ResponsiveBackground } from "@/components/ui/responsive-background";
import { buttonClasses, buttonStyle } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { heroPaintConfig } from "@/config/hero";
import { useCatalogNav } from "@/hooks/use-catalog-nav";
import { brandButtonStyle } from "@/lib/brand-button";

const ease = [0.16, 1, 0.3, 1] as const;

/** Hero paint — titre image, fond peinture, boutons classiques. */
export function HeroPaint() {
  const catalogNav = useCatalogNav();
  const cfg = heroPaintConfig;

  return (
    <section className="hero-paint relative overflow-hidden bg-ink text-paper">
      <ResponsiveBackground src="/bkd.jpg" />
      <div className="hero-paint__overlay" aria-hidden />
      <div className="hero-paint__splatter" aria-hidden>
        <div className="hero-paint__splatter-stroke hero-paint__splatter-stroke--1" />
        <div className="hero-paint__splatter-stroke hero-paint__splatter-stroke--2" />
        <div className="hero-paint__splatter-stroke hero-paint__splatter-stroke--3" />
      </div>

      <Container className="relative z-10 flex min-h-[min(72vh,40rem)] flex-col justify-center py-12 sm:min-h-[min(78vh,46rem)] sm:py-16 lg:py-20">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="text-xs font-bold uppercase tracking-[0.32em] text-accent"
        >
          {cfg.eyebrow}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease, delay: 0.08 }}
          className="hero-paint-title-wrap mt-3 max-w-6xl sm:mt-5"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cfg.titleImage}
            alt={cfg.titleAlt}
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
            className="hero-paint-title-image pointer-events-none select-none"
          />
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease, delay: 0.3 }}
          className="mt-5 max-w-lg text-sm leading-relaxed text-paper/72 sm:mt-7 sm:text-base"
        >
          {cfg.description}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease, delay: 0.4 }}
          className="mt-8 flex flex-wrap gap-3 sm:mt-12"
        >
          <Link
            href={catalogNav.maillots.href}
            className={buttonClasses("accent", "lg")}
            style={buttonStyle("accent")}
          >
            {cfg.ctaJerseys}
          </Link>

          <Link
            href={catalogNav.shorts.href}
            className={buttonClasses("outline", "lg", "btn-brand-light")}
            style={brandButtonStyle(undefined, "light")}
          >
            {cfg.ctaShorts}
          </Link>
        </motion.div>
      </Container>
    </section>
  );
}
