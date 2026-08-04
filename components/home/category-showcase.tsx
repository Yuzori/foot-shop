"use client";

import { motion } from "framer-motion";
import Link from "next/link";

import { ArrowIcon, TrophyIcon } from "@/components/layout/icons";
import { Reveal } from "@/components/motion/reveal";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { ResponsiveBackground } from "@/components/ui/responsive-background";
import { Container } from "@/components/ui/container";
import { collectionShowcaseImages } from "@/config/collection-showcase";
import { routes } from "@/config/site";
import { worldCupConfig } from "@/config/world-cup";
import { cn } from "@/lib/utils";

const ease = [0.16, 1, 0.3, 1] as const;

const trophyClipClass =
  "right-[12%] w-[min(54%,13.5rem)] sm:right-[10%] sm:w-[min(52%,12.5rem)]";

/**
 * Moitié haute ou basse du trophée — même image, même taille, décalée pour que
 * la coupe entre les deux cartes donne l’illusion d’un seul objet continu.
 */
function TrophyClipSegment({
  src,
  segment,
}: {
  src: string;
  segment: "top" | "bottom";
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] hidden overflow-hidden sm:block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden
        draggable={false}
        className={cn(
          "absolute object-contain object-center drop-shadow-[0_24px_48px_rgba(0,0,0,0.45)]",
          "h-[calc(200%+var(--trophy-stack-gap,1rem))]",
          trophyClipClass,
          segment === "top"
            ? "top-0"
            : "top-[calc(-100%-var(--trophy-stack-gap,1rem))]",
        )}
      />
    </div>
  );
}

function CollectionPanelBackground({
  variant = "light",
  backgroundSrc,
  mobileBackgroundSrc,
  className,
}: {
  variant?: "light" | "dark" | "accent" | "wc";
  backgroundSrc: string;
  mobileBackgroundSrc?: string;
  className?: string;
}) {
  const isDark = variant === "dark" || variant === "wc";
  const isAccent = variant === "accent";

  return (
    <div
      className={cn(
        "relative h-full min-h-[200px] overflow-hidden rounded-3xl border",
        isAccent
          ? "border-accent/50 bg-accent"
          : isDark
            ? "border-paper/10 bg-ink"
            : "border-ink/8 bg-paper",
        className,
      )}
    >
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
    </div>
  );
}

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
  contentOnly = false,
  trophySegment,
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
  contentOnly?: boolean;
  trophySegment?: "top" | "bottom";
}) {
  const isDark = variant === "dark" || variant === "wc";
  const isAccent = variant === "accent";
  const stacked = contentOnly && Boolean(backgroundSrc);
  const showTrophy =
    trophySegment && collectionShowcaseImages.worldCupOverlay && worldCupConfig.enabled;

  return (
    <motion.div
      whileHover="hover"
      className={cn("group relative h-full min-h-[200px]", className)}
    >
      {stacked && backgroundSrc ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
          <CollectionPanelBackground
            variant={variant}
            backgroundSrc={backgroundSrc}
            mobileBackgroundSrc={mobileBackgroundSrc}
          />
          {showTrophy ? (
            <TrophyClipSegment
              src={collectionShowcaseImages.worldCupOverlay}
              segment={trophySegment}
            />
          ) : null}
        </div>
      ) : null}

      <Link
        href={href}
        className={cn(
          "relative flex h-full min-h-[inherit] flex-col justify-between rounded-3xl border p-6 sm:p-8",
          "transition-[border-color,box-shadow] duration-500",
          contentOnly || stacked
            ? "z-10 border-transparent bg-transparent text-paper hover:border-paper/20"
            : cn(
                "overflow-hidden",
                isAccent
                  ? "border-accent/50 bg-accent text-ink hover:border-accent-dark hover:shadow-glow"
                  : isDark
                    ? "border-paper/10 bg-ink text-paper hover:border-paper/25 hover:shadow-lift"
                    : "border-ink/8 bg-paper text-ink hover:border-ink/20 hover:shadow-lift",
              ),
        )}
      >
        {!contentOnly && !stacked && backgroundSrc ? (
          <>
            <div className="absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
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
            </div>
          </>
        ) : !contentOnly && !stacked ? (
          <div
            className={cn(
              "pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full blur-3xl transition-opacity duration-500",
              isAccent
                ? "bg-paper/20 opacity-60 group-hover:opacity-90"
                : "bg-accent/15 opacity-40 group-hover:opacity-70",
            )}
            aria-hidden
          />
        ) : null}

        <div className="relative z-10">
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
              (backgroundSrc || contentOnly || stacked) && "text-paper",
            )}
          >
            {title}
          </h3>
        </div>

        <div className="relative z-10 mt-8 flex items-end justify-between gap-4">
          <p
            className={cn(
              "max-w-[16rem] text-sm leading-relaxed",
              isAccent
                ? "text-ink/75"
                : isDark || backgroundSrc || contentOnly || stacked
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
              "relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border transition-all duration-300",
              "border-white/20 bg-paper/10 text-paper shadow-lg backdrop-blur-md",
              "group-hover:scale-105 group-hover:-translate-y-px group-hover:border-white/40",
              "group-hover:bg-accent group-hover:text-ink group-hover:shadow-glow-sm",
            )}
            style={{
              boxShadow:
                "0 10px 28px -8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.3)",
            }}
          >
            <span
              className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/30 to-transparent group-hover:from-white/45"
              aria-hidden
            />
            <ArrowIcon className="relative h-4 w-4" />
          </motion.span>
        </div>
      </Link>
    </motion.div>
  );
}

