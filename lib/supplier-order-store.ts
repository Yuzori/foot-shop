import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import type { BbdBuyOrderDraft } from "@/lib/bbdbuy/types";

const DATA_DIR = path.join(process.cwd(), ".data", "supplier-orders");

function fileFor(reference: string): string {
  const safe = reference.replace(/[^\w-]/g, "");
  return path.join(DATA_DIR, `${safe}.json`);
}

export async function saveSupplierOrderDraft(
  draft: BbdBuyOrderDraft,
): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(fileFor(draft.reference), JSON.stringify(draft, null, 2), "utf8");
}

export async function listSupplierOrderDrafts(): Promise<BbdBuyOrderDraft[]> {
  try {
    const files = await fs.readdir(DATA_DIR);
    const drafts: BbdBuyOrderDraft[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const raw = await fs.readFile(path.join(DATA_DIR, file), "utf8");
      drafts.push(JSON.parse(raw) as BbdBuyOrderDraft);
    }
    return drafts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function getSupplierOrderDraft(
  reference: string,
): Promise<BbdBuyOrderDraft | null> {
  try {
    const raw = await fs.readFile(fileFor(reference), "utf8");
    return JSON.parse(raw) as BbdBuyOrderDraft;
  } catch {
    return null;
  }
}

export async function markSupplierOrderSubmitted(
  reference: string,
): Promise<BbdBuyOrderDraft | null> {
  const draft = await getSupplierOrderDraft(reference);
  if (!draft) return null;
  draft.status = "submitted";
  await saveSupplierOrderDraft(draft);
  return draft;
}

export async function archiveSupplierOrderDraft(
  reference: string,
): Promise<BbdBuyOrderDraft | null> {
  const draft = await getSupplierOrderDraft(reference);
  if (!draft) return null;
  draft.status = "archived";
  await saveSupplierOrderDraft(draft);
  return draft;
}
