const categorySelect = document.getElementById("categoryId");
const reloadCategoriesBtn = document.getElementById("reloadCategoriesBtn");
const networkPanel = document.getElementById("networkPanel");
const networkTestBtn = document.getElementById("networkTestBtn");
const urlInput = document.getElementById("productUrl");
const prepareBtn = document.getElementById("prepareBtn");
const pushBtn = document.getElementById("pushBtn");
const cancelBtn = document.getElementById("cancelBtn");
const pendingListEl = document.getElementById("pendingList");
const statusEl = document.getElementById("status");

const FIGMA_PRICE = 24.99;
const FIGMA_STOCK = 20;

if (prepareBtn) prepareBtn.disabled = false;
if (statusEl && categorySelect?.options.length) {
  statusEl.textContent = `${categorySelect.options.length} catégorie(s) — plugin prêt.`;
}

/** @type {{ url: string; name: string; frameId: string; status: string; productId?: string }[]} */
let pendingQueue = [];
let requestCounter = 0;

function getApiOrigins() {
  const origins = [];
  const add = (value) => {
    const normalized = String(value || "").replace(/\/$/, "");
    if (normalized && !origins.includes(normalized)) origins.push(normalized);
  };

  if (typeof PLUGIN_API_ORIGINS !== "undefined" && Array.isArray(PLUGIN_API_ORIGINS)) {
    for (const origin of PLUGIN_API_ORIGINS) add(origin);
  }
  add(typeof PLUGIN_API_ORIGIN !== "undefined" ? PLUGIN_API_ORIGIN : "");
  add("https://foot-shop.fr");
  add("https://foot-shop.onrender.com");
  add("https://www.foot-shop.fr");
  return origins;
}

function getApiOrigin() {
  return getApiOrigins()[0] || "https://foot-shop.fr";
}

function isNetworkError(message) {
  return /network error|failed to fetch|fetch failed|load failed|aborted|délai dépassé/i.test(
    message,
  );
}

function setStatus(text, isError) {
  statusEl.textContent = text;
  statusEl.className = isError ? "error" : "";
}

function setBusy(busy) {
  prepareBtn.disabled = busy;
  pushBtn.disabled = busy || !pendingQueue.some((p) => p.status.startsWith("Prêt"));
  cancelBtn.disabled = !busy;
}

function nextRequestId() {
  requestCounter += 1;
  return `req-${requestCounter}`;
}

function renderPending() {
  if (!pendingQueue.length) {
    pendingListEl.innerHTML = '<div class="pending-item">Aucune fiche en attente.</div>';
    pushBtn.disabled = true;
    return;
  }

  pendingListEl.innerHTML = pendingQueue
    .map(
      (item) =>
        `<div class="pending-item"><strong>${escapeHtml(item.name)}</strong><div class="meta">${escapeHtml(item.status)}</div></div>`,
    )
    .join("");

  pushBtn.disabled = !pendingQueue.some((p) => p.status.startsWith("Prêt"));
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function waitForPluginMessage(type, requestId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("Délai dépassé (plugin Figma)."));
    }, 120000);

    const handler = (event) => {
      const msg = event.data.pluginMessage;
      if (!msg || msg.requestId !== requestId) return;

      if (msg.type === type) {
        clearTimeout(timeout);
        window.removeEventListener("message", handler);
        resolve(msg);
      }

      if (msg.type === "card-error" || msg.type === "export-error" || msg.type === "scrape-error") {
        clearTimeout(timeout);
        window.removeEventListener("message", handler);
        reject(new Error(msg.message || "Erreur plugin."));
      }
    };

    window.addEventListener("message", handler);
  });
}

function getApiSecret() {
  return typeof PLUGIN_ADMIN_SECRET === "string" ? PLUGIN_ADMIN_SECRET : "";
}

function waitForApiResponse(requestId, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("Délai dépassé (API plugin)."));
    }, timeoutMs);

    const handler = (event) => {
      const msg = event.data.pluginMessage;
      if (!msg || msg.requestId !== requestId || msg.type !== "api-response") return;

      clearTimeout(timeout);
      window.removeEventListener("message", handler);

      if (msg.error) {
        reject(new Error(msg.error));
        return;
      }

      let data = {};
      try {
        data = msg.body ? JSON.parse(msg.body) : {};
      } catch {
        data = {};
      }

      resolve({ ok: msg.ok, status: msg.status, data });
    };

    window.addEventListener("message", handler);
  });
}

