"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { extractTeamFromProductName } from "@/lib/product-import/format-product-name";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/domain";

interface CountryFilterProps {
  products: Product[];
  value: string | null;
  onChange: (country: string | null) => void;
  className?: string;
}

export function listCountriesFromProducts(products: Product[]): string[] {
  const set = new Set<string>();
  for (const product of products) {
    const team = extractTeamFromProductName(product.name);
    if (team) set.add(team);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "fr"));
}

export function filterProductsByCountry(
  products: Product[],
  country: string | null,
): Product[] {
  if (!country) return products;
  const needle = country.trim().toLowerCase();
  return products.filter((product) => {
    const team = extractTeamFromProductName(product.name);
    return team?.toLowerCase() === needle;
  });
}

/** Filtre pays avec champ texte + suggestions (pas de liste exhaustive). */
export function CountryFilter({
  products,
  value,
  onChange,
  className,
}: CountryFilterProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(value ?? "");
  const [open, setOpen] = useState(false);

  const countries = useMemo(() => listCountriesFromProducts(products), [products]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries.slice(0, 14);
    return countries
      .filter((c) => c.toLowerCase().includes(q))
      .slice(0, 14);
  }, [countries, query]);

  useEffect(() => {
    setQuery(value ?? "");
  }, [value]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function pick(country: string) {
    onChange(country);
    setQuery(country);
    setOpen(false);
  }

  function clear() {
    onChange(null);
    setQuery("");
    setOpen(false);
  }

  if (countries.length < 2) return null;

  return (
    <div ref={rootRef} className={cn("relative min-w-[12rem] flex-1 sm:max-w-xs", className)}>
      <label htmlFor={listId} className="sr-only">
        Filtrer par pays ou équipe
      </label>
      <div className="relative">
        <input
          id={listId}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value.trim()) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Pays ou équipe…"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${listId}-list`}
          className="h-10 w-full rounded-full border border-ink/15 bg-paper px-4 pr-9 text-sm outline-none transition-colors focus:border-accent"
        />
        {value ? (
          <button
            type="button"
            onClick={clear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink/45 hover:text-ink"
            aria-label="Effacer le filtre pays"
          >
            ×
          </button>
        ) : null}
      </div>

      {open && suggestions.length > 0 ? (
        <ul
          id={`${listId}-list`}
          role="listbox"
          className="absolute z-30 mt-2 max-h-56 w-full overflow-y-auto rounded-2xl border border-ink/10 bg-paper py-1 shadow-lift"
        >
          {suggestions.map((country) => (
            <li key={country}>
              <button
                type="button"
                role="option"
                aria-selected={value === country}
                onClick={() => pick(country)}
                className={cn(
                  "flex w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-paper-soft",
                  value === country && "bg-accent/10 font-medium text-ink",
                )}
              >
                {country}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
