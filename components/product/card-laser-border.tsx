"use client";

import type { CSSProperties, ReactNode } from "react";

import type { ImageAccent } from "@/hooks/use-image-accent-color";
import { cn } from "@/lib/utils";

const RING_MASK: CSSProperties = {
  padding: "1.5px",
  WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
  WebkitMaskComposite: "xor",
  mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
  maskComposite: "exclude",
};

interface CardLaserFrameProps {
  accent: ImageAccent;
  hovered: boolean;
  children: ReactNode;
}

/** Contour discret au survol — anneau léger + balayage lent. */
export function CardLaserFrame({ accent, hovered, children }: CardLaserFrameProps) {
  return (
    <div className="relative w-full rounded-2xl">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-20 rounded-2xl transition-opacity duration-500",
          hovered ? "opacity-100" : "opacity-0",
        )}
        aria-hidden
      >
        <div
          className="absolute inset-0 rounded-2xl"
          style={{ ...RING_MASK, background: accent.muted }}
        />
        <div className="absolute inset-0 overflow-hidden rounded-2xl" style={RING_MASK}>
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="card-laser-spin size-[220%] shrink-0 opacity-70"
              style={{
                background: `conic-gradient(from 0deg, transparent 0deg, transparent 342deg, ${accent.alpha(0.22)} 350deg, ${accent.alpha(0.42)} 356deg, transparent 360deg)`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl">{children}</div>
    </div>
  );
}
