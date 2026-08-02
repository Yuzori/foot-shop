"use client";

import { cn } from "@/lib/utils";
import type { SortOption } from "@/types/domain";

const options: { value: SortOption; label: string }[] = [
  { value: "relevance", label: "Pertinence" },
  { value: "newest", label: "Nouveautés" },
  { value: "price-asc", label: "Prix croissant" },
  { value: "price-desc", label: "Prix décroissant" },
  { value: "name-asc", label: "Nom (A-Z)" },
];

interface SortSelectProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
  className?: string;
  compact?: boolean;
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function SortSelect({
  value,
  onChange,
  className,
  compact = false,
}: SortSelectProps) {
  const current = options.find((o) => o.value === value)?.label ?? "Trier";

  return (
    <label
      className={cn(
        "inline-flex items-center gap-1.5 text-sm sm:gap-2",
        className,
      )}
    >
      <span
        className={cn(
          "shrink-0 text-ink/50",
          compact && "sr-only sm:not-sr-only",
        )}
      >
        Trier
      </span>
      <span className="relative inline-flex items-center">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as SortOption)}
          className={cn(
            "h-9 cursor-pointer appearance-none truncate rounded-full border border-ink/15 bg-paper py-0 pl-2.5 pr-7 text-xs font-medium text-ink outline-none transition-colors hover:border-ink/30 focus:border-ink sm:h-10 sm:pl-3.5 sm:pr-8 sm:text-sm",
            compact ? "max-w-[7.75rem] sm:max-w-none" : "max-w-none",
          )}
          aria-label={`Trier par : ${current}`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 text-ink/45" />
      </span>
    </label>
  );
}
