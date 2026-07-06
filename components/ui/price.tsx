import { discountPercent, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PriceProps {
  amount: number;
  compareAt?: number | null;
  currency?: string;
  className?: string;
  showDiscount?: boolean;
}

/** Displays a price, optionally with a struck-through compare-at price. */
export function Price({
  amount,
  compareAt,
  currency,
  className,
  showDiscount = true,
}: PriceProps) {
  const discount = compareAt ? discountPercent(amount, compareAt) : null;

  return (
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <span className="font-medium tabular-nums">
        {formatPrice(amount, currency)}
      </span>
      {compareAt && discount ? (
        <>
          <span className="text-sm text-ink/40 line-through tabular-nums">
            {formatPrice(compareAt, currency)}
          </span>
          {showDiscount ? (
            <span className="text-xs font-semibold text-accent">
              −{discount}%
            </span>
          ) : null}
        </>
      ) : null}
    </span>
  );
}
