"use client";

import { motion } from "framer-motion";
import Link from "next/link";

import { ArrowIcon, TrophyIcon } from "@/components/layout/icons";
import { ResponsiveBackground } from "@/components/ui/responsive-background";
import { Container } from "@/components/ui/container";
import { routes } from "@/config/site";
import { worldCupConfig } from "@/config/world-cup";
import { cn } from "@/lib/utils";

const ease = [0.16, 1, 0.3, 1] as const;

function CollectionPanel({
  href,
  label,
  title,
  description,
  index,
  className,
  variant = "light",
  backgroundSrc,
  mobileBackgroundSrc,
  icon,
}: {
  href: string;
  label: string;
  title: string;
  description: string;
  index: string;
  className?: string;
  variant?: "light" | "dark" | "accent" | "wc";
  backgroundSrc?: string;
  mobileBackgroundSrc?: string;
  icon?: React.ReactNode;
}) {
  const isDark = variant === "dark" || variant === "wc";
  const isAccent = variant === "accent";

  return (
    <motion.div
      whileHover="hover"
      className={cn("group relative h-full min-h-[200px]", className)}
    >
      <Link
        href={href}
        className={cn(
          "relative flex h-full min-h-[inherit] flex-col justify-between overflow-hidden rounded-3xl border p-6 sm:p-8",
          "transition-[border-color,box-shadow] duration-500",
          isAccent
            ? "border-accent/50 bg-accent text-ink hover:border-accent-dark hover:shadow-glow"
            : isDark
              ? "border-paper/10 bg-ink text-paper hover:border-paper/25 hover:shadow-lift"
              : "border-ink/8 bg-paper text-ink hover:border-ink/20 hover:shadow-lift",
        )}
      >
        {backgroundSrc ? (
          <>
            <ResponsiveBackground
              src={backgroundSrc}
              mobileSrc={mobileBackgroundSrc}
              className="transition-transform duration-700 ease-premium group-hover:scale-[1.04]"
            />
            <div
              className={cn(
                "absolute inset-0",
                variant === "wc"
                  ? "bg-gradient-to-t from-ink via-ink/55 to-ink/20"
                  : "bg-gradient-to-t from-ink/90 via-ink/50 to-ink/25",
              )}
              aria-hidden
            />
          </>
        ) : (
          <div
            className={cn(
              "pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full blur-3xl transition-opacity duration-500",
              isAccent ? "bg-paper/20 opacity-60 group-hover:opacity-90" : "bg-accent/15 opacity-40 group-hover:opacity-70",
            )}
            aria-hidden
          />
        )}

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <p
              className={cn(
                "text-[11px] font-bold uppercase tracking-[0.24em]",
                isAccent ? "text-ink/70" : isDark ? "text-paper/55" : "text-accent-dark",
              )}
            >
              {label}
            </p>
            <span
              className={cn(
                "font-display text-3xl font-semibold leading-none opacity-20",
                isAccent ? "text-paper" : isDark ? "text-paper" : "text-ink",
              )}
              aria-hidden
            >
              {index}
            </span>
          </div>
          {icon ? <div className="mt-5">{icon}</div> : null}
          <h3
            className={cn(
              "mt-4 font-display text-3xl font-semibold tracking-tightest sm:text-4xl",
              backgroundSrc && "text-paper",
            )}
          >
            {title}
          </h3>
        </div>

        <div className="relative mt-8 flex items-end justify-between gap-4">
          <p
            className={cn(
              "max-w-[16rem] text-sm leading-relaxed",
              isAccent
                ? "text-ink/75"
                : isDark || backgroundSrc
                  ? "text-paper/65"
                  : "text-ink/55",
            )}
          >
            {description}
          </p>
          <motion.span
            variants={{ hover: { x: 4, scale: 1.05 } }}
            transition={{ duration: 0.35, ease }}
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-300",
              isAccent
                ? "bg-ink text-paper group-hover:bg-accent group-hover:text-ink"
                : isDark || backgroundSrc
                  ? "bg-paper/10 text-paper group-hover:bg-accent group-hover:text-ink"
                  : "bg-ink text-paper group-hover:bg-accent group-hover:text-ink",
            )}
          >
            <ArrowIcon />
          </motion.span>
        </div>
      </Link>
    </motion.div>
  );
}

/** Accueil — entrées collections, layout éditorial bento. */
export function CategoryShowcase() {
  return (
    <section className="relative overflow-hidden bg-ink py-20 text-paper sm:py-28">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(102,186,255,0.2),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-32 bottom-0 h-64 w-64 rounded-full bg-accent/10 blur-3xl"
        aria-hidden
      />

      <Container className="relative">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="eyebrow text-accent">Univers</p>
            <h2 className="display-2 mt-4 text-paper">
              Explorer par
              <span className="block text-paper/90">collection</span>
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-paper/60">
              Maillots, shorts, tailles adulte ou enfant — choisissez votre
              division et entrez directement dans le bon catalogue.
            </p>
          </div>
          <Link
            href={routes.categories}
            className="group inline-flex items-center gap-2 text-sm font-semibold text-paper/70 transition-colors hover:text-paper"
          >
            Toutes les collections
            <ArrowIcon className="transition-transform duration-300 group-hover:translate-x-1 group-hover:text-accent" />
          </Link>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-12 lg:grid-rows-2 lg:gap-5">
          <CollectionPanel
            className="lg:col-span-7 lg:row-span-2 lg:min-h-[420px]"
            href={routes.catalogHub({ kind: "jersey" })}
            label="Collection phare"
            title="Maillots"
            description="Domicile, extérieur, third — par championnat, taille adulte ou enfant."
            index="01"
            variant="accent"
          />

          <CollectionPanel
            className="lg:col-span-5"
            href={routes.catalogHub({ kind: "short" })}
            label="Performance"
            title="Shorts"
            description="Shorts officiels, même parcours guidé par division."
            index="02"
            variant="dark"
          />

          {worldCupConfig.enabled ? (
            <CollectionPanel
              className="lg:col-span-5"
              href={`${routes.category(worldCupConfig.categoryId)}?kind=jersey&audience=adult`}
              label="Édition spéciale"
              title="Coupe du monde"
              description="La collection CDM — sélection adulte, prête à explorer."
              index="03"
              variant="wc"
              backgroundSrc={worldCupConfig.bannerDesktop}
              mobileBackgroundSrc={worldCupConfig.bannerMobile}
              icon={
                <TrophyIcon className="h-6 w-6 text-paper/80" />
              }
            />
          ) : (
            <CollectionPanel
              className="lg:col-span-5"
              href={routes.catalogHub({ audience: "kids" })}
              label="Jeunesse"
              title="Enfant"
              description="Tailles enfant, divisions CDM, Ligue 1 et plus."
              index="03"
              variant="dark"
            />
          )}
        </div>
      </Container>
    </section>
  );
}
