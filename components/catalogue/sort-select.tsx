"use client";

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

export function SortSelect({ value, onChange }: SortSelectProps) {
  const current = options.find((o) => o.value === value)?.label ?? "Trier";

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="shrink-0 text-ink/50">Trier</span>
      <span className="relative inline-flex items-center">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as SortOption)}
          className="h-10 cursor-pointer appearance-none rounded-full border border-ink/15 bg-paper py-0 pl-3.5 pr-8 text-sm font-medium text-ink outline-none transition-colors hover:border-ink/30 focus:border-ink"
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
