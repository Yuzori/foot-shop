import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import type { ScrapedStudioProduct } from "@/lib/jersey-studio/scrape-batch";

const DATA_DIR = path.join(process.cwd(), ".data", "pending-unisport-scrapes");
const TTL_MS = 2 * 60 * 60 * 1000;
const MAX_PER_ADMIN = 80;

type PendingEntry = ScrapedStudioProduct & { queuedAt: string };

function adminKey(adminSecret: string): string {
  return crypto.createHash("sha256").update(adminSecret).digest("hex").slice(0, 24);
}

function fileForSecret(adminSecret: string): string {
  return path.join(DATA_DIR, `${adminKey(adminSecret)}.json`);
}

async function readEntries(adminSecret: string): Promise<PendingEntry[]> {
  try {
    const raw = await fs.readFile(fileForSecret(adminSecret), "utf8");
    const parsed = JSON.parse(raw) as PendingEntry[];
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - TTL_MS;
    return parsed.filter((entry) => {
      const ts = Date.parse(entry.queuedAt);
      return Number.isFinite(ts) && ts >= cutoff;
    });
  } catch {
    return [];
  }
}

async function writeEntries(adminSecret: string, entries: PendingEntry[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(fileForSecret(adminSecret), JSON.stringify(entries, null, 2), "utf8");
}

export async function queueUnisportClientScrape(
  adminSecret: string,
  product: ScrapedStudioProduct,
): Promise<void> {
  const entries = await readEntries(adminSecret);
  const next: PendingEntry = { ...product, queuedAt: new Date().toISOString() };
  const filtered = entries.filter((entry) => entry.sourceUrl !== product.sourceUrl);
  filtered.push(next);
  await writeEntries(adminSecret, filtered.slice(-MAX_PER_ADMIN));
}

export async function drainUnisportClientScrapes(
  adminSecret: string,
): Promise<ScrapedStudioProduct[]> {
  const entries = await readEntries(adminSecret);
  await writeEntries(adminSecret, []);
  return entries.map(({ queuedAt: _queuedAt, ...product }) => product);
}

export async function listUnisportClientScrapes(
  adminSecret: string,
): Promise<ScrapedStudioProduct[]> {
  const entries = await readEntries(adminSecret);
  return entries.map(({ queuedAt: _queuedAt, ...product }) => product);
}
