"use client";

import Link from "next/link";

import { TrophyIcon } from "@/components/layout/icons";
import { cn } from "@/lib/utils";

type WorldCupNavLinkProps = {
  href: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
};

export function WorldCupNavLink({
  href,
  label,
  active,
  onClick,
  className,
}: WorldCupNavLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "world-cup-nav group relative mr-1 hidden items-center gap-2 overflow-hidden rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white shadow-lg transition-[transform,box-shadow] duration-300 ease-premium lg:flex",
        "hover:scale-[1.05] active:scale-[0.97]",
        active && "ring-2 ring-white/70 ring-offset-2 ring-offset-paper",
        className,
      )}
    >
      <span className="world-cup-nav__gradient" aria-hidden />
      <span className="world-cup-nav__shimmer" aria-hidden />
      <TrophyIcon className="relative z-10 h-4 w-4 shrink-0 drop-shadow-sm transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" />
      <span className="relative z-10 drop-shadow-sm">{label}</span>
    </Link>
  );
}
