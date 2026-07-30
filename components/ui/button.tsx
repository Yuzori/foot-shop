import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from "react";

import { BRAND_BUTTON_BASE, brandButtonStyle, type BrandButtonTone } from "@/lib/brand-button";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "accent";
export type ButtonSize = "sm" | "md" | "lg";

const ghostBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-bold tracking-wide transition-all duration-300 ease-premium select-none hover:scale-105 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40";

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-xs",
  md: "h-12 px-6 text-sm",
  lg: "h-14 px-8 text-sm",
};

const toneClass: Record<Exclude<ButtonVariant, "ghost">, string> = {
  primary: "btn-brand",
  accent: "btn-brand",
  secondary: "btn-brand-subtle",
  outline: "btn-brand-subtle",
};

const toneByVariant: Record<Exclude<ButtonVariant, "ghost">, BrandButtonTone> = {
  primary: "brand",
  accent: "brand",
  secondary: "subtle",
  outline: "subtle",
};

/** Reusable class builder so links can share the button look. */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  if (variant === "ghost") {
    return cn(
      ghostBase,
      sizes[size],
      "text-ink hover:bg-accent-muted",
      className,
    );
  }
  return cn(BRAND_BUTTON_BASE, toneClass[variant], sizes[size], className);
}

export function buttonStyle(
  variant: ButtonVariant = "primary",
  style?: CSSProperties,
): CSSProperties | undefined {
  if (variant === "ghost") return style;
  return { ...brandButtonStyle(undefined, toneByVariant[variant]), ...style };
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, style, ...props }, ref) => (
    <button
      ref={ref}
      className={buttonClasses(variant, size, className)}
      style={style}
      {...props}
    />
  ),
);

Button.displayName = "Button";
