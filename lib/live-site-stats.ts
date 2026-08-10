/** Sessions visiteurs actives (heartbeat client). Mémoire process — suffisant pour le VPS mono-instance. */

export type LiveVisitorSession = {
  id: string;
  lastSeen: number;
  cartLines: number;
  cartItems: number;
  pathname: string;
};

export type LiveSiteStats = {
  activeVisitors: number;
  cartsWithItems: number;
  totalCartLines: number;
  totalCartItems: number;
  updatedAt: string;
};

const TTL_MS = 90_000;

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

export function recordLivePresence(input: {
  sessionId: string;
  cartLines: number;
  cartItems: number;
  pathname?: string;
}): void {
  const store = getStore();
  store.set(input.sessionId, {
    id: input.sessionId,
    lastSeen: Date.now(),
    cartLines: Math.max(0, input.cartLines),
    cartItems: Math.max(0, input.cartItems),
    pathname: input.pathname?.trim() || "/",
  });
  prune(store);
}

export function getLiveSiteStats(): LiveSiteStats {
  const store = getStore();
  prune(store);
  const active = [...store.values()];
  const withItems = active.filter((s) => s.cartLines > 0);

  return {
    activeVisitors: active.length,
    cartsWithItems: withItems.length,
    totalCartLines: withItems.reduce((sum, s) => sum + s.cartLines, 0),
    totalCartItems: withItems.reduce((sum, s) => sum + s.cartItems, 0),
    updatedAt: new Date().toISOString(),
  };
}
