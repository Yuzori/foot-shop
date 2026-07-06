import "server-only";

const buckets = new Map<string, { count: number; resetAt: number }>();

/** Limite simple par clé (IP + route). Retourne false si quota dépassé. */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip")?.trim() ?? "unknown";
}

export function rateLimitOrReject(
  request: Request,
  route: string,
  limit = 12,
  windowMs = 60_000,
): Response | null {
  const key = `${route}:${clientIp(request)}`;
  if (checkRateLimit(key, limit, windowMs)) return null;
  return new Response(JSON.stringify({ message: "Trop de requêtes. Réessayez plus tard." }), {
    status: 429,
    headers: { "Content-Type": "application/json" },
  });
}
