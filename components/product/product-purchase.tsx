"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PurchaseInfoTicker } from "@/components/product/purchase-info-ticker";
import { ProductFlocagePicker } from "@/components/product/product-flocage-picker";
import { StockIndicator } from "@/components/product/stock-indicator";
import { StockAlertBell } from "@/components/product/stock-alert-bell";
import { shopConfig } from "@/config/shop";
import { isJerseyProduct } from "@/lib/product-collection";
import { stockForVariant } from "@/lib/stock-display";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { routes } from "@/config/site";
import { isSizeGroup } from "@/lib/sizes";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { useProductEngagementStore } from "@/store/product-engagement-store";
import { useCartStore } from "@/store/cart-store";
import type { Product, ProductVariant } from "@/types/domain";

interface ProductPurchaseProps {
  product: Product;
}

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

/** Tailles XS–XXL, alertes stock, ticker infos. Flocage au paiement uniquement. */
export function ProductPurchase({ product }: ProductPurchaseProps) {
  const hasVariants = product.optionGroups.length > 0;
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [stockFeedback, setStockFeedback] = useState<string | null>(null);
  const [flocageEnabled, setFlocageEnabled] = useState(false);
  const [flocageName, setFlocageName] = useState("");
  const [flocageNumber, setFlocageNumber] = useState("");
  const addLine = useCartStore((s) => s.addLine);
  const markPurchased = useProductEngagementStore((s) => s.markPurchased);
  const router = useRouter();
  const showFlocage = isJerseyProduct(product.name);

  const matchedVariant: ProductVariant | null = useMemo(() => {
    if (!hasVariants) return null;
    return (
      product.variants.find((variant) =>
        variant.options.every((opt) => selected[opt.group] === opt.id),
      ) ?? null
    );
  }, [product.variants, selected, hasVariants]);

  const allGroupsSelected = product.optionGroups.every(
    (group) => selected[group.name],
  );

  const activePrice = matchedVariant?.price ?? product.price;
  const displayTotal = activePrice * quantity;
  const needsSize = hasVariants && !allGroupsSelected;
  const sizeSelected = !hasVariants || allGroupsSelected;
  const activeQuantity = stockForVariant(
    sizeSelected ? matchedVariant : null,
    product,
  );
  const inStock = hasVariants
    ? sizeSelected
      ? (matchedVariant?.inStock ?? false)
      : true
    : product.inStock;

  const flocageValid =
    !flocageEnabled ||
    (flocageName.trim().length >= 2 &&
      flocageNumber.trim().length >= shopConfig.flocageNumberMin);

  const canAdd = inStock && sizeSelected && flocageValid;

  function addToCart(): boolean {
    if (!canAdd) return false;
    const optionsLabel = matchedVariant?.options
      .map((o) => `${o.group}: ${o.label}`)
      .join(" · ");

    addLine({
      productId: product.id,
      variantId: matchedVariant?.id ?? null,
      name: product.name,
      image: product.cover?.url ?? null,
      unitPrice: activePrice,
      quantity,
      optionsLabel,
      reference: matchedVariant?.reference ?? product.reference,
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
    markPurchased(product.id);
    return true;
  }

  function handleAdd() {
    if (!addToCart()) return;
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  function handleBuyNow() {
    if (!addToCart()) return;
    router.push(routes.checkout);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Price
          amount={activePrice}
          compareAt={product.compareAtPrice}
          currency={product.currency}
          className="text-2xl"
        />
        <StockIndicator quantity={activeQuantity} />
      </div>

      {showFlocage ? (
        <ProductFlocagePicker
          enabled={flocageEnabled}
          name={flocageName}
          number={flocageNumber}
          onEnabledChange={setFlocageEnabled}
          onNameChange={setFlocageName}
          onNumberChange={setFlocageNumber}
        />
      ) : null}

      {product.optionGroups.map((group) => (
        <div key={group.name}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold uppercase tracking-wide">
              {isSizeGroup(group.name) ? "Taille" : group.name}
            </span>
            {!selected[group.name] ? (
              <span className="text-xs text-ink/40">Sélectionnez une option</span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {group.values.map((value) => {
              const isActive = selected[group.name] === value.id;
              const optionStock = isOptionInStock(product, group.name, value.id);
              const variant = variantForOption(product, group.name, value.id);

              return (
                <div key={value.id} className="relative">
                  <button
                    type="button"
                    disabled={!optionStock}
                    onClick={() => {
                      if (!optionStock) return;
                      setSelected((prev) => ({
                        ...prev,
                        [group.name]: value.id,
                      }));
                    }}
                    className={cn(
                      "relative min-w-12 rounded-full border px-4 py-2.5 text-sm font-bold transition-all",
                      optionStock
                        ? isActive
                          ? "border-ink bg-ink text-paper scale-105"
                          : "border-ink/15 text-ink hover:border-ink hover:scale-105"
                        : "border-ink/10 bg-paper-soft text-ink/35 line-through",
                    )}
                  >
                    {value.label}
                    {!optionStock ? (
                      <span
                        className="absolute inset-0 flex items-center justify-center"
                        aria-hidden
                      >
                        <span className="h-px w-full bg-ink/30 rotate-[-12deg]" />
                      </span>
                    ) : null}
                  </button>
                  {!optionStock ? (
                    <StockAlertBell
                      overlay
                      productId={product.id}
                      productName={product.name}
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

      {stockFeedback ? (
        <p className="-mt-2 text-xs leading-relaxed text-ink/55">{stockFeedback}</p>
      ) : null}

      {hasVariants && allGroupsSelected && !inStock ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-accent/35 bg-accent/5 px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
              Indisponible
            </p>
            <p className="mt-1 text-sm text-ink/70">
              Cette taille est en rupture de stock
            </p>
          </div>
          <StockAlertBell
            productId={product.id}
            productName={product.name}
            variantId={matchedVariant?.id ?? null}
            variantLabel={
              matchedVariant?.options.map((o) => o.label).join(" / ") ?? null
            }
            onFeedback={setStockFeedback}
          />
        </div>
      ) : null}

      <div className="flex items-center gap-4">
        <div className="flex h-12 items-center rounded-full border border-ink/15">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="flex h-full w-12 items-center justify-center text-lg"
            aria-label="Diminuer la quantité"
          >
            −
          </button>
          <span className="w-8 text-center text-sm tabular-nums font-semibold">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => q + 1)}
            className="flex h-full w-12 items-center justify-center text-lg"
            aria-label="Augmenter la quantité"
          >
            +
          </button>
        </div>

        <Button
          onClick={handleAdd}
          disabled={!canAdd}
          size="lg"
          className="flex-1 bg-accent hover:bg-accent-dark"
        >
          <motion.span
            key={added ? "added" : needsSize ? "size" : "add"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {needsSize
              ? "Choisissez une taille"
              : sizeSelected && !inStock
                ? "Indisponible"
                : added
                  ? "Ajouté au panier ✓"
                  : "Ajouter au panier"}
          </motion.span>
        </Button>
      </div>

      <Button
        onClick={handleBuyNow}
        disabled={!canAdd}
        variant="outline"
        size="lg"
        className="w-full border-2"
      >
        {needsSize
          ? "Choisissez une taille pour commander"
          : sizeSelected && !inStock
            ? "Taille indisponible"
            : `Acheter maintenant — ${formatPrice(displayTotal + (flocageEnabled ? shopConfig.flocagePrice : 0) * quantity)}`}
      </Button>

      <PurchaseInfoTicker />
    </div>
  );
}
