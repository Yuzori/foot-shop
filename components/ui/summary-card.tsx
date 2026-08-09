import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SummaryCardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  badge?: ReactNode;
  /** Coller le récap en haut au scroll desktop (désactiver si le parent gère le sticky). */
  sticky?: boolean;
}

/** Panneau récapitulatif (panier, checkout). */
export function SummaryCard({
  children,
  className,
  title,
  badge,
  sticky = true,
}: SummaryCardProps) {
  return (
    <aside
      className={cn(
        "h-fit rounded-3xl border border-ink/8 bg-paper p-6 shadow-soft lg:p-8",
        sticky && "lg:sticky lg:top-28",
        className,
      )}
    >
      {badge}
      {title ? (
        <h2
          className={cn(
            "text-base font-bold uppercase tracking-wide text-ink",
            badge ? "mt-4" : undefined,
          )}
        >
          {title}
        </h2>
      ) : null}
      {children}
    </aside>
  );
}
