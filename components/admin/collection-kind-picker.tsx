"use client";

import {
  collectionKindLabel,
  PRODUCT_COLLECTION_KINDS,
  type ProductCollectionKind,
} from "@/lib/product-collection";
import { cn } from "@/lib/utils";

/** Remplace le préfixe Maillot / Short / Veste dans le nom produit. */
export function applyCollectionKindToName(
  name: string,
  kind: ProductCollectionKind,
): string {
  const label = collectionKindLabel(kind);
  const trimmed = name.trim();
  if (!trimmed) return label;

  const rewritten = trimmed.replace(
    /^(maillot|short|shorts|veste|vestes|jacket|jackets)\b/i,
    label,
  );
  if (rewritten !== trimmed) return rewritten;
  if (/^(maillot|short|shorts|veste|vestes)\b/i.test(trimmed)) return rewritten;
  return `${label} ${trimmed}`.replace(/\s+/g, " ").trim();
}

export function CollectionKindPicker({
  value,
  onChange,
  disabled = false,
  className,
}: {
  value: ProductCollectionKind;
  onChange: (kind: ProductCollectionKind) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} role="group" aria-label="Type de produit">
      {PRODUCT_COLLECTION_KINDS.map((kind) => (
        <button
          key={kind}
          type="button"
          disabled={disabled}
          onClick={() => onChange(kind)}
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition",
            value === kind
              ? kind === "short"
                ? "bg-amber-500 text-white"
                : kind === "jacket"
                  ? "bg-emerald-600 text-white"
                  : "bg-sky-600 text-white"
              : "bg-ink/5 text-ink/55 hover:bg-ink/10",
            disabled && "opacity-50",
          )}
        >
          {collectionKindLabel(kind)}
        </button>
      ))}
    </div>
  );
}
