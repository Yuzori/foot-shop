"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { LeagueIcon } from "@/components/layout/league-icon";
import { Container } from "@/components/ui/container";
import {
  buildCatalogHref,
  catalogLeagues,
  type CatalogAudience,
  type CatalogKind,
} from "@/config/catalog-leagues";
import { routes } from "@/config/site";
import { useCatalogNav } from "@/hooks/use-catalog-nav";
import { cn } from "@/lib/utils";

const VALID_KINDS: CatalogKind[] = ["jersey", "short"];
const VALID_AUDIENCES: CatalogAudience[] = ["adult", "kids"];
const ease = [0.16, 1, 0.3, 1] as const;

const kindOptions: {
  id: CatalogKind;
  label: string;
  hint: string;
}[] = [
  { id: "jersey", label: "Maillots", hint: "Domicile, extérieur, third" },
  { id: "short", label: "Shorts", hint: "Shorts officiels" },
];

function StepProgress({
  current,
}: {
  current: "kind" | "audience" | "divisions";
}) {
  const steps = [
    { id: "kind", label: "Produit" },
    { id: "audience", label: "Taille" },
    { id: "divisions", label: "Division" },
  ] as const;
  const index = steps.findIndex((step) => step.id === current);

  return (
    <div className="mb-10 flex items-center justify-center gap-2 sm:gap-3">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
                i <= index
                  ? "bg-ink text-paper"
                  : "bg-paper-soft text-ink/35",
              )}
            >
              {i + 1}
            </span>
            <span
              className={cn(
                "text-xs font-medium",
                i === index ? "text-ink" : "text-ink/40",
              )}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 ? (
            <span
              className={cn(
                "hidden h-px w-6 sm:block sm:w-10",
                i < index ? "bg-ink/30" : "bg-ink/10",
              )}
              aria-hidden
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Page intermédiaire : type → audience → divisions. */
export function CatalogHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const catalogNav = useCatalogNav();

  const kindParam = searchParams.get("kind");
  const audienceParam = searchParams.get("audience");

  const kind = VALID_KINDS.includes(kindParam as CatalogKind)
    ? (kindParam as CatalogKind)
    : null;
  const audience = VALID_AUDIENCES.includes(audienceParam as CatalogAudience)
    ? (audienceParam as CatalogAudience)
    : null;

  const step = useMemo(() => {
    if (!kind) return "kind" as const;
    if (!audience) return "audience" as const;
    return "divisions" as const;
  }, [audience, kind]);

  const kindLabel = kind === "jersey" ? "Maillots" : kind === "short" ? "Shorts" : "";

  function goKind(next: CatalogKind) {
    router.push(routes.catalogHub({ kind: next }));
  }

  function goAudience(next: CatalogAudience) {
    if (!kind) return;
    router.push(routes.catalogHub({ kind, audience: next }));
  }

  return (
    <Container className="py-10 lg:py-16">
      <div className="mx-auto max-w-2xl">
        <StepProgress current={step} />

        <AnimatePresence mode="wait">
          {step === "kind" ? (
            <motion.div
              key="kind"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease }}
              className="text-center"
            >
              <p className="eyebrow text-accent">Étape 1</p>
              <h1 className="display-2 mt-3">Que voulez-vous voir ?</h1>
              <p className="mx-auto mt-3 max-w-md text-sm text-ink/55">
                Cliquez sur une option pour continuer.
              </p>

              <div className="mt-8 grid grid-cols-2 gap-3">
                {kindOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => goKind(option.id)}
                    className={cn(
                      "rounded-2xl border px-4 py-6 text-left transition-all duration-300",
                      "border-ink/10 bg-paper hover:border-ink hover:shadow-lift",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                    )}
                  >
                    <span className="text-lg font-semibold tracking-tightest">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-xs text-ink/50">
                      {option.hint}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          ) : null}

          {step === "audience" && kind ? (
            <motion.div
              key="audience"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease }}
              className="text-center"
            >
              <Link
                href={routes.catalogHub()}
                className="mb-6 inline-flex items-center gap-1 text-xs font-medium text-ink/45 hover:text-ink"
              >
                ← Retour
              </Link>
              <p className="eyebrow text-accent">Étape 2 · {kindLabel}</p>
              <h1 className="display-2 mt-3">Adulte ou enfant ?</h1>
              <p className="mx-auto mt-3 max-w-md text-sm text-ink/55">
                Choisissez une taille pour afficher les divisions.
              </p>

              <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-ink/10 bg-paper-soft p-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => goAudience("adult")}
                    className="rounded-xl border border-transparent bg-paper px-4 py-4 text-sm font-semibold text-ink shadow-sm transition-all hover:border-ink/15 hover:shadow-md active:scale-[0.99]"
                  >
                    Adulte
                    <span className="mt-0.5 block text-[11px] font-normal text-ink/45">
                      Tailles S – XXL
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => goAudience("kids")}
                    className="rounded-xl border border-transparent bg-paper px-4 py-4 text-sm font-semibold text-ink shadow-sm transition-all hover:border-ink/15 hover:shadow-md active:scale-[0.99]"
                  >
                    Enfant
                    <span className="mt-0.5 block text-[11px] font-normal text-ink/45">
                      Tailles enfant
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          ) : null}

          {step === "divisions" && kind && audience ? (
            <motion.div
              key="divisions"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease }}
            >
              <Link
                href={routes.catalogHub({ kind })}
                className="mb-6 inline-flex items-center gap-1 text-xs font-medium text-ink/45 hover:text-ink"
              >
                ← Retour
              </Link>
              <div className="text-center">
                <p className="eyebrow text-accent">
                  Étape 3 · {kindLabel} · {audience === "kids" ? "Enfant" : "Adulte"}
                </p>
                <h1 className="display-2 mt-3">Choisissez une division</h1>
                <p className="mx-auto mt-3 max-w-md text-sm text-ink/55">
                  Cliquez sur une compétition pour voir les produits.
                </p>
              </div>

              <ul className="mt-8 space-y-2">
                {catalogLeagues.map((league, index) => (
                  <motion.li
                    key={league.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03, duration: 0.22, ease }}
                  >
                    <Link
                      href={buildCatalogHref(
                        kind,
                        audience,
                        league,
                        catalogNav.categories,
                        catalogNav.allCategories,
                      )}
                      className="group flex items-center gap-4 rounded-2xl border border-ink/10 bg-paper px-5 py-4 transition-all hover:border-ink/25 hover:bg-paper-soft"
                    >
                      <LeagueIcon src={league.icon} label={league.label} />
                      <span className="flex-1 text-left font-semibold tracking-tight">
                        {league.label}
                      </span>
                      <span className="rounded-full bg-paper-soft px-3 py-1 text-xs font-medium text-ink/50 transition-colors group-hover:bg-accent group-hover:text-ink">
                        Voir
                      </span>
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </Container>
  );
}
