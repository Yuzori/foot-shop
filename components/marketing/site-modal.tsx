"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { CloseIcon } from "@/components/layout/icons";
import { ProductImage } from "@/components/product/product-image";
import { buttonClasses } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { promoPopup, welcomePromo } from "@/config/promotions";
import { routes } from "@/config/site";
import { useSession } from "@/hooks/use-auth";
import { useWelcomePromo } from "@/components/checkout/welcome-promo-banner";
import { api } from "@/lib/api";
import type { Product } from "@/types/domain";

const CATALOG_KEY = "footshop_catalog_ids";
const CREATED_KEY = "footshop_product_created";
const ABSENT_KEY = "footshop_absent_ids";
const PROMO_SESSION_KEY = (id: string) => `promo-seen:${id}`;

type ModalMode = "new-releases" | "promo";

function readKnownIds(): string[] {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveKnownIds(ids: string[]) {
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

function readCreatedMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CREATED_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveCreatedMap(map: Record<string, string>) {
  try {
    localStorage.setItem(CREATED_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function readAbsentIds(): string[] {
  try {
    const raw = localStorage.getItem(ABSENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveAbsentIds(ids: string[]) {
  try {
    localStorage.setItem(ABSENT_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

/** Détecte les nouveautés : ID inconnu, ré-ajout PS (createdAt ou retour après suppression). */
function detectNewProducts(items: Product[]): Product[] {
  const known = readKnownIds();
  const createdMap = readCreatedMap();
  const absent = readAbsentIds();
  const currentIds = items.map((p) => p.id);

  const newlyAbsent = known.filter((id) => !currentIds.includes(id));
  if (newlyAbsent.length > 0) {
    saveAbsentIds([...new Set([...absent, ...newlyAbsent])]);
  }

  const cameBack = absent.filter((id) => currentIds.includes(id));

  if (known.length === 0) {
    saveKnownIds(currentIds);
    saveCreatedMap(
      Object.fromEntries(
        items.map((p) => [p.id, p.createdAt ?? ""]),
      ),
    );
    saveAbsentIds([]);
    return [];
  }

  return items.filter((p) => {
    if (!known.includes(p.id)) return true;
    if (cameBack.includes(p.id)) return true;
    const prev = createdMap[p.id];
    if (p.createdAt && prev && prev !== p.createdAt) return true;
    return false;
  });
}

function persistCatalog(items: Product[]) {
  const known = readKnownIds();
  const createdMap = readCreatedMap();
  const absent = readAbsentIds();
  const ids = items.map((p) => p.id);
  saveKnownIds([...new Set([...known, ...ids])]);
  const nextMap = { ...createdMap };
  for (const p of items) {
    if (p.createdAt) nextMap[p.id] = p.createdAt;
  }
  saveCreatedMap(nextMap);
  saveAbsentIds(absent.filter((id) => !ids.includes(id)));
}

/**
 * Modale centrale sport (noir / blanc) — nouveautés en carrousel + promo.
 */
export function SiteModal() {
  const { data: user } = useSession();
  const { data: welcomePromoStatus } = useWelcomePromo();
  const { data: catalog } = useQuery({
    queryKey: ["catalog-watch"],
    queryFn: () => api.getProducts({ sort: "newest", limit: 40, page: 1 }),
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
  });

  const [mode, setMode] = useState<ModalMode | null>(null);
  const [newProducts, setNewProducts] = useState<Product[]>([]);
  const [slide, setSlide] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!catalog?.items?.length) return;

    const fresh = detectNewProducts(catalog.items);
    if (fresh.length > 0) {
      setNewProducts(fresh);
      setMode("new-releases");
      setSlide(0);
      return;
    }

    if (mode === "new-releases") return;

    if (promoPopup.enabled && !sessionStorage.getItem(PROMO_SESSION_KEY(promoPopup.id))) {
      const timer = window.setTimeout(() => setMode("promo"), promoPopup.delayMs);
      return () => window.clearTimeout(timer);
    }
  }, [catalog?.items, mode]);

  const dismiss = useCallback(() => {
    if (mode === "new-releases") {
      if (catalog?.items) persistCatalog(catalog.items);
      setNewProducts([]);

      if (
        promoPopup.enabled &&
        !sessionStorage.getItem(PROMO_SESSION_KEY(promoPopup.id))
      ) {
        setMode("promo");
        return;
      }
    }

    if (mode === "promo") {
      try {
        sessionStorage.setItem(PROMO_SESSION_KEY(promoPopup.id), "1");
      } catch {
        /* ignore */
      }
    }

    setMode(null);
  }, [mode, catalog?.items]);

  async function copyCode() {
    const code = promoCode ?? welcomePromo.code;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  if (!mode) return null;

  const isLoggedIn = Boolean(user);
  const promoCode =
    isLoggedIn && welcomePromoStatus?.status === "eligible"
      ? welcomePromo.code
      : isLoggedIn
        ? null
        : promoPopup.code;
  const currentNew = newProducts[slide];
  const hasMultiple = newProducts.length > 1;
  const releaseTitle = hasMultiple
    ? "Voici les nouveaux articles"
    : "Voici le nouvel article";

  return (
    <AnimatePresence>
      {mode ? (
        <motion.div
          key="site-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-ink/50 backdrop-blur-md"
            onClick={dismiss}
            aria-hidden
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 12 }}
            transition={{ type: "spring", stiffness: 400, damping: 34 }}
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-ink/10 bg-paper text-ink shadow-lift"
          >
            <div className="h-1 w-full bg-accent" />

            <button
              onClick={dismiss}
              aria-label="Fermer"
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-paper-soft text-ink/50 transition-colors hover:bg-ink hover:text-paper"
            >
              <CloseIcon className="h-5 w-5" />
            </button>

            {mode === "new-releases" && currentNew ? (
              <div className="p-6 sm:p-8">
                <p className="eyebrow text-accent">Nouveauté</p>
                <h2 className="display-2 mt-2">{releaseTitle}</h2>
                <p className="mt-2 text-sm text-ink/55">
                  {newProducts.length} article{newProducts.length > 1 ? "s" : ""}{" "}
                  depuis votre dernière visite
                </p>

                <div className="relative mt-6 overflow-hidden rounded-2xl border border-ink/8 bg-paper-soft">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentNew.id}
                      initial={{ opacity: 0, x: 32 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -32 }}
                      transition={{ duration: 0.3 }}
                      className="grid grid-cols-1 sm:grid-cols-2"
                    >
                      <div className="relative aspect-square bg-paper">
                        <ProductImage
                          src={currentNew.cover?.url ?? null}
                          alt={currentNew.name}
                          className="object-contain p-4"
                        />
                      </div>
                      <div className="flex flex-col justify-center p-6">
                        <h3 className="text-lg font-semibold leading-tight">
                          {currentNew.name}
                        </h3>
                        <Price
                          amount={currentNew.price}
                          compareAt={currentNew.compareAtPrice}
                          currency={currentNew.currency}
                          className="mt-4 text-xl"
                        />
                        <Link
                          href={routes.product(currentNew.id)}
                          onClick={dismiss}
                          className={buttonClasses(
                            "primary",
                            "md",
                            "mt-6 w-full bg-accent hover:bg-accent-dark",
                          )}
                        >
                          Voir le produit
                        </Link>
                      </div>
                    </motion.div>
                  </AnimatePresence>

                  {hasMultiple ? (
                    <div className="flex items-center justify-center gap-4 border-t border-ink/8 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          setSlide(
                            (s) => (s - 1 + newProducts.length) % newProducts.length,
                          )
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-soft text-sm hover:bg-ink hover:text-paper"
                        aria-label="Précédent"
                      >
                        ‹
                      </button>
                      <span className="text-xs font-medium tabular-nums text-ink/50">
                        {slide + 1} / {newProducts.length}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSlide((s) => (s + 1) % newProducts.length)
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-soft text-sm hover:bg-ink hover:text-paper"
                        aria-label="Suivant"
                      >
                        ›
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {mode === "promo" ? (
              <div className="p-6 sm:p-8">
                <p className="eyebrow text-accent">{promoPopup.eyebrow}</p>
                <h2 className="display-2 mt-3">{promoPopup.title}</h2>
                <p className="mt-4 text-sm leading-relaxed text-ink/60">
                  {promoPopup.message}
                </p>

                {isLoggedIn ? (
                  <>
                    {promoCode ? (
                      <button
                        onClick={copyCode}
                        className="group mt-6 flex w-full items-center justify-between rounded-2xl border border-ink/10 bg-paper-soft px-5 py-4 transition-colors hover:border-accent"
                      >
                        <span className="text-lg font-bold tracking-[0.2em] text-ink">
                          {promoCode}
                        </span>
                        <span className="text-xs font-medium uppercase tracking-widest text-ink/45 group-hover:text-accent">
                          {copied ? "Copié ✓" : "Copier"}
                        </span>
                      </button>
                    ) : null}
                    <Link
                      href={promoPopup.cta.href}
                      onClick={dismiss}
                      className={buttonClasses(
                        "primary",
                        "lg",
                        "mt-5 w-full bg-accent hover:bg-accent-dark",
                      )}
                    >
                      {promoPopup.cta.label}
                    </Link>
                  </>
                ) : (
                  <>
                    <div className="mt-6 rounded-2xl border border-ink/8 bg-paper-soft px-5 py-4">
                      <p className="text-sm font-medium text-ink">
                        Créez un compte et recevez{" "}
                        <strong className="text-accent">{welcomePromo.label}</strong>{" "}
                        sur votre première commande.
                      </p>
                      <p className="mt-2 text-xs text-ink/50">
                        {welcomePromo.checkoutLabel} au paiement dès 3 articles.
                      </p>
                    </div>
                    <Link
                      href={routes.register}
                      onClick={dismiss}
                      className={buttonClasses(
                        "primary",
                        "lg",
                        "mt-4 w-full bg-accent hover:bg-accent-dark",
                      )}
                    >
                      Créer mon compte
                    </Link>
                    <Link
                      href={routes.login}
                      onClick={dismiss}
                      className="mt-4 block text-center text-sm text-ink/50 hover:text-ink"
                    >
                      Déjà inscrit ? Se connecter
                    </Link>
                  </>
                )}
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
