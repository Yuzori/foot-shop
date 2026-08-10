import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "live-site-analytics.json");
const TZ = "Europe/Paris";
const FLUSH_MS = 3_000;

/** Enregistrement journalier compact par session visiteur. */
type SessionDayRecord = {
  /** Au moins un article en panier ce jour-là. */
  h: boolean;
  /** Max articles en panier (quantités). */
  m: number;
  /** Max lignes panier distinctes. */
  l: number;
};

type AnalyticsFile = {
  v: 1;
  since: string;
  days: Record<string, Record<string, SessionDayRecord>>;
};

import type { RecapPeriod, SiteStatsRecap } from "@/lib/live-site-stats-types";

const PERIOD_LABELS: Record<RecapPeriod, string> = {
  day: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois",
  year: "Cette année",
  all: "Depuis le début",
};

function emptyFile(): AnalyticsFile {
  return { v: 1, since: new Date().toISOString(), days: {} };
}

function parisDayKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parisWeekdayIndex(date = new Date()): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  return map[wd] ?? 0;
}

function shiftParisDayKey(key: string, deltaDays: number): string {
  const parts = key.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const utc = new Date(Date.UTC(y, m - 1, d + deltaDays, 12));
  return parisDayKey(utc);
}

function dayKeysForPeriod(period: RecapPeriod): { from: string; to: string; keys: string[] } {
  const today = parisDayKey();

  if (period === "day") {
    return { from: today, to: today, keys: [today] };
  }

  if (period === "week") {
    const mondayOffset = parisWeekdayIndex();
    const from = shiftParisDayKey(today, -mondayOffset);
    const keys: string[] = [];
    for (let i = 0; i <= mondayOffset; i++) {
      keys.push(shiftParisDayKey(from, i));
    }
    return { from, to: today, keys };
  }

  if (period === "month") {
    const [y, m] = today.split("-");
    const from = `${y}-${m}-01`;
    const keys: string[] = [];
    let cursor = from;
    while (cursor <= today) {
      keys.push(cursor);
      cursor = shiftParisDayKey(cursor, 1);
    }
    return { from, to: today, keys };
  }

  if (period === "year") {
    const y = today.slice(0, 4);
    const from = `${y}-01-01`;
    const keys: string[] = [];
    let cursor = from;
    while (cursor <= today) {
      keys.push(cursor);
      cursor = shiftParisDayKey(cursor, 1);
    }
    return { from, to: today, keys };
  }

  return { from: "", to: today, keys: [] };
}

function getStore(): AnalyticsFile {
  const g = globalThis as typeof globalThis & {
    __footshopLiveAnalytics?: AnalyticsFile;
    __footshopLiveAnalyticsDirty?: boolean;
    __footshopLiveAnalyticsFlushTimer?: ReturnType<typeof setTimeout>;
    __footshopLiveAnalyticsLoaded?: boolean;
  };

  if (!g.__footshopLiveAnalytics) {
    g.__footshopLiveAnalytics = emptyFile();
  }
  return g.__footshopLiveAnalytics;
}

async function loadStoreFromDisk(): Promise<void> {
  const g = globalThis as typeof globalThis & {
    __footshopLiveAnalytics?: AnalyticsFile;
    __footshopLiveAnalyticsLoaded?: boolean;
  };
  if (g.__footshopLiveAnalyticsLoaded) return;

  try {
    const raw = await fs.readFile(FILE, "utf8");
    const data = JSON.parse(raw) as AnalyticsFile;
    g.__footshopLiveAnalytics = {
      v: 1,
      since: data.since ?? new Date().toISOString(),
      days: data.days ?? {},
    };
  } catch {
    g.__footshopLiveAnalytics = emptyFile();
  }
  g.__footshopLiveAnalyticsLoaded = true;
}

