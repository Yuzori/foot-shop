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

/** Barre catalogue compacte — filtre + tri sur une ligne mobile. */
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
      <div
        className={cn(
          "flex items-center gap-2 sm:gap-3",
          !filter && "justify-end",
        )}
      >
        {filter ? (
          <div className="min-w-0 flex-1">{filter}</div>
        ) : null}
        <div className="shrink-0">{sort}</div>
      </div>
      <p className="mt-1.5 text-xs text-ink/45 sm:mt-2 sm:text-sm">{label}</p>
    </div>
  );
}
