"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface CatalogToolbarProps {
  filter?: ReactNode;
  sort: ReactNode;
  count: number;
  countLabel?: string;
  className?: string;
}

/**
 * Mobile : filtre + tri sur une ligne compacte.
 * Desktop : filtre limité en largeur, compteur à gauche, tri à droite.
 */
export function CatalogToolbar({
  filter,
  sort,
  count,
  countLabel,
  className,
}: CatalogToolbarProps) {
  const label =
    countLabel ??
    `${count} produit${count === 1 ? "" : "s"}`;

  return (
    <div className={cn("mb-6 sm:mb-10", className)}>
      {/* Mobile */}
      <div
        className={cn(
          "flex items-center gap-2 sm:hidden",
          !filter && "justify-end",
        )}
      >
        {filter ? <div className="min-w-0 flex-1">{filter}</div> : null}
        <div className="shrink-0">{sort}</div>
      </div>
      <p className="mt-1.5 text-xs text-ink/45 sm:hidden">{label}</p>

      {/* Desktop */}
      <div className="hidden items-center justify-between gap-4 sm:flex">
        <div className="flex min-w-0 items-center gap-4">
          {filter ? (
            <div className="w-full max-w-[14rem] shrink-0">{filter}</div>
          ) : null}
          <p className="shrink-0 text-sm text-ink/50">{label}</p>
        </div>
        <div className="shrink-0">{sort}</div>
      </div>
    </div>
  );
}
