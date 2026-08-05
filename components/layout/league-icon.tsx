"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

const INITIALS_COLOR = "#A0A0A0";

interface LeagueIconProps {
  src: string;
  label: string;
  /** Affiche les initiales (MC, MR…) au lieu d’une image. */
  useInitials?: boolean;
  className?: string;
}

function leagueInitials(label: string): string {
  return label
    .split(/\s+/)
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function LeagueIcon({
  src,
  label,
  useInitials = false,
  className,
}: LeagueIconProps) {
  const [failed, setFailed] = useState(false);
  const initials = leagueInitials(label);

  if (useInitials || failed || !src.trim()) {
    return (
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-transparent text-[10px] font-semibold tracking-tight !text-[#A0A0A0]",
          className,
        )}
        style={{ color: INITIALS_COLOR }}
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="h-full w-full object-contain"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
