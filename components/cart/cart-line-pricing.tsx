import { formatPrice } from "@/lib/format";

/** Affiche le détail d'une ligne avec unités offertes à 0 €. */
export function CartLinePricing({
  unitPrice,
  quantity,
  freeQuantity,
  className,
}: {
  unitPrice: number;
  quantity: number;
  freeQuantity: number;
  className?: string;
}) {
  const paidQty = Math.max(0, quantity - freeQuantity);
  const total = Math.round(unitPrice * paidQty * 100) / 100;

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
        {freeQuantity} offert{freeQuantity > 1 ? "s" : ""} — 0 €
      </p>
      <p className="mt-0.5 font-medium tabular-nums">{formatPrice(total)}</p>
    </div>
  );
}
