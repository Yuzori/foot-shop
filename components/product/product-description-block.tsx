"use client";

import { useState } from "react";

import { stripHtml } from "@/lib/utils";

interface ProductDescriptionBlockProps {
  summary: string;
  descriptionHtml: string;
}

/** Description sous les images + caractéristiques extensibles. */
export function ProductDescriptionBlock({
  summary,
  descriptionHtml,
}: ProductDescriptionBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const plain = stripHtml(descriptionHtml);
  const hasLong = plain.length > 180;

  if (!summary && !plain) return null;

  return (
    <div className="mt-8 border-t border-ink/8 pt-8">
      <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-ink/45">
        Description
      </h2>

      {summary ? (
        <p className="mt-4 text-sm leading-relaxed text-ink/70">{summary}</p>
      ) : null}

      {plain ? (
        <div className="mt-4">
          <div
            className={`text-sm leading-relaxed text-ink/65 [&_p]:mb-3 ${
              !expanded && hasLong ? "line-clamp-4" : ""
            }`}
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
          {hasLong ? (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-4 text-xs font-bold uppercase tracking-wide text-accent hover:underline"
            >
              {expanded ? "Voir moins" : "Voir plus de caractéristiques"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