async function pluginApiViaMain(path, options = {}, timeoutMs = 120000) {
  const requestId = nextRequestId();
  parent.postMessage(
    {
      pluginMessage: {
        type: "api-request",
        requestId,
        path,
        method: options.method || "GET",
        headers: options.headers,
        body: options.body,
      },
    },
    "*",
  );
  return waitForApiResponse(requestId, timeoutMs);
}

async function pluginApiOnce(origin, path, options = {}, timeoutMs = 120000) {
  const url = `${origin.replace(/\/$/, "")}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = {
      Authorization: `Bearer ${getApiSecret()}`,
      "x-admin-secret": getApiSecret(),
      ...(options.headers || {}),
    };
    if (options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body,
      signal: controller.signal,
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Délai dépassé — le serveur ne répond pas (Render peut mettre ~1 min au 1er appel).");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function pluginApi(path, options = {}, timeoutMs = 120000) {
  // Thread principal Figma : pas de CORS, accès réseau du manifest.
  try {
    return await pluginApiViaMain(path, options, timeoutMs);
  } catch (mainErr) {
    const mainMsg = mainErr instanceof Error ? mainErr.message : String(mainErr);
    if (!isNetworkError(mainMsg)) throw mainErr;
  }

  const errors = [];
  for (const origin of getApiOrigins()) {
    try {
      return await pluginApiOnce(origin, path, options, timeoutMs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(err instanceof Error ? err : new Error(message));
      if (!isNetworkError(message)) throw err;
    }
  }

  throw errors[0] ?? new Error("Failed to fetch");
}

async function apiFetch(path, body) {
  const { ok, status, data } = await pluginApi(path, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!ok) {
    throw new Error(data.message || `Erreur API (${status})`);
  }
  return data;
}

function explainApiError(status, message) {
  if (status === 401) {
    return "Accès refusé — vérifie ADMIN_SECRET=mdp sur le serveur (Render).";
  }
  if (status === 404) {
    return "Route API introuvable — déploie la dernière version du site sur foot-shop.fr.";
  }
  if (status === 503 && message === "prestashop_not_configured") {
    return "PrestaShop non configuré sur le serveur (PRESTASHOP_API_URL / KEY).";
  }
  return message || `Erreur ${status}`;
}

function applyCategoryOptions(list, savedCategoryId, defaultCategoryId) {
  if (!list.length) return false;

  categorySelect.innerHTML = list
    .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`)
    .join("");

  const pickId = savedCategoryId || defaultCategoryId || list[0]?.id || "";
  if (pickId) categorySelect.value = pickId;
  return true;
}

function loadEmbeddedCategories(savedCategoryId) {
  if (typeof PLUGIN_CATEGORIES === "undefined" || !PLUGIN_CATEGORIES.length) {
    return false;
  }

  const defaultId =
    typeof PLUGIN_DEFAULT_CATEGORY_ID !== "undefined" ? PLUGIN_DEFAULT_CATEGORY_ID : "";
  applyCategoryOptions(PLUGIN_CATEGORIES, savedCategoryId, defaultId);
  setStatus(`${PLUGIN_CATEGORIES.length} catégorie(s) (cache) — sync serveur…`);
  return true;
}

