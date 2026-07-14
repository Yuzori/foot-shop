"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };

  // src/ui-entry.js
  var PLUGIN_API_ORIGIN = "https://foot-shop.onrender.com";
  var PLUGIN_API_ORIGINS = ["https://foot-shop.onrender.com", "https://foot-shop.fr", "https://www.foot-shop.fr"];
  var PLUGIN_ADMIN_SECRET = "mdp";
  var PLUGIN_CATEGORIES = [{ "id": 14, "name": "Maillots" }, { "id": 15, "name": "Shorts" }, { "id": 16, "name": "Enfant - Short" }, { "id": 17, "name": "Ligue 1" }, { "id": 18, "name": "Premier League" }, { "id": 19, "name": "La Liga" }, { "id": 20, "name": "Serie A" }, { "id": 21, "name": "Bundesliga" }, { "id": 22, "name": "Ligue des champions" }, { "id": 23, "name": "S\xE9lections" }, { "id": 24, "name": "Ligue 1" }, { "id": 25, "name": "Premier League" }, { "id": 26, "name": "La Liga" }, { "id": 27, "name": "Serie A" }, { "id": 28, "name": "Bundesliga" }, { "id": 29, "name": "Ligue des champions" }, { "id": 30, "name": "S\xE9lections" }, { "id": 31, "name": "Ligue 1" }, { "id": 32, "name": "Premier League" }, { "id": 33, "name": "La Liga" }, { "id": 34, "name": "Serie A" }, { "id": 35, "name": "Bundesliga" }, { "id": 36, "name": "Ligue des champions" }, { "id": 37, "name": "S\xE9lections" }, { "id": 38, "name": "CDM" }, { "id": 39, "name": "Ligue 1" }, { "id": 40, "name": "Premier League" }, { "id": 41, "name": "La Liga" }, { "id": 42, "name": "Serie A" }, { "id": 43, "name": "Bundesliga" }, { "id": 44, "name": "Ligue des champions" }, { "id": 45, "name": "S\xE9lections" }, { "id": 11, "name": "World Cup" }, { "id": 12, "name": "Maillot - Enfant" }, { "id": 13, "name": "CDM" }];
  var PLUGIN_DEFAULT_CATEGORY_ID = "11";
  var batchCancelled = false;
  var fetchAbort = null;
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function checkCancelled() {
    if (batchCancelled) {
      const err = new Error("Annul\xE9.");
      err.name = "AbortError";
      throw err;
    }
  }
  function resetBatchState() {
    batchCancelled = false;
    if (fetchAbort) fetchAbort.abort();
    fetchAbort = new AbortController();
  }
  function cancelBatch() {
    batchCancelled = true;
    if (fetchAbort) fetchAbort.abort();
  }
  function bytesToBase64(bytes) {
    let binary = "";
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }
  function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  function loadImageFromBytes(bytes, mimeType) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([bytes], { type: mimeType || "image/png" });
      const objectUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Impossible de lire l'image."));
      };
      img.src = objectUrl;
    });
  }
  function canvasToPngBytes(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          reject(new Error("Export PNG impossible."));
          return;
        }
        resolve(new Uint8Array(await blob.arrayBuffer()));
      }, "image/png");
    });
  }
  function colorDistance(r1, g1, b1, r2, g2, b2) {
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }
  function medianChannel(values) {
    var _a;
    const sorted = values.slice().sort((a, b) => a - b);
    return (_a = sorted[Math.floor(sorted.length / 2)]) != null ? _a : 0;
  }
  function detectBackgroundRefs(data, width, height) {
    const samples = [];
    const step = Math.max(2, Math.floor(Math.min(width, height) / 40));
    const add = (x, y) => {
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      if (a < 20) return;
      samples.push([data[i], data[i + 1], data[i + 2]]);
    };
    for (let x = 0; x < width; x += step) {
      add(x, 0);
      add(x, height - 1);
    }
    for (let y = 0; y < height; y += step) {
      add(0, y);
      add(width - 1, y);
    }
    if (!samples.length) return [[255, 255, 255]];
    const rs = samples.map((s) => s[0]);
    const gs = samples.map((s) => s[1]);
    const bs = samples.map((s) => s[2]);
    const primary = [medianChannel(rs), medianChannel(gs), medianChannel(bs)];
    const refs = [primary];
    const whiteish = [250, 250, 250];
    const grayish = [240, 240, 240];
    if (colorDistance(primary[0], primary[1], primary[2], whiteish[0], whiteish[1], whiteish[2]) > 18) {
      refs.push(whiteish);
    }
    if (colorDistance(primary[0], primary[1], primary[2], grayish[0], grayish[1], grayish[2]) > 18) {
      refs.push(grayish);
    }
    return refs;
  }
  function matchesBackground(r, g, b, refs, tolerance) {
    for (const [br, bg, bb] of refs) {
      if (colorDistance(r, g, b, br, bg, bb) <= tolerance) return true;
    }
    return false;
  }
  function floodFillBackground(mask, data, width, height, refs, tolerance) {
    const queue = [];
    const idx = (x, y) => y * width + x;
    const tryPush = (x, y) => {
      const p = idx(x, y);
      if (mask[p]) return;
      const i = p * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 20) {
        mask[p] = 1;
        queue.push(p);
        return;
      }
      if (matchesBackground(r, g, b, refs, tolerance)) {
        mask[p] = 1;
        queue.push(p);
      }
    };
    for (let x = 0; x < width; x++) {
      tryPush(x, 0);
      tryPush(x, height - 1);
    }
    for (let y = 0; y < height; y++) {
      tryPush(0, y);
      tryPush(width - 1, y);
    }
    while (queue.length) {
      const p = queue.pop();
      const x = p % width;
      const y = (p - x) / width;
      if (x > 0) tryPush(x - 1, y);
      if (x < width - 1) tryPush(x + 1, y);
      if (y > 0) tryPush(x, y - 1);
      if (y < height - 1) tryPush(x, y + 1);
    }
  }
  function featherEdges(data, width, height, mask, refs, hardTol, softTol) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        if (mask[p]) continue;
        const i = p * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        let minDist = Infinity;
        for (const [br, bg, bb] of refs) {
          minDist = Math.min(minDist, colorDistance(r, g, b, br, bg, bb));
        }
        if (minDist <= hardTol) {
          data[i + 3] = 0;
        } else if (minDist <= softTol) {
          const t = (minDist - hardTol) / (softTol - hardTol);
          data[i + 3] = Math.round(Math.min(255, data[i + 3] * t));
        }
      }
    }
  }
  async function removeBackgroundLocally(bytes, mimeType) {
    const img = await loadImageFromBytes(bytes, mimeType);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas indisponible.");
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = imageData;
    const refs = detectBackgroundRefs(data, width, height);
    const hardTol = 42;
    const softTol = 72;
    const mask = new Uint8Array(width * height);
    floodFillBackground(mask, data, width, height, refs, hardTol);
    for (let p = 0; p < width * height; p++) {
      if (mask[p]) data[p * 4 + 3] = 0;
    }
    featherEdges(data, width, height, mask, refs, hardTol, softTol);
    ctx.putImageData(imageData, 0, 0);
    return canvasToPngBytes(canvas);
  }
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  async function analyzePackshot(bytes, mimeType) {
    const img = await loadImageFromBytes(bytes, mimeType);
    const width = img.width;
    const height = img.height;
    if (width < 320 || height < 320) {
      return { ok: false, score: -100, reason: "image trop petite" };
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { ok: false, score: -100, reason: "canvas indisponible" };
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, width, height);
    const refs = detectBackgroundRefs(data, width, height);
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let bgEdge = 0;
    let edgeTotal = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        const onEdge = x < 3 || y < 3 || x >= width - 3 || y >= height - 3;
        if (onEdge) {
          edgeTotal++;
          if (matchesBackground(r, g, b, refs, 50)) bgEdge++;
        }
        const isBg = a < 20 || matchesBackground(r, g, b, refs, 44);
        if (!isBg) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) {
      return { ok: false, score: -100, reason: "aucun sujet d\xE9tect\xE9" };
    }
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const fillRatio = bw * bh / (width * height);
    const aspect = bh / bw;
    const centerX = (minX + maxX) / 2;
    const centerOffset = Math.abs(centerX - width / 2) / width;
    const bgUniformity = edgeTotal ? bgEdge / edgeTotal : 0;
    let score = 0;
    let ok = true;
    let reason = "";
    if (bgUniformity < 0.55) {
      score -= 40;
      ok = false;
      reason = "fond non uniforme";
    }
    if (fillRatio > 0.76) {
      score -= 50;
      ok = false;
      reason = reason || "cadrage trop serr\xE9 (zoom)";
    } else if (fillRatio > 0.68) {
      score -= 25;
    } else if (fillRatio >= 0.28 && fillRatio <= 0.62) {
      score += 35;
    } else if (fillRatio < 0.22) {
      score -= 40;
      ok = false;
      reason = reason || "maillot trop petit dans l'image";
    }
    if (aspect < 0.95 || aspect > 1.85) {
      score -= 30;
      ok = false;
      reason = reason || "proportions atypiques";
    } else if (aspect >= 1.1 && aspect <= 1.55) {
      score += 25;
    }
    if (centerOffset > 0.18) {
      score -= 20;
      if (centerOffset > 0.28) {
        ok = false;
        reason = reason || "sujet d\xE9centr\xE9";
      }
    } else {
      score += 10;
    }
    if (width >= 600 && height >= 600) score += 8;
    return { ok, score, reason, fillRatio, aspect };
  }
  var NORM_CARD_W = 328;
  var NORM_CARD_H = 411;
  var JERSEY_TARGET_HEIGHT = 285;
  var JERSEY_MAX_WIDTH = 250;
  var ALPHA_THRESHOLD = 14;
  var WHITE_THRESHOLD = 246;
  function getAlphaBounds(imageData, width, height) {
    const data = imageData.data;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (data[i + 3] > ALPHA_THRESHOLD) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) return null;
    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
  }
  function getOpaqueBoundsFromCanvas(ctx, width, height) {
    return getAlphaBounds(ctx.getImageData(0, 0, width, height), width, height);
  }
  async function trimWhiteMargins(bytes, mimeType) {
    const img = await loadImageFromBytes(bytes, mimeType);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas indisponible.");
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data: px, width, height } = data;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = px[i];
        const g = px[i + 1];
        const b = px[i + 2];
        const a = px[i + 3];
        const isBackground = a < ALPHA_THRESHOLD || r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD;
        if (!isBackground) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) {
      return bytes;
    }
    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    const cropped = document.createElement("canvas");
    cropped.width = cropW;
    cropped.height = cropH;
    const cropCtx = cropped.getContext("2d");
    if (!cropCtx) return bytes;
    cropCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
    return canvasToPngBytes(cropped);
  }
  async function normalizeJerseyPng(pngBytes) {
    const img = await loadImageFromBytes(pngBytes, "image/png");
    const source = document.createElement("canvas");
    source.width = img.width;
    source.height = img.height;
    const sourceCtx = source.getContext("2d", { willReadFrequently: true });
    if (!sourceCtx) throw new Error("Canvas indisponible.");
    sourceCtx.drawImage(img, 0, 0);
    const bounds = getOpaqueBoundsFromCanvas(sourceCtx, source.width, source.height);
    if (!bounds) {
      throw new Error("Aucun contour de maillot d\xE9tect\xE9 apr\xE8s d\xE9tourage.");
    }
    const cropped = document.createElement("canvas");
    cropped.width = bounds.width;
    cropped.height = bounds.height;
    const croppedCtx = cropped.getContext("2d");
    if (!croppedCtx) throw new Error("Canvas indisponible.");
    croppedCtx.drawImage(
      source,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      0,
      0,
      bounds.width,
      bounds.height
    );
    const scale = Math.min(JERSEY_TARGET_HEIGHT / bounds.height, JERSEY_MAX_WIDTH / bounds.width);
    const targetW = Math.max(1, Math.round(bounds.width * scale));
    const targetH = Math.max(1, Math.round(bounds.height * scale));
    const scaled = document.createElement("canvas");
    scaled.width = targetW;
    scaled.height = targetH;
    const scaledCtx = scaled.getContext("2d");
    if (!scaledCtx) throw new Error("Canvas indisponible.");
    scaledCtx.imageSmoothingEnabled = true;
    scaledCtx.imageSmoothingQuality = "high";
    scaledCtx.drawImage(cropped, 0, 0, targetW, targetH);
    const output = document.createElement("canvas");
    output.width = NORM_CARD_W;
    output.height = NORM_CARD_H;
    const outputCtx = output.getContext("2d");
    if (!outputCtx) throw new Error("Canvas indisponible.");
    outputCtx.clearRect(0, 0, NORM_CARD_W, NORM_CARD_H);
    outputCtx.drawImage(
      scaled,
      Math.round((NORM_CARD_W - targetW) / 2),
      Math.round((NORM_CARD_H - targetH) / 2),
      targetW,
      targetH
    );
    return canvasToPngBytes(output);
  }
  var categorySelect = document.getElementById("categoryId");
  var reloadCategoriesBtn = document.getElementById("reloadCategoriesBtn");
  var networkPanel = document.getElementById("networkPanel");
  var networkTestBtn = document.getElementById("networkTestBtn");
  var urlInput = document.getElementById("productUrl");
  var prepareBtn = document.getElementById("prepareBtn");
  var pushBtn = document.getElementById("pushBtn");
  var cancelBtn = document.getElementById("cancelBtn");
  var pendingListEl = document.getElementById("pendingList");
  var statusEl = document.getElementById("status");
  var FIGMA_PRICE = 24.99;
  var FIGMA_STOCK = 20;
  if (prepareBtn) prepareBtn.disabled = false;
  if (statusEl && (categorySelect == null ? void 0 : categorySelect.options.length)) {
    statusEl.textContent = `${categorySelect.options.length} cat\xE9gorie(s) \u2014 plugin pr\xEAt.`;
  }
  var pendingQueue = [];
  var requestCounter = 0;
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
      message
    );
  }
  function setStatus(text, isError) {
    statusEl.textContent = text;
    statusEl.className = isError ? "error" : "";
  }
  function setBusy(busy) {
    prepareBtn.disabled = busy;
    pushBtn.disabled = busy || !pendingQueue.some((p) => p.status.startsWith("Pr\xEAt"));
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
    pendingListEl.innerHTML = pendingQueue.map(
      (item) => `<div class="pending-item"><strong>${escapeHtml(item.name)}</strong><div class="meta">${escapeHtml(item.status)}</div></div>`
    ).join("");
    pushBtn.disabled = !pendingQueue.some((p) => p.status.startsWith("Pr\xEAt"));
  }
  function escapeHtml(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function waitForPluginMessage(type, requestId) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        window.removeEventListener("message", handler);
        reject(new Error("D\xE9lai d\xE9pass\xE9 (plugin Figma)."));
      }, 12e4);
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
  function waitForApiResponse(requestId, timeoutMs = 12e4) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        window.removeEventListener("message", handler);
        reject(new Error("D\xE9lai d\xE9pass\xE9 (API plugin)."));
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
        } catch (e) {
          data = {};
        }
        resolve({ ok: msg.ok, status: msg.status, data });
      };
      window.addEventListener("message", handler);
    });
  }
  async function pluginApiViaMain(path, options = {}, timeoutMs = 12e4) {
    const requestId = nextRequestId();
    parent.postMessage(
      {
        pluginMessage: {
          type: "api-request",
          requestId,
          path,
          method: options.method || "GET",
          headers: options.headers,
          body: options.body
        }
      },
      "*"
    );
    return waitForApiResponse(requestId, timeoutMs);
  }
  async function pluginApiOnce(origin, path, options = {}, timeoutMs = 12e4) {
    const url = `${origin.replace(/\/$/, "")}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = __spreadValues({
        Authorization: `Bearer ${getApiSecret()}`,
        "x-admin-secret": getApiSecret()
      }, options.headers || {});
      if (options.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
      const res = await fetch(url, {
        method: options.method || "GET",
        headers,
        body: options.body,
        signal: controller.signal
      });
      let data = {};
      try {
        data = await res.json();
      } catch (e) {
        data = {};
      }
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("D\xE9lai d\xE9pass\xE9 \u2014 le serveur ne r\xE9pond pas (Render peut mettre ~1 min au 1er appel).");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  async function pluginApi(path, options = {}, timeoutMs = 12e4) {
    var _a;
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
    throw (_a = errors[0]) != null ? _a : new Error("Failed to fetch");
  }
  async function apiFetch(path, body) {
    const { ok, status, data } = await pluginApi(path, {
      method: "POST",
      body: JSON.stringify(body)
    });
    if (!ok) {
      throw new Error(data.message || `Erreur API (${status})`);
    }
    return data;
  }
  function explainApiError(status, message) {
    if (status === 401) {
      return "Acc\xE8s refus\xE9 \u2014 v\xE9rifie ADMIN_SECRET=mdp sur le serveur (Render).";
    }
    if (status === 404) {
      return "Route API introuvable \u2014 d\xE9ploie la derni\xE8re version du site sur foot-shop.fr.";
    }
    if (status === 503 && message === "prestashop_not_configured") {
      return "PrestaShop non configur\xE9 sur le serveur (PRESTASHOP_API_URL / KEY).";
    }
    return message || `Erreur ${status}`;
  }
  function applyCategoryOptions(list, savedCategoryId, defaultCategoryId) {
    var _a;
    if (!list.length) return false;
    categorySelect.innerHTML = list.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join("");
    const pickId = savedCategoryId || defaultCategoryId || ((_a = list[0]) == null ? void 0 : _a.id) || "";
    if (pickId) categorySelect.value = pickId;
    return true;
  }
  function loadEmbeddedCategories(savedCategoryId) {
    if (typeof PLUGIN_CATEGORIES === "undefined" || !PLUGIN_CATEGORIES.length) {
      return false;
    }
    const defaultId = typeof PLUGIN_DEFAULT_CATEGORY_ID !== "undefined" ? PLUGIN_DEFAULT_CATEGORY_ID : "";
    applyCategoryOptions(PLUGIN_CATEGORIES, savedCategoryId, defaultId);
    setStatus(`${PLUGIN_CATEGORIES.length} cat\xE9gorie(s) (cache) \u2014 sync serveur\u2026`);
    return true;
  }
  async function loadCategories(savedCategoryId) {
    const hadCache = loadEmbeddedCategories(savedCategoryId);
    if (!hadCache) {
      categorySelect.innerHTML = '<option value="">Chargement\u2026</option>';
      setStatus(`Connexion \xE0 ${getApiOrigin()}\u2026`);
    }
    const endpoints = ["/api/admin/product-import", "/api/admin/figma-import"];
    let lastError = "Cat\xE9gories indisponibles";
    for (const path of endpoints) {
      try {
        setStatus(`Sync ${path}\u2026`);
        const { ok, status, data } = await pluginApi(path);
        if (status === 404) {
          lastError = explainApiError(404, data.message);
          continue;
        }
        if (!ok) {
          lastError = `${explainApiError(status, data.message)} [${status}]`;
          if (PLUGIN_CATEGORIES == null ? void 0 : PLUGIN_CATEGORIES.length) {
            setStatus(`${PLUGIN_CATEGORIES.length} cat\xE9gorie(s) en cache \u2014 ${lastError}`, true);
            return true;
          }
          break;
        }
        const list = data.categories || [];
        if (!list.length) {
          lastError = "Aucune cat\xE9gorie PrestaShop";
          continue;
        }
        applyCategoryOptions(list, savedCategoryId, data.defaultCategoryId);
        setStatus(`${list.length} cat\xE9gorie(s) synchronis\xE9e(s).`);
        return true;
      } catch (err) {
        lastError = formatError(err);
      }
    }
    if (PLUGIN_CATEGORIES == null ? void 0 : PLUGIN_CATEGORIES.length) {
      setStatus(`${PLUGIN_CATEGORIES.length} cat\xE9gorie(s) en cache \u2014 sync \xE9chou\xE9e : ${lastError}`, true);
      return true;
    }
    categorySelect.innerHTML = `<option value="">${escapeHtml(lastError)}</option>`;
    setStatus(`Cat\xE9gories : ${lastError}`, true);
    return false;
  }
  function saveCategorySelection() {
    parent.postMessage(
      { pluginMessage: { type: "save-category", categoryId: categorySelect.value } },
      "*"
    );
  }
  async function scrapeViaMain(url) {
    const requestId = nextRequestId();
    parent.postMessage(
      { pluginMessage: { type: "scrape-product", requestId, url } },
      "*"
    );
    return waitForPluginMessage("scrape-done", requestId);
  }
  async function apiGet(path, query, timeoutMs = 12e4) {
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
          bytes: Array.from(base64ToBytes(data.imageBase64))
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
    setStatus("Scrape via serveur Foot Shop (Render)\u2026");
    try {
      return await scrapeViaApiPost(url);
    } catch (err) {
      apiErrors.push(err instanceof Error ? err.message : String(err));
    }
    for (const path of ["/api/admin/figma-import", "/api/admin/product-import"]) {
      try {
        setStatus("Analyse via API Foot Shop\u2026");
        const preview = await apiGet(path, { previewUrl: url }, 12e4);
        if (!preview.imageUrl) {
          throw new Error("Aucune image produit trouv\xE9e sur cette page.");
        }
        const image = await apiGet(
          path,
          {
            imageUrl: preview.imageUrl,
            referer: preview.sourceUrl || url
          },
          12e4
        );
        if (!image.imageBase64) {
          throw new Error("Image serveur manquante.");
        }
        return {
          name: preview.name || "Maillot",
          mimeType: image.mimeType || "image/jpeg",
          bytes: Array.from(base64ToBytes(image.imageBase64))
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        apiErrors.push(message);
        if (/404|introuvable|unknown_action/i.test(message)) continue;
        break;
      }
    }
    setStatus("API indisponible \u2014 scrape Figma local (fournisseur)\u2026");
    try {
      const scraped = await scrapeViaMain(url);
      return {
        name: scraped.name || "Maillot",
        mimeType: scraped.mimeType || "image/jpeg",
        bytes: scraped.bytes
      };
    } catch (localErr) {
      const localMsg = formatError(localErr, "scrape");
      const apiHint = apiErrors.filter(Boolean).slice(-2).join(" \xB7 ");
      throw new Error(
        apiHint ? `API Foot Shop : ${apiHint} \xB7 ${localMsg}` : localMsg
      );
    }
  }
  async function pushToPrestaShop(item, imageBase64) {
    const payload = {
      action: "push",
      name: item.name,
      sourceUrl: item.url,
      imageBase64,
      imageMime: "image/png",
      categoryId: categorySelect.value || void 0,
      price: FIGMA_PRICE,
      stock: FIGMA_STOCK
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
    throw new Error("Envoi PrestaShop indisponible \u2014 d\xE9ploie la derni\xE8re version du site.");
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
          bytes: Array.from(normalizedBytes)
        }
      },
      "*"
    );
    const msg = await waitForPluginMessage("card-created", requestId);
    return { frameId: msg.frameId, nodeName: msg.nodeName };
  }
  async function exportFigmaFrame(frameId) {
    const requestId = nextRequestId();
    parent.postMessage(
      { pluginMessage: { type: "export-frame", requestId, frameId } },
      "*"
    );
    const msg = await waitForPluginMessage("frame-exported", requestId);
    return new Uint8Array(msg.bytes);
  }
  function canonicalProductUrl(raw) {
    let value = String(raw || "").trim();
    value = value.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/^[Ee]rreur\s*:\s*(?:URL invalide\s*:\s*)?/i, "");
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
      throw new Error(`URL invalide : ${value.slice(0, 120)}${value.length > 120 ? "\u2026" : ""}`);
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
      } catch (e) {
      }
    }
    return canonical;
  }
  function formatError(err, context = "auto") {
    if (err instanceof Error && err.name === "AbortError") return "Annul\xE9.";
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    if (/^(Téléchargement page\/image|Connexion foot-shop|Accès refusé|Route API|Réseau Figma bloqué|API Foot Shop)/.test(
      message
    )) {
      return message;
    }
    if (isNetworkError(message)) {
      if (context === "scrape" || /Réseau Figma bloqué|HTTP \d|Impossible de télécharger/i.test(message)) {
        return message.includes("R\xE9seau Figma bloqu\xE9") ? message : `T\xE9l\xE9chargement page/image impossible (${message}) \u2014 importe manifest.json v3 et lance le plugin \xAB v3 \xBB.`;
      }
      return `Connexion foot-shop.fr impossible \u2014 d\xE9ploie la derni\xE8re version sur Render, reload le plugin, r\xE9essaie. (${message})`;
    }
    if (/unauthorized|401/i.test(message)) {
      return "Acc\xE8s refus\xE9 \u2014 ADMIN_SECRET du plugin (build) \u2260 celui sur Render.";
    }
    return message;
  }
  function describeNetworkChecks(checks) {
    if (!(checks == null ? void 0 : checks.length)) return "";
    const failed = checks.filter((check) => !check.ok);
    const internetOk = checks.some((check) => check.ok && check.label === "internet");
    const onrenderOk = checks.some((check) => check.ok && check.label === "foot-shop.onrender.com");
    const footShopOk = checks.some(
      (check) => check.ok && (check.label === "foot-shop.fr" || check.label === "www.foot-shop.fr")
    );
    if (failed.length === checks.length) {
      return "R\xE9seau Figma totalement bloqu\xE9 \u2014 importe manifest.json v3 (Import plugin from manifest), lance \xAB Foot Shop - Import maillot v3 \xBB.";
    }
    if (internetOk && (onrenderOk || footShopOk)) {
      return "R\xE9seau OK \u2014 le serveur Foot Shop est joignable depuis Figma.";
    }
    if (internetOk && !onrenderOk && !footShopOk) {
      return "Internet OK mais Foot Shop injoignable \u2014 d\xE9ploie maillot-store sur Render (foot-shop.onrender.com).";
    }
    if (failed.length) {
      return `R\xE9seau partiel : ${failed.map((check) => check.label).join(", ")} inaccessible(s).`;
    }
    return "R\xE9seau OK.";
  }
  function renderNetworkChecks(checks) {
    if (!networkPanel) return;
    if (!(checks == null ? void 0 : checks.length)) {
      networkPanel.textContent = "Aucun test r\xE9seau.";
      return;
    }
    networkPanel.innerHTML = checks.map((check) => {
      const icon = check.ok ? "\u2713" : "\u2717";
      const detail = check.ok ? `HTTP ${check.status}` : check.error || "bloqu\xE9";
      return `<div class="net-row ${check.ok ? "ok" : "fail"}">${icon} ${escapeHtml(check.label)} \u2014 ${escapeHtml(String(detail))}</div>`;
    }).join("");
  }
  async function runNetworkTest() {
    const requestId = nextRequestId();
    setStatus("Test r\xE9seau Figma\u2026");
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
    setStatus("Annul\xE9.");
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
    setStatus("D\xE9marrage\u2026");
    let ok = 0;
    try {
      for (let i = 0; i < urls.length; i++) {
        checkCancelled();
        const url = urls[i];
        try {
          setStatus(`${i + 1}/${urls.length} \u2014 Analyse page (Foot Shop)\u2026`);
          const scraped = await scrapeProduct(url);
          const name2 = scraped.name || "Maillot";
          const bytes = new Uint8Array(scraped.bytes);
          const mimeType = scraped.mimeType || "image/jpeg";
          setStatus(`${i + 1}/${urls.length} \u2014 Validation packshot\u2026`);
          const analysis = await analyzePackshot(bytes, mimeType);
          if (!analysis.ok) {
            throw new Error(analysis.reason || "Image non conforme (pas un packshot face).");
          }
          setStatus(`${i + 1}/${urls.length} \u2014 D\xE9tourage + normalisation\u2026`);
          const normalized = await runPipelineToBytes(bytes, mimeType);
          setStatus(`${i + 1}/${urls.length} \u2014 Cr\xE9ation fiche Figma\u2026`);
          const card = await createFigmaCard(normalized, {
            name: name2,
            url,
            placementIndex: ok,
            batchTotal: urls.length
          });
          pendingQueue.push({
            url,
            name: name2,
            frameId: card.frameId,
            status: "Pr\xEAt \u2014 en attente validation"
          });
          ok++;
          renderPending();
        } catch (err) {
          if (batchCancelled || err instanceof Error && err.name === "AbortError") break;
          pendingQueue.push({
            url,
            name: name || url.split("/").filter(Boolean).pop() || "Maillot",
            frameId: "",
            status: `Erreur : ${formatError(err)}`
          });
          renderPending();
          await sleep(800);
        }
      }
      if (batchCancelled) {
        setStatus(`Annul\xE9 \u2014 ${ok} fiche(s) pr\xE9par\xE9e(s).`, ok === 0);
      } else {
        setStatus(`${ok}/${urls.length} fiche(s) pr\xEAte(s). V\xE9rifie dans Figma puis valide.`, ok === 0);
      }
    } catch (err) {
      setStatus(formatError(err), true);
    }
    setBusy(false);
  };
  pushBtn.onclick = async () => {
    var _a, _b;
    const ready = pendingQueue.filter((p) => p.status.startsWith("Pr\xEAt") && p.frameId);
    if (!ready.length) {
      setStatus("Aucune fiche pr\xEAte \xE0 envoyer.", true);
      return;
    }
    resetBatchState();
    setBusy(true);
    let ok = 0;
    try {
      for (let i = 0; i < ready.length; i++) {
        checkCancelled();
        const item = ready[i];
        setStatus(`${i + 1}/${ready.length} \u2014 Export Figma ${item.name.slice(0, 36)}\u2026`);
        const pngBytes = await exportFigmaFrame(item.frameId);
        const base64 = bytesToBase64(pngBytes);
        setStatus(`${i + 1}/${ready.length} \u2014 Envoi PrestaShop\u2026`);
        const result = await pushToPrestaShop(item, base64);
        item.status = `Envoy\xE9 \u2713 (#${((_a = result.result) == null ? void 0 : _a.productId) || "?"})`;
        item.productId = (_b = result.result) == null ? void 0 : _b.productId;
        ok++;
        renderPending();
      }
      setStatus(`${ok}/${ready.length} produit(s) cr\xE9\xE9(s) sur PrestaShop \u2713`, ok === 0);
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
    }
  };
  window.onerror = (_message, _source, _line, _col, err) => {
    setStatus(err instanceof Error ? err.message : "Erreur JavaScript.", true);
    setBusy(false);
  };
  renderPending();
  parent.postMessage({ pluginMessage: { type: "ui-ready" } }, "*");
})();
