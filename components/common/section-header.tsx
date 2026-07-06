import Link from "next/link";

import { ArrowIcon } from "@/components/layout/icons";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  link?: { label: string; href: string };
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  link,
  className,
}: SectionHeaderProps) {
  return (
    <Reveal
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div>
        {eyebrow ? <p className="eyebrow mb-3">{eyebrow}</p> : null}
        <h2 className="display-2">{title}</h2>
        {description ? (
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink/55">
            {description}
          </p>
        ) : null}
      </div>
      {link ? (
        <Link
          href={link.href}
          className="group inline-flex items-center gap-2 text-sm font-medium text-ink"
        >
          {link.label}
          <ArrowIcon className="transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      ) : null}
    </Reveal>
  );
}
