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
        "world-cup-nav group relative mr-1 hidden items-center gap-2 overflow-hidden rounded-full bg-ink px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-paper transition-[transform,box-shadow,color] duration-300 ease-premium lg:flex",
        "hover:scale-[1.04] hover:text-white active:scale-[0.97]",
        active && "ring-2 ring-ink/15 ring-offset-2 ring-offset-paper",
        className,
      )}
    >
      <span className="world-cup-nav__gradient" aria-hidden />
      <TrophyIcon className="relative z-10 h-4 w-4 shrink-0 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" />
      <span className="relative z-10">{label}</span>
    </Link>
  );
}