/** Accueil — entrées collections, layout éditorial bento. */
export function CategoryShowcase() {
  return (
    <section className="relative overflow-x-clip bg-ink py-20 text-paper sm:py-28 lg:pb-32">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(102,186,255,0.2),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-32 bottom-0 h-64 w-64 rounded-full bg-accent/10 blur-3xl"
        aria-hidden
      />

      <Container className="relative">
        <Reveal className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
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
        </Reveal>

        <Stagger className="mt-12 overflow-visible grid gap-4 lg:grid-cols-12 lg:grid-rows-2 lg:gap-5">
          <StaggerItem className="lg:col-span-7 lg:row-span-2">
            <CollectionPanel
              className="lg:min-h-[420px]"
              href={routes.catalogHub({ kind: "jersey" })}
              label="Collection phare"
              title="Maillots"
              description="Domicile, extérieur, third — par championnat, taille adulte ou enfant."
              index="01"
              variant="dark"
              backgroundSrc={collectionShowcaseImages.jersey}
            />
          </StaggerItem>

          <div className="grid gap-4 [--trophy-stack-gap:1rem] lg:col-span-5 lg:row-span-2 lg:grid-rows-2 lg:gap-5 lg:[--trophy-stack-gap:1.25rem]">
            <StaggerItem>
              <CollectionPanel
                contentOnly
                trophySegment="top"
                href={routes.catalogHub({ kind: "short" })}
                label="Performance"
                title="Shorts"
                description="Shorts officiels, même parcours guidé par division."
                index="02"
                variant="dark"
                backgroundSrc={collectionShowcaseImages.short}
              />
            </StaggerItem>

            <StaggerItem>
              {worldCupConfig.enabled ? (
                <CollectionPanel
                  contentOnly
                  trophySegment="bottom"
                  href={`${routes.category(worldCupConfig.categoryId)}?kind=jersey&audience=adult`}
                  label="Édition spéciale"
                  title="Coupe du monde"
                  description="La collection CDM — sélection adulte, prête à explorer."
                  index="03"
                  variant="wc"
                  backgroundSrc={collectionShowcaseImages.worldCup}
                  mobileBackgroundSrc={collectionShowcaseImages.worldCup}
                  icon={<TrophyIcon className="h-6 w-6 text-paper/80" />}
                />
              ) : (
                <CollectionPanel
                  contentOnly
                  href={routes.catalogHub({ audience: "kids" })}
                  label="Jeunesse"
                  title="Enfant"
                  description="Tailles enfant, divisions CDM, Ligue 1 et plus."
                  index="03"
                  variant="dark"
                />
              )}
            </StaggerItem>
          </div>
        </Stagger>
      </Container>
    </section>
  );
}
