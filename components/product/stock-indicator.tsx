"use client";

import { motion } from "framer-motion";

import {
  isLowStock,
  shouldShowStockQuantity,
  stockGradient,
  stockLabel,
} from "@/lib/stock-display";
import { cn } from "@/lib/utils";

interface StockIndicatorProps {
  quantity: number;
  className?: string;
}

/** Affichage stock avec dégradé animé (plus c'est bas, plus c'est chaud). */
export function StockIndicator({
  quantity,
  className,
}: StockIndicatorProps) {
  if (!shouldShowStockQuantity(quantity)) return null;

  const label = stockLabel(quantity);

  const low = isLowStock(quantity);
  const { from, to } = stockGradient(quantity);

  return (
    <motion.span
      className={cn(
        "inline-block bg-clip-text text-xs font-bold uppercase tracking-wide text-transparent",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(90deg, ${from}, ${to}, ${from})`,
        backgroundSize: low ? "200% 100%" : "100% 100%",
      }}
      animate={
        low
          ? { backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }
          : { backgroundPosition: "0% 50%" }
      }
      transition={
        low
          ? { duration: 2.8, ease: "easeInOut", repeat: Infinity }
          : { duration: 0.3 }
      }
    >
      {label}
    </motion.span>
  );
}
