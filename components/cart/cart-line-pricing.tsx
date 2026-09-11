import { formatPrice } from "@/lib/format";

/** Affiche le détail d'une ligne : maillot offert mais flocage toujours facturé. */
export function CartLinePricing({
  unitPrice,
  quantity,
  freeQuantity,
  flocageUnitPrice = 0,
  className,
}: {
  unitPrice: number;
  quantity: number;
  freeQuantity: number;
  /** Part flocage unitaire (reste payante sur les maillots offerts). */
  flocageUnitPrice?: number;
  className?: string;
}) {
  const productUnitPrice = Math.round((unitPrice - flocageUnitPrice) * 100) / 100;
  const paidQty = Math.max(0, quantity - freeQuantity);
  const total =
    Math.round(
      (paidQty * productUnitPrice + quantity * flocageUnitPrice) * 100,
    ) / 100;

  if (freeQuantity <= 0) {
    return (
      <span className={className ?? "font-medium tabular-nums"}>
        {formatPrice(unitPrice * quantity)}
      </span>
    );
  }

  return (
    <div className={className ?? "shrink-0 text-right text-sm"}>
      {paidQty > 0 ? (
        <p className="tabular-nums text-ink/70">
          {paidQty} × {formatPrice(unitPrice)}
        </p>
      ) : null}
      <p className="font-medium text-accent tabular-nums">
        {freeQuantity} maillot{freeQuantity > 1 ? "s" : ""} offert
        {freeQuantity > 1 ? "s" : ""}
        {flocageUnitPrice > 0
          ? ` · flocage ${formatPrice(flocageUnitPrice * freeQuantity)}`
          : ""}
      </p>
      <p className="mt-0.5 font-medium tabular-nums">{formatPrice(total)}</p>
    </div>
  );
}
