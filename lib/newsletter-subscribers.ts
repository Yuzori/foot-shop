import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), ".data", "newsletter-subscribers.json");
const LEGACY_FILE = path.join(process.cwd(), ".newsletter-subscribers.json");

async function ensureMigrated(): Promise<void> {
  try {
    await fs.access(FILE);
    return;
  } catch {
    /* new file missing */
  }

  try {
    const legacy = await fs.readFile(LEGACY_FILE, "utf8");
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, legacy, "utf8");
    await fs.unlink(LEGACY_FILE).catch(() => {});
  } catch {
    /* no legacy file */
  }
}

export async function readGuestNewsletterEmails(): Promise<string[]> {
  await ensureMigrated();
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const list = JSON.parse(raw) as string[];
    return [...new Set(list.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  } catch {
    return [];
  }
}

export async function addGuestNewsletterEmail(
  email: string,
): Promise<{ added: boolean }> {
  await ensureMigrated();
  const normalized = email.trim().toLowerCase();
  const all = await readGuestNewsletterEmails();
  if (all.includes(normalized)) return { added: false };
  all.push(normalized);
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(all, null, 2), "utf8");
  return { added: true };
}

export async function removeGuestNewsletterEmail(email: string): Promise<void> {
  await ensureMigrated();
  const normalized = email.trim().toLowerCase();
  const all = (await readGuestNewsletterEmails()).filter((e) => e !== normalized);
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(all, null, 2), "utf8");
}
