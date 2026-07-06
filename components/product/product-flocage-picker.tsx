"use client";

import { shopConfig } from "@/config/shop";
import { formatPrice } from "@/lib/format";

interface ProductFlocagePickerProps {
  enabled: boolean;
  name: string;
  number: string;
  onEnabledChange: (enabled: boolean) => void;
  onNameChange: (name: string) => void;
  onNumberChange: (number: string) => void;
}

/** Flocage nom / numéro sur la fiche produit (maillots). */
export function ProductFlocagePicker({
  enabled,
  name,
  number,
  onEnabledChange,
  onNameChange,
  onNumberChange,
}: ProductFlocagePickerProps) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-paper-soft p-4">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-accent"
        />
        <span className="text-sm font-medium text-ink/80">
          Flocage personnalisé (+{formatPrice(shopConfig.flocagePrice)})
        </span>
      </label>
      {enabled ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase text-ink/50">
              Nom <span className="text-accent">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) =>
                onNameChange(
                  e.target.value.slice(0, shopConfig.flocageNameMax).toUpperCase(),
                )
              }
              placeholder="MESSI"
              maxLength={shopConfig.flocageNameMax}
              className="mt-1.5 h-11 w-full rounded-xl border border-ink/15 bg-paper px-4 text-sm font-bold uppercase outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-ink/50">
              Numéro <span className="text-accent">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={number}
              onChange={(e) =>
                onNumberChange(
                  e.target.value.replace(/\D/g, "").slice(0, shopConfig.flocageNumberMax),
                )
              }
              placeholder="10"
              maxLength={shopConfig.flocageNumberMax}
              className="mt-1.5 h-11 w-full rounded-xl border border-ink/15 bg-paper px-4 text-sm font-bold tabular-nums outline-none focus:border-accent"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
