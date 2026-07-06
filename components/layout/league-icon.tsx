"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

interface LeagueIconProps {
  src: string;
  label: string;
  className?: string;
}

export function LeagueIcon({ src, label, className }: LeagueIconProps) {
  const [failed, setFailed] = useState(false);
  const initials = label
    .split(/\s+/)
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (failed) {
    return (
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-paper-soft text-[10px] font-bold tracking-tight text-ink/45",
          className,
        )}
        aria-hidden
      >
        {initials}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-paper-soft p-1",
        className,
      )}
    >
      <img
        src={src}
        alt=""
        className="h-full w-full object-contain"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