async function loadCategories(savedCategoryId) {
  const hadCache = loadEmbeddedCategories(savedCategoryId);
  if (!hadCache) {
    categorySelect.innerHTML = '<option value="">Chargement…</option>';
    setStatus(`Connexion à ${getApiOrigin()}…`);
  }

  const endpoints = ["/api/admin/product-import", "/api/admin/figma-import"];
  let lastError = "Catégories indisponibles";

  for (const path of endpoints) {
    try {
      setStatus(`Sync ${path}…`);
      const { ok, status, data } = await pluginApi(path);

      if (status === 404) {
        lastError = explainApiError(404, data.message);
        continue;
      }

      if (!ok) {
        lastError = `${explainApiError(status, data.message)} [${status}]`;
        if (PLUGIN_CATEGORIES?.length) {
          setStatus(`${PLUGIN_CATEGORIES.length} catégorie(s) en cache — ${lastError}`, true);
          return true;
        }
        break;
      }

      const list = data.categories || [];
      if (!list.length) {
        lastError = "Aucune catégorie PrestaShop";
        continue;
      }

      applyCategoryOptions(list, savedCategoryId, data.defaultCategoryId);
      setStatus(`${list.length} catégorie(s) synchronisée(s).`);
      return true;
    } catch (err) {
      lastError = formatError(err);
    }
  }

  if (PLUGIN_CATEGORIES?.length) {
    setStatus(`${PLUGIN_CATEGORIES.length} catégorie(s) en cache — sync échouée : ${lastError}`, true);
    return true;
  }

  categorySelect.innerHTML = `<option value="">${escapeHtml(lastError)}</option>`;
  setStatus(`Catégories : ${lastError}`, true);
  return false;
}

function saveCategorySelection() {
  parent.postMessage(
    { pluginMessage: { type: "save-category", categoryId: categorySelect.value } },
    "*",
  );
}

async function scrapeViaMain(url) {
  const requestId = nextRequestId();
  parent.postMessage(
    { pluginMessage: { type: "scrape-product", requestId, url } },
    "*",
  );
  return waitForPluginMessage("scrape-done", requestId);
}

async function apiGet(path, query, timeoutMs = 120000) {
  const params = new URLSearchParams();
  const secret = getApiSecret();
  if (secret) params.set("pluginSecret", secret);
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const { ok, status, data } = await pluginApi(`${path}${suffix}`, {}, timeoutMs);
  if (!ok) {
    throw new Error(data.message || `Erreur API (${status})`);
  }
  return data;
}

async function scrapeViaApiPost(url) {
  for (const path of ["/api/admin/figma-import", "/api/admin/product-import"]) {
    try {
      const data = await apiFetch(path, { action: "scrape", url });
      if (!data.imageBase64) {
        throw new Error("Image serveur manquante.");
      }
      return {
        name: data.name || "Maillot",
        mimeType: data.mimeType || "image/jpeg",
        bytes: Array.from(base64ToBytes(data.imageBase64)),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/404|introuvable|unknown_action/i.test(message)) continue;
      throw err;
    }
  }
  throw new Error("scrape_api_unavailable");
}

