import { cn } from "@/lib/utils";

/** Minimal accessible loading spinner. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Chargement"
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-ink/15 border-t-ink",
        className,
      )}
    />
  );
}