function scheduleFlush(): void {
  const g = globalThis as typeof globalThis & {
    __footshopLiveAnalyticsDirty?: boolean;
    __footshopLiveAnalyticsFlushTimer?: ReturnType<typeof setTimeout>;
  };
  g.__footshopLiveAnalyticsDirty = true;
  if (g.__footshopLiveAnalyticsFlushTimer) return;

  g.__footshopLiveAnalyticsFlushTimer = setTimeout(() => {
    g.__footshopLiveAnalyticsFlushTimer = undefined;
    void flushStore().catch(() => {});
  }, FLUSH_MS);
}

async function flushStore(): Promise<void> {
  const g = globalThis as typeof globalThis & {
    __footshopLiveAnalytics?: AnalyticsFile;
    __footshopLiveAnalyticsDirty?: boolean;
  };
  if (!g.__footshopLiveAnalyticsDirty || !g.__footshopLiveAnalytics) return;

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(
    FILE,
    JSON.stringify(g.__footshopLiveAnalytics, null, 2),
    "utf8",
  );
  g.__footshopLiveAnalyticsDirty = false;
}

/** Met à jour les agrégats journaliers (appelé à chaque heartbeat). */
export function recordAnalyticsPresence(input: {
  sessionId: string;
  cartLines: number;
  cartItems: number;
}): void {
  const store = getStore();
  const day = parisDayKey();
  const sessions = store.days[day] ?? {};
  const prev = sessions[input.sessionId];
  const hadCart = input.cartLines > 0;

  sessions[input.sessionId] = {
    h: prev?.h || hadCart,
    m: Math.max(prev?.m ?? 0, input.cartItems),
    l: Math.max(prev?.l ?? 0, input.cartLines),
  };
  store.days[day] = sessions;
  scheduleFlush();
}

function aggregateSessions(
  store: AnalyticsFile,
  dayKeys: string[],
): Omit<SiteStatsRecap, "period" | "label" | "from" | "to"> {
  const merged = new Map<string, SessionDayRecord>();

  const keys =
    dayKeys.length > 0 ? dayKeys : Object.keys(store.days).sort();

  for (const day of keys) {
    const sessions = store.days[day];
    if (!sessions) continue;
    for (const [sessionId, record] of Object.entries(sessions)) {
      const prev = merged.get(sessionId);
      merged.set(sessionId, {
        h: prev?.h || record.h,
        m: Math.max(prev?.m ?? 0, record.m),
        l: Math.max(prev?.l ?? 0, record.l),
      });
    }
  }

  const values = [...merged.values()];
  const withCart = values.filter((r) => r.h);

  return {
    uniqueVisitors: values.length,
    visitorsWithCart: withCart.length,
    totalCartItems: withCart.reduce((sum, r) => sum + r.m, 0),
    totalCartLines: withCart.reduce((sum, r) => sum + r.l, 0),
  };
}

export async function getSiteStatsRecap(period: RecapPeriod): Promise<SiteStatsRecap> {
  await loadStoreFromDisk();
  const store = getStore();
  const range = dayKeysForPeriod(period);
  const stats = aggregateSessions(store, range.keys);

  const from =
    period === "all"
      ? (store.since.slice(0, 10) || parisDayKey())
      : range.from;
  const to = range.to || parisDayKey();

  return {
    period,
    label: PERIOD_LABELS[period],
    from,
    to,
    ...stats,
  };
}

export function isRecapPeriod(value: string | null): value is RecapPeriod {
  return (
    value === "day" ||
    value === "week" ||
    value === "month" ||
    value === "year" ||
    value === "all"
  );
}

export async function resetSiteAnalytics(): Promise<void> {
  await loadStoreFromDisk();
  const g = globalThis as typeof globalThis & {
    __footshopLiveAnalytics?: AnalyticsFile;
    __footshopLiveAnalyticsDirty?: boolean;
    __footshopLiveAnalyticsFlushTimer?: ReturnType<typeof setTimeout>;
  };

  const fresh = emptyFile();
  g.__footshopLiveAnalytics = fresh;
  g.__footshopLiveAnalyticsDirty = false;

  if (g.__footshopLiveAnalyticsFlushTimer) {
    clearTimeout(g.__footshopLiveAnalyticsFlushTimer);
    g.__footshopLiveAnalyticsFlushTimer = undefined;
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(fresh, null, 2), "utf8");
}