async function scrapeProduct(url) {
  const apiErrors = [];

  setStatus("Scrape via serveur Foot Shop (Render)…");
  try {
    return await scrapeViaApiPost(url);
  } catch (err) {
    apiErrors.push(err instanceof Error ? err.message : String(err));
  }

  for (const path of ["/api/admin/figma-import", "/api/admin/product-import"]) {
    try {
      setStatus("Analyse via API Foot Shop…");
      const preview = await apiGet(path, { previewUrl: url }, 120000);
      if (!preview.imageUrl) {
        throw new Error("Aucune image produit trouvée sur cette page.");
      }

      const image = await apiGet(
        path,
        {
          imageUrl: preview.imageUrl,
          referer: preview.sourceUrl || url,
        },
        120000,
      );

      if (!image.imageBase64) {
        throw new Error("Image serveur manquante.");
      }

      return {
        name: preview.name || "Maillot",
        mimeType: image.mimeType || "image/jpeg",
        bytes: Array.from(base64ToBytes(image.imageBase64)),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      apiErrors.push(message);
      if (/404|introuvable|unknown_action/i.test(message)) continue;
      break;
    }
  }

  setStatus("API indisponible — scrape Figma local (fournisseur)…");
  try {
    const scraped = await scrapeViaMain(url);
    return {
      name: scraped.name || "Maillot",
      mimeType: scraped.mimeType || "image/jpeg",
      bytes: scraped.bytes,
    };
  } catch (localErr) {
    const localMsg = formatError(localErr, "scrape");
    const apiHint = apiErrors.filter(Boolean).slice(-2).join(" · ");
    throw new Error(
      apiHint
        ? `API Foot Shop : ${apiHint} · ${localMsg}`
        : localMsg,
    );
  }
}

async function previewFromApi(url) {
  for (const path of ["/api/admin/figma-import", "/api/admin/product-import"]) {
    try {
      return await apiFetch(path, { action: "preview", url });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (/404|introuvable|unknown_action/i.test(message)) continue;
      throw err;
    }
  }
  throw new Error("Preview indisponible — déploie la dernière version du site.");
}

async function pushToPrestaShop(item, imageBase64) {
  const payload = {
    action: "push",
    name: item.name,
    sourceUrl: item.url,
    imageBase64,
    imageMime: "image/png",
    categoryId: categorySelect.value || undefined,
    price: FIGMA_PRICE,
    stock: FIGMA_STOCK,
  };

  for (const path of ["/api/admin/figma-import", "/api/admin/product-import"]) {
    try {
      return await apiFetch(path, payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (/404|introuvable|unknown_action/i.test(message)) continue;
      throw err;
    }
  }
  throw new Error("Envoi PrestaShop indisponible — déploie la dernière version du site.");
}

async function runPipelineToBytes(sourceBytes, mimeType) {
  checkCancelled();
  const trimmed = await trimWhiteMargins(sourceBytes, mimeType);
  checkCancelled();
  const cutout = await removeBackgroundLocally(trimmed, "image/png");
  checkCancelled();
  return normalizeJerseyPng(cutout);
}

async function createFigmaCard(normalizedBytes, meta) {
  const requestId = nextRequestId();
  parent.postMessage(
    {
      pluginMessage: {
        type: "apply-result",
        requestId,
        nodeName: meta.name,
        sourceUrl: meta.url,
        placementIndex: meta.placementIndex,
        batchTotal: meta.batchTotal,
        bytes: Array.from(normalizedBytes),
      },
    },
    "*",
  );

  const msg = await waitForPluginMessage("card-created", requestId);
  return { frameId: msg.frameId, nodeName: msg.nodeName };
}

async function exportFigmaFrame(frameId) {
  const requestId = nextRequestId();
  parent.postMessage(
    { pluginMessage: { type: "export-frame", requestId, frameId } },
    "*",
  );
  const msg = await waitForPluginMessage("frame-exported", requestId);
  return new Uint8Array(msg.bytes);
}

function canonicalProductUrl(raw) {
  let value = String(raw || "").trim();
  value = value
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/^[Ee]rreur\s*:\s*(?:URL invalide\s*:\s*)?/i, "");

  const match = value.match(/https?:\/\/[^\s<>"']+/i);
  if (match) value = match[0];

  value = value.replace(/[\u2026…]+$/g, "").replace(/[)\]},.;]+$/g, "");
  while (/%[0-9A-Fa-f]?$/.test(value)) {
    value = value.replace(/(%[0-9A-Fa-f]?)+$/g, "");
  }

  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value.replace(/^\/+/, "")}`;
  }

  value = value.split(/[?#]/)[0];
  const parsed = value.match(/^(https?):\/\/([^/?#]+)(\/[^?#]*)?$/i);
  if (!parsed) {
    throw new Error(`URL invalide : ${value.slice(0, 120)}${value.length > 120 ? "…" : ""}`);
  }

  return `${parsed[1].toLowerCase()}://${parsed[2]}${parsed[3] || "/"}`;
}

function parseUrlLines(text) {
  const cleaned = text.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  if (!cleaned) return [];

  const lines = cleaned.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const chunks = [];

  for (const line of lines) {
    if (/^[Ee]rreur\s*:/.test(line)) continue;

    const extracted = line.match(/https?:\/\/[^\s<>"']+/gi);
    if (extracted) {
      for (const raw of extracted) {
        const url = raw.replace(/[)\]},.;]+$/g, "").replace(/[\u2026…]+$/g, "");
        if (url && !chunks.includes(url)) chunks.push(url);
      }
      continue;
    }

    if (/^https?:\/\//i.test(line)) {
      chunks.push(line.replace(/[)\]},.;]+$/g, "").replace(/[\u2026…]+$/g, ""));
    } else if (chunks.length && !/\s/.test(line)) {
      chunks[chunks.length - 1] += line.replace(/[)\]},.;]+$/g, "").replace(/[\u2026…]+$/g, "");
    }
  }

  const canonical = [];
  for (const chunk of chunks) {
    try {
      const url = canonicalProductUrl(chunk);
      if (!canonical.includes(url)) canonical.push(url);
    } catch {
      // ignore invalid fragments
    }
  }

  return canonical;
}

