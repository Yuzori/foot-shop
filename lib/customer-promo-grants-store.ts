import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { apologyPromo } from "@/config/promotions";
import { listOrderArchives } from "@/lib/order-archive-store";
import { prestashop } from "@/services/prestashop";

const FILE = path.join(process.cwd(), ".data", "customer-promo-grants.json");

interface GrantLists {
  customerIds: string[];
  emails: string[];
}

interface CustomerPromoGrantsStore {
  footshop10Revoked: GrantLists;
  footshop15Granted: GrantLists;
  footshop15Used: GrantLists;
}

function emptyLists(): GrantLists {
  return { customerIds: [], emails: [] };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function readStore(): Promise<CustomerPromoGrantsStore> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const data = JSON.parse(raw) as Partial<CustomerPromoGrantsStore>;
    return {
      footshop10Revoked: {
        customerIds: data.footshop10Revoked?.customerIds ?? [],
        emails: (data.footshop10Revoked?.emails ?? []).map(normalizeEmail),
      },
      footshop15Granted: {
        customerIds: data.footshop15Granted?.customerIds ?? [],
        emails: (data.footshop15Granted?.emails ?? []).map(normalizeEmail),
      },
      footshop15Used: {
        customerIds: data.footshop15Used?.customerIds ?? [],
        emails: (data.footshop15Used?.emails ?? []).map(normalizeEmail),
      },
    };
  } catch {
    return {
      footshop10Revoked: emptyLists(),
      footshop15Granted: emptyLists(),
      footshop15Used: emptyLists(),
    };
  }
}

async function writeStore(store: CustomerPromoGrantsStore): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(store, null, 2), "utf8");
}

function matchesGrantLists(
  lists: GrantLists,
  input: { customerId?: string | null; email?: string | null },
): boolean {
  const customerId = input.customerId?.trim() ?? "";
  const email = normalizeEmail(input.email ?? "");
  if (customerId && lists.customerIds.includes(customerId)) return true;
  if (email && lists.emails.includes(email)) return true;
  return false;
}

function pushGrant(
  lists: GrantLists,
  input: { customerId?: string | null; email?: string | null },
): void {
  const customerId = input.customerId?.trim() ?? "";
  const email = normalizeEmail(input.email ?? "");
  if (customerId && !lists.customerIds.includes(customerId)) {
    lists.customerIds.push(customerId);
  }
  if (email && !lists.emails.includes(email)) {
    lists.emails.push(email);
  }
}

export async function isFootshop10RevokedForCustomer(input: {
  customerId?: string | null;
  email?: string | null;
}): Promise<boolean> {
  const store = await readStore();
  return matchesGrantLists(store.footshop10Revoked, input);
}

export async function isFootshop15GrantedForCustomer(input: {
  customerId?: string | null;
  email?: string | null;
}): Promise<boolean> {
  const store = await readStore();
  return matchesGrantLists(store.footshop15Granted, input);
}

export async function hasUsedFootshop15Promo(input: {
  customerId?: string | null;
  email?: string | null;
}): Promise<boolean> {
  const store = await readStore();
  if (matchesGrantLists(store.footshop15Used, input)) return true;

  const customerId =
    input.customerId?.trim() ||
    (input.email
      ? (await prestashop.getCustomerAuthByEmail(input.email))?.id ?? ""
      : "");
  const email = normalizeEmail(input.email ?? "");
  const code = apologyPromo.code.toUpperCase();
  const archives = await listOrderArchives(2000);

  return archives.some((record) => {
    if (record.promoCode?.toUpperCase() !== code) return false;
    if (record.status !== "paid" && !record.paidAt) return false;
    if (customerId && record.customerId === customerId) return true;
    if (email && normalizeEmail(record.contact.email) === email) return true;
    return false;
  });
}

export async function grantFootshop15RevokeFootshop10(input: {
  customerId?: string | null;
  email?: string | null;
}): Promise<void> {
  const store = await readStore();
  pushGrant(store.footshop15Granted, input);
  pushGrant(store.footshop10Revoked, input);
  await writeStore(store);
}

export async function markFootshop15Used(input: {
  customerId?: string | null;
  email?: string | null;
}): Promise<void> {
  const store = await readStore();
  pushGrant(store.footshop15Used, input);
  await writeStore(store);
}
