"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

/** Écran de chargement initial — disparaît dès que le DOM est prêt. */
export function SiteLoader() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const dismiss = () => {
      window.setTimeout(() => setReady(true), 120);
    };

    if (document.readyState === "interactive" || document.readyState === "complete") {
      dismiss();
      return;
    }

    document.addEventListener("DOMContentLoaded", dismiss, { once: true });
    const fallback = window.setTimeout(dismiss, 2000);
    return () => {
      document.removeEventListener("DOMContentLoaded", dismiss);
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <AnimatePresence>
      {!ready ? (
        <motion.div
          key="site-loader"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-white"
        >
          <span className="text-sm font-semibold uppercase tracking-[0.3em] text-ink">
            Foot Shop
          </span>
          <div className="h-[3px] w-40 overflow-hidden rounded-full bg-ink/10">
            <motion.div
              className="h-full w-full bg-accent"
              style={{ transformOrigin: "left" }}
              animate={{ scaleX: [0, 1, 1, 0] }}
              transition={{
                duration: 1.2,
                ease: "easeInOut",
                times: [0, 0.45, 0.55, 1],
                repeat: Infinity,
              }}
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