function formatError(err, context = "auto") {
  if (err instanceof Error && err.name === "AbortError") return "Annulé.";
  const message = err instanceof Error ? err.message : "Erreur inconnue";
  if (
    /^(Téléchargement page\/image|Connexion foot-shop|Accès refusé|Route API|Réseau Figma bloqué|API Foot Shop)/.test(
      message,
    )
  ) {
    return message;
  }
  if (isNetworkError(message)) {
    if (context === "scrape" || /Réseau Figma bloqué|HTTP \d|Impossible de télécharger/i.test(message)) {
      return message.includes("Réseau Figma bloqué")
        ? message
        : `Téléchargement page/image impossible (${message}) — importe manifest.json v3 et lance le plugin « v3 ».`;
    }
    return `Connexion foot-shop.fr impossible — déploie la dernière version sur Render, reload le plugin, réessaie. (${message})`;
  }
  if (/unauthorized|401/i.test(message)) {
    return "Accès refusé — ADMIN_SECRET du plugin (build) ≠ celui sur Render.";
  }
  return message;
}

function describeNetworkChecks(checks) {
  if (!checks?.length) return "";

  const failed = checks.filter((check) => !check.ok);
  const internetOk = checks.some((check) => check.ok && check.label === "internet");
  const onrenderOk = checks.some((check) => check.ok && check.label === "foot-shop.onrender.com");
  const footShopOk = checks.some(
    (check) => check.ok && (check.label === "foot-shop.fr" || check.label === "www.foot-shop.fr"),
  );

  if (failed.length === checks.length) {
    return "Réseau Figma totalement bloqué — importe manifest.json v3 (Import plugin from manifest), lance « Foot Shop - Import maillot v3 ».";
  }

  if (internetOk && (onrenderOk || footShopOk)) {
    return "Réseau OK — le serveur Foot Shop est joignable depuis Figma.";
  }

  if (internetOk && !onrenderOk && !footShopOk) {
    return "Internet OK mais Foot Shop injoignable — déploie maillot-store sur Render (foot-shop.onrender.com).";
  }

  if (failed.length) {
    return `Réseau partiel : ${failed.map((check) => check.label).join(", ")} inaccessible(s).`;
  }

  return "Réseau OK.";
}

function renderNetworkChecks(checks) {
  if (!networkPanel) return;
  if (!checks?.length) {
    networkPanel.textContent = "Aucun test réseau.";
    return;
  }

  networkPanel.innerHTML = checks
    .map((check) => {
      const icon = check.ok ? "✓" : "✗";
      const detail = check.ok ? `HTTP ${check.status}` : check.error || "bloqué";
      return `<div class="net-row ${check.ok ? "ok" : "fail"}">${icon} ${escapeHtml(check.label)} — ${escapeHtml(String(detail))}</div>`;
    })
    .join("");
}

async function runNetworkTest() {
  const requestId = nextRequestId();
  setStatus("Test réseau Figma…");
  parent.postMessage({ pluginMessage: { type: "network-test", requestId } }, "*");
  const msg = await waitForPluginMessage("network-test-result", requestId);
  renderNetworkChecks(msg.checks);
  const hint = describeNetworkChecks(msg.checks);
  setStatus(hint, /bloqué|injoignable|inaccessible/i.test(hint));
}

categorySelect.onchange = () => saveCategorySelection();

reloadCategoriesBtn.onclick = () => {
  void loadCategories(categorySelect.value || "");
};

if (networkTestBtn) {
  networkTestBtn.onclick = () => {
    void runNetworkTest();
  };
}

cancelBtn.onclick = () => {
  cancelBatch();
  setStatus("Annulé.");
  setBusy(false);
};

