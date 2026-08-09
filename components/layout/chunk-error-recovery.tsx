"use client";

import { useEffect } from "react";

const RELOAD_KEY = "foot-shop-chunk-reload";

function isChunkLoadError(message: string): boolean {
  return /ChunkLoadError|Loading chunk [\d]+ failed/i.test(message);
}

/** Recharge une fois après déploiement si le navigateur a un ancien bundle en cache. */
export function ChunkErrorRecovery() {
  useEffect(() => {
    function tryRecover(reason: string) {
      if (!isChunkLoadError(reason)) return;
      if (sessionStorage.getItem(RELOAD_KEY)) return;
      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
    }

    function onError(event: ErrorEvent) {
      tryRecover(event.message || String(event.error ?? ""));
    }

    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      if (reason instanceof Error) {
        tryRecover(reason.message);
        return;
      }
      tryRecover(String(reason ?? ""));
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
