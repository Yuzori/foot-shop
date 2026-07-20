function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

/** true pour unisport.fr, unisportstore.fr et leurs sous-domaines. */
export function isUnisportProductUrl(url: string): boolean {
  try {
    const host = normalizeHost(new URL(url).hostname);
    return (
      host === "unisportstore.fr" ||
      host.endsWith(".unisportstore.fr") ||
      host === "unisport.fr" ||
      host.endsWith(".unisport.fr")
    );
  } catch {
    return false;
  }
}

export function listNonUnisportUrls(urls: readonly string[]): string[] {
  const seen = new Set<string>();
  const other: string[] = [];
  for (const url of urls) {
    if (!url || seen.has(url) || isUnisportProductUrl(url)) continue;
    seen.add(url);
    other.push(url);
  }
  return other;
}
