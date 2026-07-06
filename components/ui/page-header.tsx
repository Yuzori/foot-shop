import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}

/** En-tête de page cohérent sur tout le site. */
export function PageHeader({
  eyebrow,
  title,
  description,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("mb-10 max-w-2xl", className)}>
      {eyebrow ? <p className="eyebrow mb-3">{eyebrow}</p> : null}
      <h1 className="display-2">{title}</h1>
      {description ? (
        <p className="mt-3 text-sm leading-relaxed text-ink/55">{description}</p>
      ) : null}
    </header>
  );
}
