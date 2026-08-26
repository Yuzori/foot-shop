import "server-only";

import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), ".data", "unisport-collect-tokens.json");
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

type TokenFile = Record<string, string>;

async function readFile(): Promise<TokenFile> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as TokenFile;
  } catch {
    return {};
  }
}

async function writeFile(data: TokenFile): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data, null, 2), "utf8");
}

function prune(data: TokenFile): TokenFile {
  const now = Date.now();
  const next: TokenFile = {};
  for (const [token, expiresAt] of Object.entries(data)) {
    if (Date.parse(expiresAt) > now) next[token] = expiresAt;
  }
  return next;
}

/** Crée un token bookmarklet (valide 30 jours). */
export async function issueUnisportCollectToken(): Promise<string> {
  const token = crypto.randomBytes(18).toString("base64url");
  const data = prune(await readFile());
  data[token] = new Date(Date.now() + TTL_MS).toISOString();
  await writeFile(data);
  return token;
}

export async function isValidUnisportCollectToken(token: string): Promise<boolean> {
  const trimmed = token.trim();
  if (!trimmed) return false;
  const data = prune(await readFile());
  const expiresAt = data[trimmed];
  if (!expiresAt) return false;
  if (Date.parse(expiresAt) <= Date.now()) return false;
  await writeFile(data);
  return true;
}
