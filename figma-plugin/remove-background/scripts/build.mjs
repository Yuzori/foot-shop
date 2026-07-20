import * as esbuild from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getRemoveBgKeys, loadEnvLocal } from "./plugin-config.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const watch = process.argv.includes("--watch");

const removeBgKeys = getRemoveBgKeys(loadEnvLocal());

function writeBundledUi(uiJs) {
  const safeJs = uiJs.replace(/<\/script/gi, "<\\/script");
  const html = readFileSync(join(root, "src/ui.html"), "utf8").replace(
    "<!-- UI_SCRIPT -->",
    `<script>\n${safeJs}\n</script>`,
  );
  writeFileSync(join(root, "ui.html"), html, "utf8");
}

const sharedDefine = {
  __REMOVEBG_API_KEYS__: JSON.stringify(removeBgKeys),
};

const uiCtx = await esbuild.context({
  entryPoints: [join(root, "src/ui.ts")],
  bundle: true,
  format: "iife",
  target: "es2017",
  logLevel: "info",
  define: sharedDefine,
  write: false,
});

const codeCtx = await esbuild.context({
  entryPoints: [join(root, "src/code.ts")],
  bundle: true,
  outfile: join(root, "code.js"),
  target: "es2017",
  logLevel: "info",
});

async function rebuildAll() {
  const uiResult = await uiCtx.rebuild();
  const uiJs = uiResult.outputFiles?.[0]?.text ?? "";
  writeBundledUi(uiJs);
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
    `Built code.js + ui.html (${removeBgKeys.length} clé(s) remove.bg) — réimporte le manifest dans Figma.`,
  );
}