prepareBtn.onclick = async () => {
  const urls = parseUrlLines(urlInput.value);
  if (!urls.length) {
    setStatus("Collez au moins un lien produit.", true);
    return;
  }

  resetBatchState();
  pendingQueue = [];
  renderPending();
  setBusy(true);
  setStatus("Démarrage…");

  let ok = 0;
  try {
    for (let i = 0; i < urls.length; i++) {
      checkCancelled();
      const url = urls[i];

      try {
        setStatus(`${i + 1}/${urls.length} — Analyse page (Foot Shop)…`);
        const scraped = await scrapeProduct(url);
        const name = scraped.name || "Maillot";
        const bytes = new Uint8Array(scraped.bytes);
        const mimeType = scraped.mimeType || "image/jpeg";

        setStatus(`${i + 1}/${urls.length} — Validation packshot…`);
        const analysis = await analyzePackshot(bytes, mimeType);
        if (!analysis.ok) {
          throw new Error(analysis.reason || "Image non conforme (pas un packshot face).");
        }

        setStatus(`${i + 1}/${urls.length} — Détourage + normalisation…`);
        const normalized = await runPipelineToBytes(bytes, mimeType);

        setStatus(`${i + 1}/${urls.length} — Création fiche Figma…`);
        const card = await createFigmaCard(normalized, {
          name,
          url,
          placementIndex: ok,
          batchTotal: urls.length,
        });

        pendingQueue.push({
          url,
          name,
          frameId: card.frameId,
          status: "Prêt — en attente validation",
        });
        ok++;
        renderPending();
      } catch (err) {
        if (batchCancelled || (err instanceof Error && err.name === "AbortError")) break;
        pendingQueue.push({
          url,
          name: name || url.split("/").filter(Boolean).pop() || "Maillot",
          frameId: "",
          status: `Erreur : ${formatError(err)}`,
        });
        renderPending();
        await sleep(800);
      }
    }

    if (batchCancelled) {
      setStatus(`Annulé — ${ok} fiche(s) préparée(s).`, ok === 0);
    } else {
      setStatus(`${ok}/${urls.length} fiche(s) prête(s). Vérifie dans Figma puis valide.`, ok === 0);
    }
  } catch (err) {
    setStatus(formatError(err), true);
  }

  setBusy(false);
};

pushBtn.onclick = async () => {
  const ready = pendingQueue.filter((p) => p.status.startsWith("Prêt") && p.frameId);
  if (!ready.length) {
    setStatus("Aucune fiche prête à envoyer.", true);
    return;
  }

  resetBatchState();
  setBusy(true);

  let ok = 0;
  try {
    for (let i = 0; i < ready.length; i++) {
      checkCancelled();
      const item = ready[i];
      setStatus(`${i + 1}/${ready.length} — Export Figma ${item.name.slice(0, 36)}…`);

      const pngBytes = await exportFigmaFrame(item.frameId);
      const base64 = bytesToBase64(pngBytes);

      setStatus(`${i + 1}/${ready.length} — Envoi PrestaShop…`);
      const result = await pushToPrestaShop(item, base64);

      item.status = `Envoyé ✓ (#${result.result?.productId || "?"})`;
      item.productId = result.result?.productId;
      ok++;
      renderPending();
    }

    setStatus(`${ok}/${ready.length} produit(s) créé(s) sur PrestaShop ✓`, ok === 0);
  } catch (err) {
    setStatus(formatError(err), true);
  }

  setBusy(false);
};

window.onmessage = (event) => {
  const msg = event.data.pluginMessage;
  if (!msg) return;

  if (msg.type === "init") {
    if (categorySelect.options.length > 1 && msg.categoryId) {
      categorySelect.value = msg.categoryId;
    }
    renderNetworkChecks(msg.networkChecks);
    const networkHint = describeNetworkChecks(msg.networkChecks);
    if (networkHint) {
      const isError = /bloqué|injoignable|inaccessible/i.test(networkHint);
      setStatus(networkHint, isError);
    }
  }

  if (msg.type === "network-test-result") {
    // handled by waitForPluginMessage
  }
};

window.onerror = (_message, _source, _line, _col, err) => {
  setStatus(err instanceof Error ? err.message : "Erreur JavaScript.", true);
  setBusy(false);
};

renderPending();
parent.postMessage({ pluginMessage: { type: "ui-ready" } }, "*");
