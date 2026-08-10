export const ADMIN_SECRET_KEY = "footshop-admin-secret";
export const VISITOR_SESSION_KEY = "footshop-visitor-id";

/** Session admin Bbdbuy active dans cet onglet (sessionStorage). */
export function isAdminSessionActive(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(sessionStorage.getItem(ADMIN_SECRET_KEY)?.trim());
}

/** Retire cette session des stats live (après connexion admin). */
export async function purgeVisitorFromLiveStats(): Promise<void> {
  if (typeof window === "undefined") return;
  const sessionId = sessionStorage.getItem(VISITOR_SESSION_KEY)?.trim();
  if (!sessionId) return;

  try {
    await fetch("/api/site/presence", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
  } catch {
    // ignore
  }
}
