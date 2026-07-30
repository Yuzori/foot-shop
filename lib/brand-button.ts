import type { CSSProperties } from "react";

import { toImageAccent, type ImageAccent } from "@/lib/image-accent-client";

export type BrandButtonTone = "brand" | "light" | "subtle";

export const BRAND_BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full border font-bold uppercase tracking-wide text-white shadow-lg backdrop-blur-md transition-all duration-300 ease-premium select-none hover:scale-105 hover:-translate-y-px active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40";

/** Style verre dégradé — identique au bouton « Choisir options ». */
export function brandButtonStyle(
  accent?: ImageAccent,
  tone: BrandButtonTone = "brand",
): CSSProperties {
  const a = accent ?? toImageAccent();

  if (tone === "light") {
    return {
      borderWidth: 1,
      borderStyle: "solid",
      borderColor: "rgba(255,255,255,0.38)",
      background:
        "linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 100%)",
      boxShadow:
        "0 10px 28px -8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.35)",
      textShadow: "0 1px 2px rgba(0,0,0,0.28)",
      color: "#fff",
    };
  }

  if (tone === "subtle") {
    return {
      borderWidth: 1,
      borderStyle: "solid",
      borderColor: a.alpha(0.35),
      background: `linear-gradient(135deg, ${a.alpha(0.42)} 0%, ${a.alpha(0.22)} 100%)`,
      boxShadow: `0 8px 22px -8px ${a.alpha(0.4)}, inset 0 1px 0 rgba(255,255,255,0.28)`,
      textShadow: "0 1px 2px rgba(0,0,0,0.18)",
      color: "#fff",
    };
  }

  return {
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.38)",
    background: `linear-gradient(135deg, ${a.alpha(0.78)} 0%, ${a.alpha(0.58)} 100%)`,
    boxShadow: `0 10px 28px -8px ${a.alpha(0.55)}, inset 0 1px 0 rgba(255,255,255,0.3)`,
    textShadow: "0 1px 2px rgba(0,0,0,0.22)",
    color: "#fff",
  };
}

/** Halo focus (recherche, champs). */
export function brandFocusRingStyle(accent?: ImageAccent): CSSProperties {
  const a = accent ?? toImageAccent();
  return {
    borderColor: a.alpha(0.55),
    boxShadow: `0 10px 28px -8px ${a.alpha(0.45)}, inset 0 1px 0 rgba(255,255,255,0.35)`,
  };
}
