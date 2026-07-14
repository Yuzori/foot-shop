import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const repoRoot = join(root, "..", "..");

function loadEnvLocal() {
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

function resolveApiOrigin(env) {
  const explicit = env.FIGMA_PLUGIN_API_ORIGIN?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const siteUrl = env.NEXT_PUBLIC_SITE_URL?.trim() || "https://foot-shop.fr";
  if (/localhost|127\.0\.0\.1/i.test(siteUrl)) {
    return "https://foot-shop.fr";
  }
  return siteUrl.replace(/\/$/, "");
}

function resolveApiOrigins(env) {
  const primary = resolveApiOrigin(env);
  const origins = [];
  const add = (value) => {
    const normalized = value.replace(/\/$/, "");
    if (normalized && !origins.includes(normalized)) origins.push(normalized);
  };

  add("https://foot-shop.onrender.com");
  add(primary);
  add("https://foot-shop.fr");
  add("https://www.foot-shop.fr");
  return origins;
}

export function getPluginConfig() {
  const env = loadEnvLocal();
  const apiOrigins = resolveApiOrigins(env);
  return {
    apiOrigin: apiOrigins[0],
    apiOrigins,
    adminSecret: env.ADMIN_SECRET?.trim() || "mdp",
    defaultCategoryId: env.PRODUCT_IMPORT_CATEGORY_ID?.trim() || "",
  };
}

async function fetchCategoriesSnapshot(apiOrigin, adminSecret) {
  const paths = ["/api/admin/product-import", "/api/admin/figma-import"];
  const headers = {
    Authorization: `Bearer ${adminSecret}`,
    "x-admin-secret": adminSecret,
  };

  for (const path of paths) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120_000);
      const res = await fetch(`${apiOrigin}${path}`, { headers, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;

      const data = await res.json();
      const categories = data.categories ?? [];
      if (!categories.length) continue;

      return {
        categories,
        defaultCategoryId: data.defaultCategoryId ?? "",
      };
    } catch {
      // try next endpoint
    }
  }

  return null;
}

export async function writePluginConfig() {
  const { apiOrigin, apiOrigins, adminSecret, defaultCategoryId } = getPluginConfig();
  const snapshot = await fetchCategoriesSnapshot(apiOrigin, adminSecret);

  const categories = snapshot?.categories ?? [];
  const resolvedDefault =
    snapshot?.defaultCategoryId || defaultCategoryId || categories[0]?.id || "";

  const contents = `// Généré par scripts/build.mjs — ne pas éditer à la main.
const PLUGIN_API_ORIGIN = ${JSON.stringify(apiOrigin)};
const PLUGIN_API_ORIGINS = ${JSON.stringify(apiOrigins)};
const PLUGIN_ADMIN_SECRET = ${JSON.stringify(adminSecret)};
const PLUGIN_CATEGORIES = ${JSON.stringify(categories)};
const PLUGIN_DEFAULT_CATEGORY_ID = ${JSON.stringify(resolvedDefault)};
`;

  writeFileSync(join(root, "src/plugin-config.js"), contents, "utf8");
  console.log(
    `Plugin config → ${apiOrigin}${categories.length ? ` (${categories.length} catégories en cache)` : " (pas de cache catégories)"}`,
  );
  return { apiOrigin, apiOrigins, adminSecret, categories, defaultCategoryId: resolvedDefault };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  await writePluginConfig();
}
