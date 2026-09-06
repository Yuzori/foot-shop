import { recordAnalyticsPresence } from "@/lib/live-site-analytics";
import type { LiveActiveCart, LiveCartProduct, LiveSiteStats } from "@/lib/live-site-stats-types";

/** Sessions visiteurs actives (heartbeat client). Mémoire process - suffisant pour le VPS mono-instance. */

export type LiveVisitorSession = {
  id: string;
  lastSeen: number;
  cartLines: number;
  cartItems: number;
  pathname: string;
  displayName: string;
  products: LiveCartProduct[];
};

const TTL_MS = 45_000;
const MAX_PRODUCTS = 24;
const MAX_NAME_LEN = 120;

type Store = Map<string, LiveVisitorSession>;

function getStore(): Store {
  const g = globalThis as typeof globalThis & {
    __footshopLiveSessions?: Store;
  };
  if (!g.__footshopLiveSessions) {
    g.__footshopLiveSessions = new Map();
  }
  return g.__footshopLiveSessions;
}

function prune(store: Store) {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, session] of store) {
    if (session.lastSeen < cutoff) store.delete(id);
  }
}

function sanitizeProducts(products: LiveCartProduct[] | undefined): LiveCartProduct[] {
  if (!Array.isArray(products)) return [];
  return products
    .slice(0, MAX_PRODUCTS)
    .map((item) => ({
      name: String(item.name ?? "Article").trim().slice(0, MAX_NAME_LEN) || "Article",
      quantity: Math.max(1, Math.min(99, Number(item.quantity) || 1)),
      optionsLabel: item.optionsLabel?.trim().slice(0, 80) || undefined,
    }))
    .filter((item) => item.name);
}

function sanitizeDisplayName(name: string | undefined): string {
  const trimmed = String(name ?? "").trim().slice(0, 80);
  return trimmed || "User";
}

export function recordLivePresence(input: {
  sessionId: string;
  cartLines: number;
  cartItems: number;
  pathname?: string;
  displayName?: string;
  products?: LiveCartProduct[];
}): void {
  const products = sanitizeProducts(input.products);
  const cartLines = products.length > 0 ? products.length : Math.max(0, input.cartLines);
  const cartItems =
    products.length > 0
      ? products.reduce((sum, line) => sum + line.quantity, 0)
      : Math.max(0, input.cartItems);

  const store = getStore();
  store.set(input.sessionId, {
    id: input.sessionId,
    lastSeen: Date.now(),
    cartLines,
    cartItems,
    pathname: input.pathname?.trim() || "/",
    displayName: sanitizeDisplayName(input.displayName),
    products,
  });
  recordAnalyticsPresence({
    sessionId: input.sessionId,
    cartLines,
    cartItems,
  });
  prune(store);
}

export function removeLiveSession(sessionId: string): void {
  getStore().delete(sessionId.trim());
}

export function clearLiveSessions(): void {
  getStore().clear();
}

export function getLiveSiteStats(): LiveSiteStats {
  const store = getStore();
  prune(store);
  const active = [...store.values()];
  const withItems = active.filter((s) => s.cartLines > 0);
  const now = new Date().toISOString();

  const activeCarts: LiveActiveCart[] = withItems
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .map((session) => ({
      sessionId: session.id,
      displayName: session.displayName,
      pathname: session.pathname,
      products: session.products,
      updatedAt: new Date(session.lastSeen).toISOString(),
    }));

  return {
    activeVisitors: active.length,
    cartsWithItems: withItems.length,
    totalCartLines: withItems.reduce((sum, s) => sum + s.cartLines, 0),
    totalCartItems: withItems.reduce((sum, s) => sum + s.cartItems, 0),
    activeCarts,
    updatedAt: now,
  };
}

export type { LiveSiteStats } from "@/lib/live-site-stats-types";
