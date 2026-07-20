const statusEl = document.getElementById("status") as HTMLDivElement;
const runBtn = document.getElementById("run") as HTMLButtonElement;

declare const __REMOVEBG_API_KEYS__: string;

const apiKeys: string[] = (() => {
  try {
    const parsed = JSON.parse(__REMOVEBG_API_KEYS__) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((key): key is string => typeof key === "string" && key.trim().length > 0);
  } catch {
    return [];
  }
})();

function setStatus(text: string, isError = false) {
  statusEl.textContent = text;
  statusEl.className = isError ? "error" : "";
}

function setBusy(busy: boolean) {
  runBtn.disabled = busy;
}

async function callRemoveBg(bytes: Uint8Array): Promise<Uint8Array> {
  if (!apiKeys.length) {
    throw new Error("Aucune clé REMOVEBG_API_KEYS — relancez npm run build.");
  }

  const blob = new Blob([bytes], { type: "image/png" });
  let lastError = "Échec remove.bg";

  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = apiKeys[i]!;
    const form = new FormData();
    form.append("image_file", blob, "layer.png");
    form.append("size", "auto");
    form.append("type", "product");
    form.append("format", "png");

    const res = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: form,
    });

    if (res.ok) {
      return new Uint8Array(await res.arrayBuffer());
    }

    const detail = (await res.text()).slice(0, 160);
    lastError = detail || `Erreur ${res.status}`;

    if (res.status === 402 || res.status === 403) {
      continue;
    }
    throw new Error(lastError);
  }

  throw new Error(lastError);
}

runBtn.onclick = () => {
  parent.postMessage({ pluginMessage: { type: "remove-bg" } }, "*");
};

window.onmessage = async (event: MessageEvent) => {
  const msg = event.data.pluginMessage as UiMessage | undefined;
  if (!msg) return;

  if (msg.type === "init") {
    setStatus(
      apiKeys.length
        ? `${apiKeys.length} clé(s) remove.bg — sélectionnez une image.`
        : "Clés API manquantes — npm run build depuis le repo.",
    );
    return;
  }

  if (msg.type === "status") {
    setStatus(msg.message);
    return;
  }

  if (msg.type === "error") {
    setStatus(msg.message, true);
    setBusy(false);
    return;
  }

  if (msg.type === "done") {
    setStatus("Terminé ✓");
    setBusy(false);
    return;
  }

  if (msg.type === "process") {
    setBusy(true);
    setStatus("Détourage remove.bg…");

    try {
      const result = await callRemoveBg(new Uint8Array(msg.bytes));
      parent.postMessage(
        {
          pluginMessage: {
            type: "apply-result",
            nodeId: msg.nodeId,
            nodeName: msg.nodeName,
            bytes: Array.from(result),
          },
        },
        "*",
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Échec remove.bg", true);
      setBusy(false);
    }
  }
};

parent.postMessage({ pluginMessage: { type: "ui-ready" } }, "*");

type UiMessage =
  | { type: "init" }
  | { type: "ui-ready" }
  | { type: "status"; message: string }
  | { type: "error"; message: string }
  | { type: "done" }
  | { type: "process"; nodeId: string; nodeName: string; bytes: number[] };
