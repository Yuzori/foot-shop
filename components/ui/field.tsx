import { type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const inputClass =
  "h-12 w-full rounded-xl border border-ink/10 bg-paper px-4 text-sm text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink/30 focus:border-ink focus:ring-2 focus:ring-ink/5";

const inputInvalidClass =
  "border-accent ring-2 ring-accent/15 focus:border-accent focus:ring-accent/20";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  error?: string | null;
  invalid?: boolean;
}

/** Labeled text input. */
export function Field({
  label,
  name,
  className,
  error,
  invalid,
  ...props
}: FieldProps) {
  const showInvalid = Boolean(invalid || error);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={name} className="text-xs font-medium text-ink/60">
        {label}
        {props.required ? <span className="text-accent"> *</span> : null}
      </label>
      <input
        id={name}
        name={name}
        className={cn(inputClass, showInvalid && inputInvalidClass)}
        aria-invalid={showInvalid || undefined}
        {...props}
      />
      {error ? (
        <p className="text-xs text-accent" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface TextareaFieldProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  name: string;
  error?: string | null;
  invalid?: boolean;
}

/** Labeled textarea. */
export function TextareaField({
  label,
  name,
  className,
  error,
  invalid,
  ...props
}: TextareaFieldProps) {
  const showInvalid = Boolean(invalid || error);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={name} className="text-xs font-medium text-ink/60">
        {label}
        {props.required ? <span className="text-accent"> *</span> : null}
      </label>
      <textarea
        id={name}
        name={name}
        className={cn(inputClass, "h-32 resize-none py-3", showInvalid && inputInvalidClass)}
        aria-invalid={showInvalid || undefined}
        {...props}
      />
      {error ? (
        <p className="text-xs text-accent" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
