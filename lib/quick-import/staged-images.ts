import "server-only";

import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), ".data", "quick-import-staging");
const TTL_MS = 24 * 60 * 60 * 1000;

type StagedMeta = {
  mimeType: string;
  savedAt: number;
};

function metaPath(id: string): string {
  return path.join(DIR, `${id}.meta.json`);
}

function binPath(id: string): string {
  return path.join(DIR, `${id}.bin`);
}

function isValidId(id: string): boolean {
  return /^[a-f0-9]{24}$/.test(id);
}

async function pruneExpired(): Promise<void> {
  try {
    const entries = await fs.readdir(DIR);
    const cutoff = Date.now() - TTL_MS;
    for (const entry of entries) {
      if (!entry.endsWith(".meta.json")) continue;
      const id = entry.replace(/\.meta\.json$/, "");
      try {
        const meta = JSON.parse(await fs.readFile(metaPath(id), "utf8")) as StagedMeta;
        if (meta.savedAt < cutoff) {
          await fs.rm(metaPath(id), { force: true });
          await fs.rm(binPath(id), { force: true });
        }
      } catch {
        await fs.rm(metaPath(id), { force: true });
        await fs.rm(binPath(id), { force: true });
      }
    }
  } catch {
    // ignore
  }
}

export async function saveStagedQuickImportImage(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  await pruneExpired();
  await fs.mkdir(DIR, { recursive: true });

  const id = crypto.randomBytes(12).toString("hex");
  const meta: StagedMeta = {
    mimeType: mimeType || "image/jpeg",
    savedAt: Date.now(),
  };
  await fs.writeFile(metaPath(id), JSON.stringify(meta), "utf8");
  await fs.writeFile(binPath(id), buffer);
  return id;
}

export async function loadStagedQuickImportImage(
  id: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!isValidId(id)) return null;
  try {
    const meta = JSON.parse(await fs.readFile(metaPath(id), "utf8")) as StagedMeta;
    const buffer = await fs.readFile(binPath(id));
    return { buffer, mimeType: meta.mimeType || "image/jpeg" };
  } catch {
    return null;
  }
}

export async function deleteStagedQuickImportImages(ids: string[]): Promise<void> {
  for (const id of ids) {
    if (!isValidId(id)) continue;
    await fs.rm(metaPath(id), { force: true });
    await fs.rm(binPath(id), { force: true });
  }
}

export async function loadStagedQuickImportImages(
  ids: string[],
): Promise<{ buffer: Buffer; mimeType: string }[]> {
  const loaded: { buffer: Buffer; mimeType: string }[] = [];
  for (const id of ids) {
    const image = await loadStagedQuickImportImage(id);
    if (!image) throw new Error(`Image temporaire introuvable (${id}).`);
    loaded.push(image);
  }
  return loaded;
}
