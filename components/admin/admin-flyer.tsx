"use client";

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type FlyerTone = "default" | "stats" | "import" | "studio";

const toneStyles: Record<
  FlyerTone,
  { border: string; header: string; icon: string }
> = {
  default: {
    border: "border-ink/10",
    header: "hover:bg-paper-soft/80",
    icon: "text-ink/40",
  },
  stats: {
    border: "border-ink/12",
    header: "hover:bg-paper-soft/90",
    icon: "text-ink/45",
  },
  import: {
    border: "border-[#1a7f37]/25",
    header: "hover:bg-[#1a7f37]/[0.04]",
    icon: "text-[#1a7f37]/70",
  },
  studio: {
    border: "border-accent/25",
    header: "hover:bg-accent/[0.04]",
    icon: "text-accent/80",
  },
};

export function AdminFlyer({
  title,
  subtitle,
  tone = "default",
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  tone?: FlyerTone;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const styles = toneStyles[tone];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-paper",
        styles.border,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors sm:px-5 sm:py-5",
          styles.header,
        )}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-ink sm:text-base">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-ink/50">{subtitle}</p>
          ) : null}
        </div>
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/10 bg-paper-soft/80 transition-transform duration-300",
            open && "rotate-180",
            styles.icon,
          )}
          aria-hidden
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      {open ? (
        <div className="border-t border-ink/8 px-4 pb-4 sm:px-5 sm:pb-5">
          {children}
        </div>
      ) : null}
    </div>
  );
}
