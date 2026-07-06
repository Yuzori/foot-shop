"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { shopConfig } from "@/config/shop";

/** Bandeau compact sous les boutons d'achat. */
export function PurchaseInfoTicker() {
  const messages = shopConfig.purchaseTicker;
  const interval = shopConfig.tickerIntervalMs;
  const [activeIndex, setActiveIndex] = useState(0);
  const [fill, setFill] = useState(0);

  useEffect(() => {
    let raf = 0;
    const started = performance.now();

    const loop = (now: number) => {
      const total = now - started;
      const elapsed = total % interval;
      setFill((elapsed / interval) * 100);
      setActiveIndex(Math.floor(total / interval) % messages.length);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [interval, messages.length]);

  return (
    <div className="border-t border-ink/6 pt-3">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
        <div className="min-w-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.p
              key={activeIndex}
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="truncate text-[11px] font-medium leading-tight text-ink/55"
            >
              {messages[activeIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
      <div className="mt-2 h-[2px] w-24 overflow-hidden rounded-full bg-ink/8">
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={false}
          animate={{ width: `${fill}%` }}
          transition={{ duration: 0.1, ease: "linear" }}
        />
      </div>
    </div>
  );
}
