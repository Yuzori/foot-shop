import { cn } from "@/lib/utils";

const steps = [
  { id: "details", label: "Informations" },
  { id: "payment", label: "Paiement" },
] as const;

export function CheckoutSteps({ current }: { current: "details" | "payment" }) {
  const index = steps.findIndex((s) => s.id === current);

  return (
    <ol className="mb-10 flex items-center gap-2 sm:gap-3">
      {steps.map((step, i) => (
        <li key={step.id} className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors",
                i <= index ? "bg-accent text-ink shadow-glow-sm" : "bg-paper-soft text-ink/35",
              )}
            >
              {i + 1}
            </span>
            <span
              className={cn(
                "text-xs font-semibold uppercase tracking-wide",
                i === index ? "text-ink" : "text-ink/40",
              )}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 ? (
            <span
              className={cn(
                "hidden h-px w-8 sm:block sm:w-12",
                i < index ? "bg-accent/40" : "bg-ink/10",
              )}
              aria-hidden
            />
          ) : null}
        </li>
      ))}
    </ol>
  );
}
