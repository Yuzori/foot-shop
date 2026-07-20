"use client";

import { useEffect, useMemo, useState } from "react";

import {
  flattenAdminCategoryOptGroups,
  type AdminCategoryOptGroup,
} from "@/lib/admin/import-category-tree";
import { cn } from "@/lib/utils";

const ACTIVE_GROUP_KEY = "footshop-admin-category-active-group";

function shortLabel(fullLabel: string, groupLabel: string): string {
  const prefix = `${groupLabel} — `;
  return fullLabel.startsWith(prefix)
    ? fullLabel.slice(prefix.length)
    : fullLabel;
}

function findGroupForValue(
  optGroups: readonly AdminCategoryOptGroup[],
  value: string,
): string {
  for (const group of optGroups) {
    if (group.options.some((option) => option.id === value)) {
      return group.label;
    }
  }
  return optGroups[0]?.label ?? "";
}

export function AdminCategoryPicker({
  optGroups,
  value,
  disabled,
  onChange,
  compact = false,
}: {
  optGroups: AdminCategoryOptGroup[];
  value: string;
  disabled?: boolean;
  onChange: (categoryId: string) => void;
  compact?: boolean;
}) {
  const flat = flattenAdminCategoryOptGroups(optGroups);
  const resolvedValue = flat.some((option) => option.id === value)
    ? value
    : (flat[0]?.id ?? "");

  const [activeGroupLabel, setActiveGroupLabel] = useState(() => {
    if (typeof window === "undefined") {
      return findGroupForValue(optGroups, resolvedValue);
    }
    const saved = window.sessionStorage.getItem(ACTIVE_GROUP_KEY);
    if (saved && optGroups.some((group) => group.label === saved)) {
      return saved;
    }
    return findGroupForValue(optGroups, resolvedValue);
  });

  useEffect(() => {
    const group = findGroupForValue(optGroups, resolvedValue);
    if (group) setActiveGroupLabel(group);
  }, [resolvedValue, optGroups]);

  useEffect(() => {
    if (!activeGroupLabel) return;
    try {
      window.sessionStorage.setItem(ACTIVE_GROUP_KEY, activeGroupLabel);
    } catch {
      // ignore
    }
  }, [activeGroupLabel]);

  const activeGroup = useMemo(
    () => optGroups.find((group) => group.label === activeGroupLabel) ?? optGroups[0],
    [activeGroupLabel, optGroups],
  );

  if (!flat.length) {
    return (
      <p className="rounded-lg border border-dashed border-ink/15 px-3 py-2 text-xs text-ink/50">
        Aucune catégorie — vérifiez PrestaShop ou rechargez la page.
      </p>
    );
  }

  const selectedOption = flat.find((option) => option.id === resolvedValue);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {optGroups.map((group) => {
          const active = group.label === activeGroup?.label;
          return (
            <button
              key={group.label}
              type="button"
              disabled={disabled}
              onClick={() => setActiveGroupLabel(group.label)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-accent bg-accent text-white"
                  : "border-ink/12 bg-white text-ink/70 hover:border-ink/25 hover:text-ink",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              {group.label}
            </button>
          );
        })}
      </div>

      {activeGroup ? (
        <div
          className={cn(
            "grid gap-2",
            compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
          )}
        >
          {activeGroup.options.map((option) => {
            const selected = option.id === resolvedValue;
            return (
              <button
                key={option.id}
                type="button"
                disabled={disabled}
                onClick={() => onChange(option.id)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left text-xs leading-snug transition-colors",
                  selected
                    ? "border-accent bg-accent/[0.08] font-semibold text-ink ring-1 ring-accent/30"
                    : "border-ink/10 bg-white text-ink/75 hover:border-ink/20 hover:bg-paper-soft/80",
                  disabled && "cursor-not-allowed opacity-50",
                )}
              >
                {shortLabel(option.label, activeGroup.label)}
              </button>
            );
          })}
        </div>
      ) : null}

      {selectedOption ? (
        <p className="text-[11px] text-ink/45">
          Sélection : <span className="font-medium text-ink/70">{selectedOption.label}</span>
        </p>
      ) : null}
    </div>
  );
}
