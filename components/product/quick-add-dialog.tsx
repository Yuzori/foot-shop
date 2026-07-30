"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CloseIcon } from "@/components/layout/icons";

import { ProductFlocagePicker } from "@/components/product/product-flocage-picker";
import { ProductImage } from "@/components/product/product-image";
import { StockAlertBell } from "@/components/product/stock-alert-bell";
import { Button } from "@/components/ui/button";
import { Portal } from "@/components/ui/portal";
import { Price } from "@/components/ui/price";
import { Spinner } from "@/components/ui/spinner";
import { shopConfig } from "@/config/shop";
import { useProduct } from "@/hooks/use-products";
import { isJerseyProduct } from "@/lib/product-collection";
import { effectiveProductPrice } from "@/lib/product-price";
import { productHasStock } from "@/lib/product-stock";
import { requiresRetroFlocage } from "@/lib/retro-jersey";
import { isSizeGroup } from "@/lib/sizes";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart-store";
import type { Product, ProductVariant } from "@/types/domain";

function variantForOption(
  product: Product,
  groupName: string,
  valueId: string,
): ProductVariant | undefined {
  return product.variants.find((v) =>
    v.options.some((o) => o.group === groupName && o.id === valueId),
  );
}

function isOptionInStock(
  product: Product,
  groupName: string,
  valueId: string,
): boolean {
  return product.variants.some(
    (v) =>
      v.inStock &&
      v.options.some((o) => o.group === groupName && o.id === valueId),
  );
}

interface QuickAddDialogProps {
  product: Product;
  open: boolean;
  onClose: () => void;
}

