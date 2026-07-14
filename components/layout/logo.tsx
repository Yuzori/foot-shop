"use client";

import { useState } from "react";

import { publicConfig } from "@/config";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** Tailwind height utility for the mark, e.g. "h-8 md:h-9". */
  className?: string;
  /** Render the wordmark in light color (for dark backgrounds). */
  light?: boolean;
  /** Footer variant — uses /logo-footer.png without color filters. */
  variant?: "default" | "footer";
  priority?: boolean;
}

/**
 * Brand logo.
 * - Header : public/logo.png
 * - Footer : public/logo-footer.png (votre fichier personnalisé)
 */
export function Logo({ className, light, variant = "default" }: LogoProps) {
  const [errored, setErrored] = useState(false);
  const src = variant === "footer" ? "/logo-footer.png" : "/logo.png";

  if (errored) {
    return (
      <span
        className={cn(
          "text-xl font-bold tracking-tightest lg:text-2xl",
          light || variant === "footer" ? "text-paper" : "text-ink",
        )}
      >
        {publicConfig.siteName}
        <span className="text-accent">.</span>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={publicConfig.siteName}
      onError={() => setErrored(true)}
      className={cn("h-9 w-auto object-contain", className)}
    />
  );
}
