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
        "world-cup-nav group relative mr-1 hidden items-center gap-2 overflow-hidden rounded-full bg-ink px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-paper transition-colors duration-300 ease-premium lg:flex",
        active && "world-cup-nav--active",
        className,
      )}
    >
      <span className="world-cup-nav__gradient" aria-hidden />
      <TrophyIcon className="relative z-10 h-4 w-4 shrink-0" />
      <span className="relative z-10">{label}</span>
    </Link>
  );
}
