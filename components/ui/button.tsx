import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "accent";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-bold tracking-wide transition-all duration-200 ease-premium select-none disabled:pointer-events-none disabled:opacity-40 hover:scale-105 active:scale-[0.98]";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-ink text-paper hover:bg-ink-soft shadow-sm",
  accent:
    "bg-accent text-ink hover:bg-accent-dark shadow-glow-sm hover:shadow-glow",
  secondary: "bg-paper-soft text-ink hover:bg-accent-muted border border-ink/[0.06]",
  outline:
    "border border-ink/15 text-ink hover:border-accent hover:bg-accent/10 hover:text-ink",
  ghost: "text-ink hover:bg-accent-muted",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-xs rounded-full",
  md: "h-12 px-6 text-sm rounded-full",
  lg: "h-14 px-8 text-sm rounded-full",
};

/** Reusable class builder so links can share the button look. */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, ...props }, ref) => (
    <button
      ref={ref}
      className={buttonClasses(variant, size, className)}
      {...props}
    />
  ),
);

Button.displayName = "Button";
