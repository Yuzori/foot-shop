"use client";

import { AnimatePresence, motion } from "framer-motion";

import { shopConfig } from "@/config/shop";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

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
    <motion.div
      layout
      className={cn(
        "overflow-hidden rounded-2xl border p-4 transition-colors duration-300",
        enabled
          ? "border-accent/35 bg-accent/[0.06] shadow-glow-sm"
          : "border-ink/10 bg-paper-soft",
      )}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <motion.span
          animate={{ scale: enabled ? 1.05 : 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 22 }}
          className="mt-0.5 inline-flex"
        >
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
        </motion.span>
        <span className="text-sm font-medium text-ink/80">
          Flocage personnalisé (+{formatPrice(shopConfig.flocagePrice)})
        </span>
      </label>
      <AnimatePresence initial={false}>
        {enabled ? (
          <motion.div
            key="flocage-fields"
            initial={{ height: 0, opacity: 0, y: -6 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -4 }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
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
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
