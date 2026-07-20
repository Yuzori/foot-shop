"use client";

import { Button } from "@/components/ui/button";

export type PushFailureItem = {
  id: string;
  index: number;
  name: string;
  error?: string;
};

export function PushFailuresAlert({
  failures,
  busy,
  onRetry,
  scrollTargetId,
}: {
  failures: PushFailureItem[];
  busy?: boolean;
  onRetry?: () => void;
  scrollTargetId?: (id: string) => string;
}) {
  if (!failures.length) return null;

  return (
    <div className="mt-4 rounded-2xl border-2 border-accent/40 bg-accent/[0.06] p-4">
      <h3 className="text-sm font-semibold text-accent">
        {failures.length} envoi{failures.length > 1 ? "s" : ""} en échec
      </h3>
      <p className="mt-1 text-xs text-ink/55">
        Produits non envoyés sur PrestaShop — détail ci-dessous. Les cartes concernées sont
        surlignées en rouge dans la liste.
      </p>
      <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
        {failures.map((item) => {
          const targetId = scrollTargetId?.(item.id) ?? item.id;
          return (
            <li
              key={item.id}
              className="rounded-xl border border-accent/25 bg-white/90 px-3 py-2 text-xs"
            >
              <button
                type="button"
                className="text-left font-semibold text-ink underline-offset-2 hover:underline"
                onClick={() =>
                  document.getElementById(targetId)?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  })
                }
              >
                #{item.index} — {item.name}
              </button>
              {item.error ? (
                <p className="mt-1 text-accent">{item.error}</p>
              ) : (
                <p className="mt-1 text-ink/45">Erreur inconnue</p>
              )}
            </li>
          );
        })}
      </ul>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          className="mt-3 border-accent/40 text-accent hover:bg-accent/10"
          disabled={busy}
          onClick={onRetry}
        >
          Réessayer uniquement les {failures.length} échec
          {failures.length > 1 ? "s" : ""}
        </Button>
      ) : null}
    </div>
  );
}
