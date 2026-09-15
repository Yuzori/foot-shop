import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), ".data", "welcome-promo-claims.json");

interface WelcomePromoClaimsStore {
  identities: string[];
  ips: string[];
  records: Array<{
    at: string;
    identityHash: string;
    ipHash: string;
    reference?: string;
  }>;
}

async function readStore(): Promise<WelcomePromoClaimsStore> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const data = JSON.parse(raw) as WelcomePromoClaimsStore;
    return {
      identities: Array.isArray(data.identities) ? data.identities : [],
      ips: Array.isArray(data.ips) ? data.ips : [],
      records: Array.isArray(data.records) ? data.records : [],
    };
  } catch {
    return { identities: [], ips: [], records: [] };
  }
}

async function writeStore(store: WelcomePromoClaimsStore): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function isWelcomePromoIdentityClaimed(
  identityHash: string,
): Promise<boolean> {
  const key = identityHash.trim();
  if (!key) return false;
  const store = await readStore();
  return store.identities.includes(key);
}

export async function isWelcomePromoIpClaimed(ipHash: string): Promise<boolean> {
  const key = ipHash.trim();
  if (!key) return false;
  const store = await readStore();
  return store.ips.includes(key);
}

export async function claimWelcomePromoUsage(input: {
  identityHash: string;
  ipHash: string;
  reference?: string;
}): Promise<void> {
  const identityHash = input.identityHash.trim();
  const ipHash = input.ipHash.trim();
  if (!identityHash && !ipHash) return;

  const store = await readStore();
  if (identityHash && !store.identities.includes(identityHash)) {
    store.identities.push(identityHash);
  }
  if (ipHash && !store.ips.includes(ipHash)) {
    store.ips.push(ipHash);
  }
  store.records.unshift({
    at: new Date().toISOString(),
    identityHash,
    ipHash,
    reference: input.reference?.trim() || undefined,
  });
  store.records = store.records.slice(0, 5000);
  await writeStore(store);
}
