"use client";

import type { CSSProperties, ReactNode } from "react";

import type { ImageAccent } from "@/lib/image-accent-client";

const RING_MASK: CSSProperties = {
  padding: "1.5px",
  WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
  WebkitMaskComposite: "xor",
  mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
  maskComposite: "exclude",
};

interface CardLaserFrameProps {
  accent: ImageAccent;
  children: ReactNode;
}

/** Contour discret au survol — anneau léger + balayage lent (CSS group-hover, pas de re-render). */
export function CardLaserFrame({ accent, children }: CardLaserFrameProps) {
  return (
    <div className="relative w-full rounded-2xl">
      <div
        className="pointer-events-none absolute inset-0 z-20 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
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
