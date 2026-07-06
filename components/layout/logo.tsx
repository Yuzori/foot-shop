"use client";

import { useState } from "react";

import { publicConfig } from "@/config";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** Tailwind height utility for the mark, e.g. "h-8 md:h-9". */
  className?: string;
  /** Render the wordmark in light color (for dark backgrounds). */
  light?: boolean;
  priority?: boolean;
}

/**
 * Brand logo.
 *
 * Renders the image at `public/logo.png` (place your file there). If the asset
 * is missing or fails to load, it falls back gracefully to the site-name
 * wordmark — so the build never breaks and there's never a broken image.
 */
export function Logo({ className, light }: LogoProps) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <span
        className={cn(
          "text-xl font-bold tracking-tightest lg:text-2xl",
          light ? "text-paper" : "text-ink",
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
      src="/logo.png"
      alt={publicConfig.siteName}
      onError={() => setErrored(true)}
      className={cn("h-9 w-auto object-contain", className)}
    />
  );
}
