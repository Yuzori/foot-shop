import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), ".newsletter-subscribers.json");

export async function readGuestNewsletterEmails(): Promise<string[]> {
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
  const normalized = email.trim().toLowerCase();
  const all = await readGuestNewsletterEmails();
  if (all.includes(normalized)) return { added: false };
  all.push(normalized);
  await fs.writeFile(FILE, JSON.stringify(all, null, 2), "utf8");
  return { added: true };
}