/** Taille obligatoire + flocage optionnel — modal plein écran via portail. */
export function QuickAddDialog({ product, open, onClose }: QuickAddDialogProps) {
  const addLine = useCartStore((s) => s.addLine);
  const { data: fullProduct, isLoading } = useProduct(open ? product.id : "");

  const resolved = fullProduct ?? product;
  const hasVariants =
    resolved.optionGroups.length > 0 || resolved.variants.length > 0;

  const [selected, setSelected] = useState<Record<string, string>>({});
  const [stockFeedback, setStockFeedback] = useState<string | null>(null);
  const [flocageEnabled, setFlocageEnabled] = useState(false);
  const [flocageName, setFlocageName] = useState("");
  const [flocageNumber, setFlocageNumber] = useState("");

  const showFlocage = isJerseyProduct(resolved.name);
  const retroFlocageRequired = requiresRetroFlocage(resolved);

  useEffect(() => {
    if (retroFlocageRequired) setFlocageEnabled(true);
  }, [retroFlocageRequired]);

  const matchedVariant: ProductVariant | null = useMemo(() => {
    if (!hasVariants) return null;
    return (
      resolved.variants.find((variant) =>
        variant.options.every((opt) => selected[opt.group] === opt.id),
      ) ?? null
    );
  }, [resolved.variants, selected, hasVariants]);

  const allGroupsSelected = hasVariants
    ? resolved.optionGroups.every((group) => selected[group.name])
    : true;

  const needsSize = hasVariants && !allGroupsSelected;
  const activePrice = effectiveProductPrice(resolved, matchedVariant);
  const inStock = hasVariants
    ? allGroupsSelected
      ? (matchedVariant?.inStock ?? false)
      : productHasStock(resolved)
    : productHasStock(resolved);

  const flocageValid = retroFlocageRequired
    ? flocageName.trim().length >= 2 &&
      flocageNumber.trim().length >= shopConfig.flocageNumberMin
    : !flocageEnabled ||
      (flocageName.trim().length >= 2 &&
        flocageNumber.trim().length >= shopConfig.flocageNumberMin);

  const canAdd =
    inStock &&
    allGroupsSelected &&
    flocageValid &&
    !isLoading &&
    !(hasVariants && resolved.optionGroups.length === 0);

  function resetForm() {
    setSelected({});
    setStockFeedback(null);
    setFlocageEnabled(false);
    setFlocageName("");
    setFlocageNumber("");
  }

  function handleAdd() {
    if (!canAdd) return;
    const optionsLabel = matchedVariant?.options
      .map((o) => `${o.group}: ${o.label}`)
      .join(" · ");

    addLine({
      productId: resolved.id,
      variantId: matchedVariant?.id ?? null,
      name: resolved.name,
      image: resolved.cover?.url ?? null,
      unitPrice: activePrice,
      quantity: 1,
      optionsLabel,
      reference: matchedVariant?.reference ?? resolved.reference,
      flocage:
        showFlocage && (retroFlocageRequired || flocageEnabled)
          ? {
              enabled: true,
              name: flocageName.trim().toUpperCase(),
              number: flocageNumber.trim(),
              price: shopConfig.flocagePrice,
            }
          : undefined,
    });
    onClose();
    resetForm();
  }

  const handleClose = useCallback(() => {
    onClose();
    resetForm();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <Portal>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="overlay-root z-[80]"
          role="dialog"
          aria-modal
          aria-label={`Ajouter ${resolved.name}`}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 bg-gradient-to-b from-accent/25 via-ink/35 to-ink/55 backdrop-blur-xl"
            onClick={handleClose}
            aria-hidden
          />
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="overlay-panel max-w-md"
          >
            <div className="overlay-scroll p-5 sm:p-6">
              <button
                type="button"
                onClick={handleClose}
                aria-label="Fermer"
                className="overlay-close absolute right-3 top-3 text-ink/50 transition-colors hover:bg-paper-soft hover:text-ink"
              >
                <CloseIcon className="h-5 w-5" />
              </button>

              <div className="flex gap-4 pr-10">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-paper-soft">
                  <ProductImage
                    src={resolved.cover?.url ?? null}
                    alt={resolved.name}
                    sizes="80px"
                    className="object-contain p-1"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold leading-tight">{resolved.name}</h2>
                  <Price
                    amount={activePrice}
                    currency={resolved.currency}
                    className="mt-2 text-lg"
                  />
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-10">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : (
                <>
                  {hasVariants ? (
                    <div className="mt-6 space-y-4">
                      {resolved.optionGroups.map((group) => (
                        <div key={group.name}>
                          <p className="mb-2 text-sm font-bold uppercase tracking-wide">
                            {isSizeGroup(group.name) ? "Taille" : group.name}
                            <span className="ml-1 text-accent">*</span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {group.values.map((value) => {
                              const isActive = selected[group.name] === value.id;
                              const optionStock = isOptionInStock(
                                resolved,
                                group.name,
                                value.id,
                              );
                              const variant = variantForOption(
                                resolved,
                                group.name,
                                value.id,
                              );

                              return (
                                <div key={value.id} className="relative">
                                  <button
                                    type="button"
                                    disabled={!optionStock}
                                    onClick={() =>
                                      setSelected((prev) => ({
                                        ...prev,
                                        [group.name]: value.id,
                                      }))
                                    }
                                    className={cn(
                                      "min-w-12 rounded-full border px-4 py-2 text-sm font-bold transition-all",
                                      optionStock
                                        ? isActive
                                          ? "border-ink bg-ink text-paper"
                                          : "border-ink/15 hover:border-ink"
                                        : "border-ink/10 text-ink/35 line-through",
                                    )}
                                  >
                                    {value.label}
                                  </button>
                                  {!optionStock ? (
                                    <StockAlertBell
                                      overlay
                                      productId={resolved.id}
                                      productName={resolved.name}
                                      variantId={variant?.id ?? null}
                                      variantLabel={value.label}
                                      onFeedback={setStockFeedback}
                                    />
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {showFlocage ? (
                    <div className="mt-6">
                      <ProductFlocagePicker
                        enabled={flocageEnabled}
                        required={retroFlocageRequired}
                        name={flocageName}
                        number={flocageNumber}
                        onEnabledChange={setFlocageEnabled}
                        onNameChange={setFlocageName}
                        onNumberChange={setFlocageNumber}
                      />
                    </div>
                  ) : null}

                  {hasVariants && resolved.optionGroups.length === 0 ? (
                    <p className="mt-4 text-sm text-ink/55">
                      Les tailles n&apos;ont pas pu être chargées. Ouvrez la fiche
                      produit pour commander.
                    </p>
                  ) : null}

                  {stockFeedback ? (
                    <p className="mt-4 text-xs leading-relaxed text-ink/55">{stockFeedback}</p>
                  ) : null}

                  {hasVariants && allGroupsSelected && !inStock ? (
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-accent/35 bg-accent/5 px-4 py-3">
                      <p className="text-sm text-ink/70">Cette taille est en rupture</p>
                      <StockAlertBell
                        productId={resolved.id}
                        productName={resolved.name}
                        variantId={matchedVariant?.id ?? null}
                        variantLabel={
                          matchedVariant?.options.map((o) => o.label).join(" / ") ?? null
                        }
                        onFeedback={setStockFeedback}
                      />
                    </div>
                  ) : null}

                  {!productHasStock(resolved) && !hasVariants ? (
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-accent/35 bg-accent/5 px-4 py-3">
                      <p className="text-sm text-ink/70">Produit en rupture de stock</p>
                      <StockAlertBell
                        productId={resolved.id}
                        productName={resolved.name}
                        onFeedback={setStockFeedback}
                      />
                    </div>
                  ) : null}
                </>
              )}

              <div className="mt-6 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleClose}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-accent text-ink hover:bg-accent-dark hover:shadow-glow-sm"
                  disabled={!canAdd}
                  onClick={handleAdd}
                >
                  {isLoading
                    ? "Chargement…"
                    : needsSize
                      ? "Choisissez une taille"
                      : flocageEnabled && !flocageValid
                        ? "Complétez le flocage"
                        : !inStock
                          ? "Indisponible"
                          : "Ajouter au panier"}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </Portal>
  );
}
