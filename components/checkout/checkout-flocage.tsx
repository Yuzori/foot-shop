"use client";

import { useCallback, useMemo, useState } from "react";

import { buttonClasses } from "@/components/ui/button";
import { shopConfig } from "@/config/shop";
import { formatPrice } from "@/lib/format";
import { getFlocageDisplay } from "@/lib/flocage";
import {
  isFlocageComplete,
  isFlocageDraftValid,
} from "@/lib/flocage-validation";
import { isJerseyProduct } from "@/lib/product-collection";
import { useCartStore } from "@/store/cart-store";
import type { CartLine } from "@/types/domain";

type FlocageDraft = { name: string; number: string };

function lineKey(line: CartLine): string {
  return `${line.productId}-${line.variantId ?? "base"}`;
}

/** Flocage au paiement — saisie locale puis validation explicite. */
export function CheckoutFlocage() {
  const cartLines = useCartStore((s) => s.lines);
  const setFlocage = useCartStore((s) => s.setFlocage);

  const [activeKeys, setActiveKeys] = useState<Set<string>>(() => new Set());
  const [drafts, setDrafts] = useState<Record<string, FlocageDraft>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const lines = useMemo(
    () => cartLines.filter((line) => isJerseyProduct(line.name)),
    [cartLines],
  );

  const openDraft = useCallback((line: CartLine) => {
    const key = lineKey(line);
    setActiveKeys((prev) => new Set(prev).add(key));
    setDrafts((prev) => {
      const { name, number } = line.flocage ?? { name: "", number: "" };
      return {
        ...prev,
        [key]: {
          name: name ?? "",
          number: number ?? line.flocage?.text ?? "",
        },
      };
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const closeDraft = useCallback((key: string) => {
    setActiveKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  if (lines.length === 0) return null;

  return (
    <section>
      <h2 className="mb-5 text-lg font-bold uppercase tracking-wide">Flocage</h2>
      <ul className="space-y-4">
        {lines.map((line) => {
          const key = lineKey(line);
          const complete = isFlocageComplete(line);
          const isActive = activeKeys.has(key);
          const draft = drafts[key] ?? { name: "", number: "" };

          return (
            <li key={key} className="surface-muted p-4">
              <p className="text-sm font-semibold">{line.name}</p>
              {line.optionsLabel ? (
                <p className="text-xs text-ink/45">{line.optionsLabel}</p>
              ) : null}

              {complete && !isActive ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-ink/70">
                    Flocage :{" "}
                    <span className="font-bold text-ink">
                      {getFlocageDisplay(line.flocage!)}
                    </span>
                    <span className="text-ink/45">
                      {" "}
                      (+{formatPrice(shopConfig.flocagePrice)})
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => openDraft(line)}
                    className="text-sm font-medium text-ink/55 underline-offset-2 hover:text-accent hover:underline"
                  >
                    Modifier
                  </button>
                </div>
              ) : null}

              {!complete && !isActive ? (
                <button
                  type="button"
                  onClick={() => openDraft(line)}
                  className="mt-3 text-sm font-medium text-ink underline-offset-2 hover:text-accent hover:underline"
                >
                  Ajouter flocage (+{formatPrice(shopConfig.flocagePrice)})
                </button>
              ) : null}

              {isActive ? (
                <div className="mt-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase text-ink/50">
                        Nom <span className="text-accent">*</span>
                      </label>
                      <input
                        type="text"
                        value={draft.name}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [key]: {
                              ...draft,
                              name: e.target.value
                                .slice(0, shopConfig.flocageNameMax)
                                .toUpperCase(),
                            },
                          }))
                        }
                        placeholder="MESSI"
                        autoComplete="off"
                        maxLength={shopConfig.flocageNameMax}
                        className="mt-1.5 h-11 w-full rounded-xl border border-ink/15 bg-paper px-4 text-sm font-bold uppercase text-ink outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-ink/50">
                        Numéro <span className="text-accent">*</span>
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={draft.number}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [key]: {
                              ...draft,
                              number: e.target.value
                                .replace(/\D/g, "")
                                .slice(0, shopConfig.flocageNumberMax),
                            },
                          }))
                        }
                        placeholder="10"
                        autoComplete="off"
                        maxLength={shopConfig.flocageNumberMax}
                        className="mt-1.5 h-11 w-full rounded-xl border border-ink/15 bg-paper px-4 text-sm font-bold tabular-nums text-ink outline-none focus:border-accent"
                      />
                      <p className="mt-1 text-[11px] text-ink/45">
                        {shopConfig.flocageNumberMin} chiffres minimum
                      </p>
                    </div>
                  </div>

                  {errors[key] ? (
                    <p className="text-xs text-accent">{errors[key]}</p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!isFlocageDraftValid(draft.name, draft.number)) {
                          setErrors((prev) => ({
                            ...prev,
                            [key]: `Nom (min. 2 lettres) et numéro (${shopConfig.flocageNumberMin} chiffres) requis.`,
                          }));
                          return;
                        }
                        setFlocage(line.productId, line.variantId, {
                          enabled: true,
                          name: draft.name.trim().toUpperCase(),
                          number: draft.number.trim(),
                          price: shopConfig.flocagePrice,
                        });
                        closeDraft(key);
                      }}
                      className={buttonClasses("primary", "sm")}
                    >
                      Valider le flocage
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (complete) {
                          closeDraft(key);
                          return;
                        }
                        setFlocage(line.productId, line.variantId, undefined);
                        closeDraft(key);
                      }}
                      className={buttonClasses("outline", "sm")}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
