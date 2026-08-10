import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { purgeAllOrderArchives } from "@/lib/order-archive-store";
import { purgeAllShippingEntries } from "@/lib/order-shipping-store";
import { purgeAllSupplierDrafts } from "@/lib/supplier-order-store";

const FLAG_FILE = path.join(process.cwd(), ".data", ".order-admin-full-reset-v1");

/** Vide une fois historique, expéditions et brouillons BBDBuy (admin repart à zéro). */
export async function ensureAdminDataReset(): Promise<{ wiped: boolean }> {
  try {
    await fs.access(FLAG_FILE);
    return { wiped: false };
  } catch {
    await Promise.all([
      purgeAllOrderArchives(),
      purgeAllShippingEntries(),
      purgeAllSupplierDrafts(),
    ]);
    await fs.mkdir(path.dirname(FLAG_FILE), { recursive: true });
    await fs.writeFile(FLAG_FILE, new Date().toISOString(), "utf8");
    return { wiped: true };
  }
}
