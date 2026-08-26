function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

/** true pour unisport.fr, unisportstore.* et leurs sous-domaines. */
export function isUnisportProductUrl(url: string): boolean {
  try {
    const host = normalizeHost(new URL(url).hostname);
    if (host === "unisport.fr" || host.endsWith(".unisport.fr")) return true;
    if (host === "unisportstore.fr" || host.endsWith(".unisportstore.fr")) return true;
    if (/^unisportstore\.[a-z]{2,}$/.test(host)) return true;
    if (/\.unisportstore\.[a-z]{2,}$/.test(host)) return true;
    return false;
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
