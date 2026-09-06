import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

const DISMISSALS_FILE = path.join(
  process.cwd(),
  ".data",
  "order-admin-dismissals.json",
);

interface DismissalRecord {
  reference: string;
  reason: "deleted" | "archived";
  at: string;
}

async function readDismissals(): Promise<DismissalRecord[]> {
  try {
    const raw = await fs.readFile(DISMISSALS_FILE, "utf8");
    const parsed = JSON.parse(raw) as DismissalRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeDismissals(records: DismissalRecord[]): Promise<void> {
  await fs.mkdir(path.dirname(DISMISSALS_FILE), { recursive: true });
  await fs.writeFile(DISMISSALS_FILE, JSON.stringify(records, null, 2), "utf8");
}

/** Exclut une commande de la récupération auto (suppression / archivage admin). */
export async function dismissOrderFromAdminRecovery(
  reference: string,
  reason: "deleted" | "archived",
): Promise<void> {
  const ref = reference.trim();
  if (!ref) return;

  const records = await readDismissals();
  const existing = records.findIndex((item) => item.reference === ref);
  const entry: DismissalRecord = {
    reference: ref,
    reason,
    at: new Date().toISOString(),
  };
  if (existing >= 0) {
    records[existing] = entry;
  } else {
    records.push(entry);
  }
  await writeDismissals(records);
}

export async function isOrderDismissedFromRecovery(
  reference: string,
): Promise<boolean> {
  const ref = reference.trim();
  if (!ref) return false;
  const records = await readDismissals();
  return records.some((item) => item.reference === ref);
}

export async function clearOrderDismissal(reference: string): Promise<void> {
  const ref = reference.trim();
  if (!ref) return;
  const records = await readDismissals();
  await writeDismissals(records.filter((item) => item.reference !== ref));
}
