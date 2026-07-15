import "server-only";

/** Cookie jar par hôte — persiste entre requêtes d'une même importation. */
const jars = new Map<string, Map<string, string>>();

function jarForHost(host: string): Map<string, string> {
  const key = host.toLowerCase();
  let jar = jars.get(key);
  if (!jar) {
    jar = new Map();
    jars.set(key, jar);
  }
  return jar;
}

function parseSetCookieLine(line: string): { name: string; value: string } | null {
  const part = line.split(";")[0]?.trim();
  if (!part || !part.includes("=")) return null;
  const eq = part.indexOf("=");
  const name = part.slice(0, eq).trim();
  const value = part.slice(eq + 1).trim();
  if (!name) return null;
  return { name, value };
}

export function storeResponseCookies(url: URL, response: Response): void {
  const jar = jarForHost(url.host);
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  const lines: string[] =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : (() => {
          const raw = response.headers.get("set-cookie");
          return raw ? [raw] : [];
        })();

  for (const line of lines) {
    const parsed = parseSetCookieLine(line);
    if (!parsed) continue;
    if (parsed.value === "" || /^deleted$/i.test(parsed.value)) {
      jar.delete(parsed.name);
    } else {
      jar.set(parsed.name, parsed.value);
    }
  }
}

export function cookieHeaderForUrl(url: URL): string | undefined {
  const jar = jarForHost(url.host);
  if (jar.size === 0) return undefined;
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

export function clearFetchSession(): void {
  jars.clear();
}
