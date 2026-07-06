import { type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const inputClass =
  "h-12 w-full rounded-xl border border-ink/10 bg-paper px-4 text-sm text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink/30 focus:border-ink focus:ring-2 focus:ring-ink/5";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
}

/** Labeled text input. */
export function Field({ label, name, className, ...props }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={name} className="text-xs font-medium text-ink/60">
        {label}
        {props.required ? <span className="text-accent"> *</span> : null}
      </label>
      <input id={name} name={name} className={inputClass} {...props} />
    </div>
  );
}

interface TextareaFieldProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  name: string;
}

/** Labeled textarea. */
export function TextareaField({
  label,
  name,
  className,
  ...props
}: TextareaFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={name} className="text-xs font-medium text-ink/60">
        {label}
        {props.required ? <span className="text-accent"> *</span> : null}
      </label>
      <textarea
        id={name}
        name={name}
        className={cn(inputClass, "h-32 resize-none py-3")}
        {...props}
      />
    </div>
  );
}
