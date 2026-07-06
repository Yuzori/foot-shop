import Link from "next/link";
import { type ReactNode } from "react";

import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: { label: string; href: string };
  className?: string;
}

/**
 * Elegant empty state, shown whenever the back office returns no data.
 * This is the project's answer to "never invent demo data".
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-24 text-center",
        className,
      )}
    >
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-paper-soft text-ink/40">
        {icon ?? <DefaultIcon />}
      </div>
      <h3 className="font-display text-xl font-semibold uppercase tracking-wide sm:text-2xl">
        {title}
      </h3>
      {description ? (
        <p className="mt-3 max-w-md text-balance text-sm leading-relaxed text-ink/55">
          {description}
        </p>
      ) : null}
      {action ? (
        <Link
          href={action.href}
          className={buttonClasses("primary", "md", "mt-8")}
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

function DefaultIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 7l9-4 9 4-9 4-9-4z" />
      <path d="M3 7v10l9 4 9-4V7" />
    </svg>
  );
}
