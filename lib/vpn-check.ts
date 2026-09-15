import "server-only";

type VpnCacheEntry = { blocked: boolean; expiresAt: number };

const cache = new Map<string, VpnCacheEntry>();
const CACHE_MS = 60 * 60 * 1000;

function isPrivateIp(ip: string): boolean {
  const value = ip.trim().toLowerCase();
  return (
    !value ||
    value === "unknown" ||
    value === "::1" ||
    value.startsWith("127.") ||
    value.startsWith("10.") ||
    value.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(value)
  );
}

/** Détecte VPN / proxy public (ip-api.com). N'inclut pas les hébergeurs (évite les faux positifs). */
export async function isVpnOrProxyIp(ip: string): Promise<boolean> {
  if (isPrivateIp(ip)) return false;

  const cached = cache.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.blocked;
  }

  let blocked = false;
  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,proxy`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as {
        status?: string;
        proxy?: boolean;
      };
      blocked = data.status === "success" && Boolean(data.proxy);
    }
  } catch {
    blocked = false;
  }

  cache.set(ip, { blocked, expiresAt: Date.now() + CACHE_MS });
  return blocked;
}
