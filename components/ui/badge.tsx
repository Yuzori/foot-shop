import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "accent" | "dark" | "muted";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-paper text-ink border border-ink/10",
  accent: "bg-accent text-ink",
  dark: "bg-ink text-paper",
  muted: "bg-paper-soft text-ink/70",
};

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
