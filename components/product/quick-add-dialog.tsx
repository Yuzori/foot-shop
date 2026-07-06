"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";

import { ProductFlocagePicker } from "@/components/product/product-flocage-picker";
import { ProductImage } from "@/components/product/product-image";
import { StockAlertBell } from "@/components/product/stock-alert-bell";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { Spinner } from "@/components/ui/spinner";
import { shopConfig } from "@/config/shop";
import { useProduct } from "@/hooks/use-products";
import { isJerseyProduct } from "@/lib/product-collection";
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

/** Taille obligatoire + flocage optionnel avant ajout depuis la grille. */
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
  const activePrice = matchedVariant?.price ?? resolved.price;
  const inStock = hasVariants
    ? allGroupsSelected
      ? (matchedVariant?.inStock ?? false)
      : resolved.inStock
    : resolved.inStock;

  const flocageValid =
    !flocageEnabled ||
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
        showFlocage && flocageEnabled
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

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center"
        role="dialog"
        aria-modal
        aria-label={`Ajouter ${resolved.name}`}
      >
        <div
          className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
          onClick={() => {
            onClose();
            resetForm();
          }}
          aria-hidden
        />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-ink/10 bg-paper p-6 shadow-lift"
        >
          <div className="flex gap-4">
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

              {!resolved.inStock && !hasVariants ? (
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
              onClick={() => {
                onClose();
                resetForm();
              }}
            >
              Annuler
            </Button>
            <Button
              type="button"
              className="flex-1 bg-accent hover:bg-accent-dark"
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
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
