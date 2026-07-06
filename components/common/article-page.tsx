import { type ReactNode } from "react";

import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";

interface ArticlePageProps {
  eyebrow?: string;
  title: string;
  intro?: string;
  children: ReactNode;
}

/** Consistent editorial wrapper for legal & informational pages. */
export function ArticlePage({
  eyebrow,
  title,
  intro,
  children,
}: ArticlePageProps) {
  return (
    <Container className="py-16 lg:py-24">
      <Reveal className="mx-auto max-w-3xl">
        {eyebrow ? <p className="eyebrow mb-4">{eyebrow}</p> : null}
        <h1 className="display-2">{title}</h1>
        {intro ? (
          <p className="mt-5 text-base leading-relaxed text-ink/60">{intro}</p>
        ) : null}
        <div className="mt-12 space-y-8 text-sm leading-relaxed text-ink/70 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tightest [&_h2]:text-ink [&_p]:mt-2">
          {children}
        </div>
      </Reveal>
    </Container>
  );
}
