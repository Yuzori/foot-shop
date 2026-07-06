import { type ElementType, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ContainerProps {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}

/** Centered max-width content wrapper used across the storefront. */
export function Container({
  children,
  className,
  as: Tag = "div",
}: ContainerProps) {
  return (
    <Tag className={cn("mx-auto w-full max-w-8xl px-5 sm:px-8 lg:px-10", className)}>
      {children}
    </Tag>
  );
}
