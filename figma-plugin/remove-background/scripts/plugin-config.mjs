import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..");

export function loadEnvLocal() {
  const path = join(repoRoot, ".env.local");
  if (!existsSync(path)) return {};

  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

export function getRemoveBgKeys(env = loadEnvLocal()) {
  return (env.REMOVEBG_API_KEYS ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
}
