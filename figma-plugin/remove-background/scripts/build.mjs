import * as esbuild from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writePluginConfig } from "./plugin-config.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const watch = process.argv.includes("--watch");

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderCategoryOptions(categories, defaultCategoryId) {
  if (!categories.length) {
    return '<option value="">Aucune catégorie — clique ↻</option>';
  }

  return categories
    .map((category) => {
      const selected = String(category.id) === String(defaultCategoryId) ? " selected" : "";
      return `<option value="${escapeHtml(String(category.id))}"${selected}>${escapeHtml(category.name)}</option>`;
    })
    .join("");
}

function writeUiHtml(categories, defaultCategoryId, uiJs) {
  const safeJs = uiJs.replace(/<\/script/gi, "<\\/script");
  const uiHtml = readFileSync(join(root, "src/ui.html"), "utf8")
    .replace("<!-- CATEGORY_OPTIONS -->", renderCategoryOptions(categories, defaultCategoryId))
    .replace("<!-- INLINE_UI_JS -->", `<script>\n${safeJs}\n</script>`);

  writeFileSync(join(root, "ui.html"), uiHtml, "utf8");
}

const { apiOrigin, apiOrigins, adminSecret, categories, defaultCategoryId } =
  await writePluginConfig();

const uiEntry = join(root, "src", "ui-entry.js");
writeFileSync(
  uiEntry,
  [
    readFileSync(join(root, "src/plugin-config.js"), "utf8"),
    readFileSync(join(root, "src/batch-controls.js"), "utf8"),
    readFileSync(join(root, "src/image-utils.js"), "utf8"),
    readFileSync(join(root, "src/remove-background.js"), "utf8"),
    readFileSync(join(root, "src/image-validator.js"), "utf8"),
    readFileSync(join(root, "src/normalize-jersey.js"), "utf8"),
    readFileSync(join(root, "src/ui.js"), "utf8"),
  ].join("\n"),
  "utf8",
);

writeUiHtml(categories, defaultCategoryId, "");

const uiCtx = await esbuild.context({
  entryPoints: [uiEntry],
  bundle: true,
  format: "iife",
  outfile: join(root, "ui.js"),
  target: "es2017",
  logLevel: "info",
});

const codeCtx = await esbuild.context({
  entryPoints: [join(root, "src/code.ts")],
  bundle: true,
  outfile: join(root, "code.js"),
  target: "es2017",
  logLevel: "info",
  define: {
    __PLUGIN_API_ORIGIN__: JSON.stringify(apiOrigin),
    __PLUGIN_API_ORIGINS__: JSON.stringify(apiOrigins),
    __PLUGIN_ADMIN_SECRET__: JSON.stringify(adminSecret),
  },
});

async function rebuildAll() {
  await uiCtx.rebuild();
  const uiJs = readFileSync(join(root, "ui.js"), "utf8");
  writeUiHtml(categories, defaultCategoryId, uiJs);
  await codeCtx.rebuild();
}

if (watch) {
  await rebuildAll();
  await Promise.all([uiCtx.watch(), codeCtx.watch()]);
  console.log("Watching… Recharge le plugin dans Figma après chaque changement.");
} else {
  await rebuildAll();
  await Promise.all([uiCtx.dispose(), codeCtx.dispose()]);
  console.log(
    `Built code.js + ui.html + ui.js (${categories.length} catégories) — réimporte le manifest dans Figma.`,
  );
}
