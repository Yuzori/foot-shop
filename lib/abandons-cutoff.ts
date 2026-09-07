import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { clearCheckoutAbandonsStore } from "@/lib/checkout-abandons-store";

const FILE = path.join(process.cwd(), ".data", "admin-abandons-cutoff.json");
const MIGRATION_V2 = path.join(process.cwd(), ".data", "stripe-admin-v2.migrated");

type CutoffFile = { since: string };

async function readCutoff(): Promise<CutoffFile | null> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as CutoffFile;
    if (parsed?.since) return parsed;
  } catch {
    /* fresh */
  }
  return null;
}

/** Date min. pour afficher un abandon (sessions Stripe + store local). */
export async function getAbandonsCutoffIso(): Promise<string> {
  const existing = await readCutoff();
  if (existing) return existing.since;

  const since = new Date().toISOString();
  await writeCutoff(since);
  return since;
}

async function writeCutoff(since: string): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify({ since }, null, 2), "utf8");
}

/** Vide les abandons affichés ; les prochains après `since` réapparaissent. */
export async function resetAbandonsCutoff(since?: string): Promise<string> {
  const iso = since ?? new Date().toISOString();
  await clearCheckoutAbandonsStore();
  await writeCutoff(iso);
  return iso;
}

/** Reset abandons au déploiement v2 (une seule fois). */
export async function ensureAbandonsResetV2(): Promise<void> {
  try {
    await fs.access(MIGRATION_V2);
    return;
  } catch {
    await resetAbandonsCutoff();
    await fs.mkdir(path.dirname(MIGRATION_V2), { recursive: true });
    await fs.writeFile(
      MIGRATION_V2,
      JSON.stringify({ resetAt: new Date().toISOString() }, null, 2),
      "utf8",
    );
  }
}
