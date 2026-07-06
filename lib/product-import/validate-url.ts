import "server-only";

import { lookup } from "node:dns/promises";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
]);

export function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const a = parts[0]!;
  const b = parts[1]!;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export function isPrivateIpv6(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "::1" ||
    h.startsWith("fc") ||
    h.startsWith("fd") ||
    h.startsWith("fe80")
  );
}

function assertPublicHost(host: string): void {
  const normalized = host.toLowerCase();
  if (BLOCKED_HOSTS.has(normalized)) {
    throw new Error("Hôte non autorisé.");
  }
  if (isPrivateIpv4(normalized) || isPrivateIpv6(normalized)) {
    throw new Error("Les adresses réseau privées ne sont pas autorisées.");
  }
}

async function assertResolvablePublicHost(host: string): Promise<void> {
  assertPublicHost(host);
  const resolved = await lookup(host, { verbatim: true });
  const addr = resolved.address.toLowerCase();
  if (
    BLOCKED_HOSTS.has(addr) ||
    isPrivateIpv4(addr) ||
    isPrivateIpv6(addr)
  ) {
    throw new Error("L'URL résout vers une adresse non autorisée.");
  }
}

/** Valide une URL publique (protection SSRF basique). */
export async function validateSourceUrl(raw: string): Promise<URL> {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("URL requise.");

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("URL invalide.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Seules les URLs http/https sont acceptées.");
  }

  await assertResolvablePublicHost(url.hostname);
  return url;
}

/** Valide chaque redirection HTTP avant de suivre le lien. */
export async function validateRedirectUrl(
  location: string,
  base: URL,
): Promise<URL> {
  const next = new URL(location, base);
  return validateSourceUrl(next.toString());
}
