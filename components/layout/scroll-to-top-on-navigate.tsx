"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";

/** Remonte en haut à chaque changement de page (navigation client). */
export function ScrollToTopOnNavigate() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}
