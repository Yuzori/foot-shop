"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { listNonUnisportUrls } from "@/lib/product-import/is-unisport-url";

export type BrokenLinkItem = { url: string; error: string };

function joinCopyableUrls(urls: readonly string[]): string {
  return urls.filter(Boolean).join("\r\n\r\n");
}

async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

function CopyButton({
  text,
  label = "Copier",
  compact = false,
}: {
  text: string;
  label?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  if (!text.trim()) return null;

  async function handleCopy() {
    await copyText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={compact ? "h-7 px-2 text-[10px]" : undefined}
      onClick={() => void handleCopy()}
    >
      {copied ? "Copié" : label}
    </Button>
  );
}

export function BrokenLinksPanel({ links }: { links: BrokenLinkItem[] }) {
  const allUrls = useMemo(() => joinCopyableUrls(links.map((item) => item.url)), [links]);

  if (!links.length) return null;

  return (
    <div className="rounded-2xl border border-accent/25 bg-accent/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            Liens en échec ({links.length})
          </h3>
          <p className="mt-1 text-xs text-ink/50">
            Page bloquée, produit introuvable ou aucune image. Copiez les URLs pour les
            corriger ou les traiter à part.
          </p>
        </div>
        <CopyButton text={allUrls} label="Copier tout" />
      </div>
      <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto">
        {links.map((item) => (
          <li
            key={`${item.url}:${item.error}`}
            className="rounded-xl border border-ink/8 bg-white/80 px-3 py-2 text-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 break-all font-medium text-accent underline-offset-2 hover:underline"
              >
                {item.url}
              </a>
              <CopyButton text={item.url} label="Copier" compact />
            </div>
            <p className="mt-1 text-ink/55">{item.error}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NonUnisportLinksNotice({ urls }: { urls: readonly string[] }) {
  const otherUrls = useMemo(() => listNonUnisportUrls(urls), [urls]);
  const allUrls = useMemo(() => joinCopyableUrls(otherUrls), [otherUrls]);

  if (!otherUrls.length) return null;

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            Liens hors Unisport ({otherUrls.length})
          </h3>
          <p className="mt-1 text-xs text-ink/55">
            Ces URLs ne viennent pas de unisportstore.fr — elles sont quand même analysées
            normalement.
          </p>
        </div>
        <CopyButton text={allUrls} label="Copier tout" />
      </div>
      <ul className="mt-3 max-h-40 space-y-1.5 overflow-y-auto text-xs text-ink/70">
        {otherUrls.map((url) => (
          <li key={url} className="flex items-start justify-between gap-2 rounded-lg bg-white/70 px-2 py-1.5">
            <span className="min-w-0 flex-1 break-all">{url}</span>
            <CopyButton text={url} label="Copier" compact />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ImportLinkAlerts({
  parsedUrls,
  brokenLinks = [],
}: {
  parsedUrls: readonly string[];
  brokenLinks?: BrokenLinkItem[];
}) {
  const hasBroken = brokenLinks.length > 0;
  const hasOther = listNonUnisportUrls(parsedUrls).length > 0;
  if (!hasBroken && !hasOther) return null;

  return (
    <div className="mt-4 space-y-3">
      {hasBroken ? <BrokenLinksPanel links={brokenLinks} /> : null}
      {hasOther ? <NonUnisportLinksNotice urls={parsedUrls} /> : null}
    </div>
  );
}
