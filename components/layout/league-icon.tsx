"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

interface LeagueIconProps {
  src: string;
  label: string;
  /** Affiche les initiales (MC, MR…) au lieu d’une image. */
  useInitials?: boolean;
  /** Initiales personnalisées (ex. RDM pour « Le reste du monde »). */
  initials?: string;
  className?: string;
}

function leagueInitials(label: string, max = 2): string {
  return label
    .split(/\s+/)
    .filter((word) => word.length > 0 && !/^(de|du|le|la|les|l')$/i.test(word))
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, max)
    .toUpperCase();
}

export function LeagueIcon({
  src,
  label,
  useInitials = false,
  initials,
  className,
}: LeagueIconProps) {
  const [failed, setFailed] = useState(false);
  const displayInitials = (initials ?? leagueInitials(label)).toUpperCase();
  const initialsSize =
    displayInitials.length >= 3 ? "text-[8px]" : "text-[9px]";

  if (useInitials || failed || !src.trim()) {
    return (
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-paper-soft p-1 font-bold tracking-tight text-black",
          initialsSize,
          className,
        )}
        aria-hidden
      >
        {displayInitials}
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
