"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { shopConfig } from "@/config/shop";

function RadarPulse() {
  return (
    <span className="relative flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
      <motion.span
        className="absolute inset-0 rounded-full border border-accent/45"
        animate={{ scale: [0.75, 1.45], opacity: [0.65, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
      />
      <motion.span
        className="absolute inset-0 rounded-full p-[1.5px]"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, rgba(102,186,255,0.15) 20deg, rgba(102,186,255,0.9) 48deg, rgba(102,186,255,0.2) 76deg, transparent 110deg)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
      >
        <span className="block h-full w-full rounded-full bg-paper-soft" />
      </motion.span>
      <span className="relative h-1 w-1 rounded-full bg-accent" />
    </span>
  );
}

/** Bandeau discret sous les boutons d'achat — messages rotatifs + fine barre. */
export function PurchaseInfoTicker() {
  const messages = shopConfig.purchaseTicker;
  const interval = shopConfig.tickerIntervalMs;
  const [activeIndex, setActiveIndex] = useState(0);
  const [fill, setFill] = useState(0);
  const [barPhase, setBarPhase] = useState<"fill" | "snap">("fill");
  const indexRef = useRef(0);
  const startRef = useRef(performance.now());
  const phaseRef = useRef<"fill" | "snap">("fill");
  const snapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    indexRef.current = 0;
    startRef.current = performance.now();
    phaseRef.current = "fill";
    setActiveIndex(0);
    setFill(0);
    setBarPhase("fill");

    let raf = 0;
    const loop = (now: number) => {
      if (phaseRef.current === "fill") {
        const elapsed = now - startRef.current;
        const progress = Math.min(100, (elapsed / interval) * 100);
        setFill(progress);

        if (elapsed >= interval) {
          phaseRef.current = "snap";
          setBarPhase("snap");
          setFill(0);

          if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
          snapTimeoutRef.current = setTimeout(() => {
            indexRef.current = (indexRef.current + 1) % messages.length;
            setActiveIndex(indexRef.current);
            phaseRef.current = "fill";
            setBarPhase("fill");
            startRef.current = performance.now();
          }, 140);
        }
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
    };
  }, [interval, messages.length]);

  return (
    <div className="inline-flex max-w-full flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <RadarPulse />
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.p
              key={activeIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="text-xs font-medium leading-snug text-ink/55"
            >
              {messages[activeIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
      <div
        className="ml-7 h-0.5 max-w-[14rem] overflow-hidden rounded-full bg-ink/[0.08]"
        role="progressbar"
        aria-valuenow={Math.round(fill)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <motion.div
          className="h-full rounded-full bg-accent/50"
          initial={false}
          animate={{ width: `${fill}%` }}
          transition={
            barPhase === "snap"
              ? { duration: 0.12, ease: [0.55, 0, 1, 0.45] }
              : { duration: 0.06, ease: "linear" }
          }
        />
      </div>
    </div>
  );
}
