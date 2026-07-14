/// <reference types="@figma/plugin-typings" />

import { scrapeProductUrl } from "./scrape-main.js";

const STORAGE_CATEGORY = "footshop_category_id";

const CARD_W = 328;
const CARD_H = 411;
const CARD_GAP = 20;
const CARD_COLS = 3;
const CARD_BG = { r: 0xee / 255, g: 0xee / 255, b: 0xee / 255 };
const HALO_BLUR = 119.1;

async function sendInit() {
  const categoryId = await figma.clientStorage.getAsync(STORAGE_CATEGORY);
  const networkChecks = await probeNetworkAccess();
  figma.ui.postMessage({
    type: "init",
    categoryId: typeof categoryId === "string" ? categoryId : "",
    networkChecks,
  });
}

figma.ui.onmessage = async (msg: UiMessage) => {
  if (msg.type === "ui-ready") {
    await sendInit();
    return;
  }

  if (msg.type === "network-test") {
    const checks = await probeNetworkAccess();
    figma.ui.postMessage({
      type: "network-test-result",
      requestId: msg.requestId,
      checks,
    });
    return;
  }

  if (msg.type === "api-request") {
    const origins = uniqueOrigins(__PLUGIN_API_ORIGINS__, __PLUGIN_API_ORIGIN__);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${__PLUGIN_ADMIN_SECRET__}`,
      "x-admin-secret": __PLUGIN_ADMIN_SECRET__,
      ...(msg.headers ?? {}),
    };
    if (msg.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    let lastError = "Network error";
    for (const origin of origins) {
      const url = `${origin.replace(/\/$/, "")}${msg.path}`;
      try {
        const res = await fetch(url, {
          method: msg.method ?? "GET",
          headers,
          body: msg.body,
        });
        const body = await res.text();
        figma.ui.postMessage({
          type: "api-response",
          requestId: msg.requestId,
          ok: res.ok,
          status: res.status,
          body,
        });
        return;
      } catch (err) {
        lastError =
          err instanceof Error && err.message ? err.message : "Network error";
      }
    }

    figma.ui.postMessage({
      type: "api-response",
      requestId: msg.requestId,
      ok: false,
      status: 0,
      body: "",
      error: lastError,
    });
    return;
  }

  if (msg.type === "save-category") {
    await figma.clientStorage.setAsync(STORAGE_CATEGORY, msg.categoryId.trim());
    return;
  }

  if (msg.type === "scrape-product") {
    try {
      const result = await scrapeProductUrl(msg.url);
      figma.ui.postMessage({
        type: "scrape-done",
        requestId: msg.requestId,
        name: result.name,
        mimeType: result.mimeType,
        bytes: Array.from(result.bytes),
      });
    } catch (err) {
      figma.ui.postMessage({
        type: "scrape-error",
        requestId: msg.requestId,
        message: err instanceof Error ? err.message : "Scrape impossible.",
      });
    }
    return;
  }

  if (msg.type === "export-frame") {
    try {
      const node = await figma.getNodeByIdAsync(msg.frameId);
      if (!node || !("exportAsync" in node) || typeof node.exportAsync !== "function") {
        throw new Error("Fiche Figma introuvable.");
      }

      const bytes = await node.exportAsync({
        format: "PNG",
        constraint: { type: "SCALE", value: 2 },
      });

      figma.ui.postMessage({
        type: "frame-exported",
        requestId: msg.requestId,
        bytes: Array.from(bytes),
      });
    } catch (err) {
      figma.ui.postMessage({
        type: "export-error",
        requestId: msg.requestId,
        message: err instanceof Error ? err.message : "Export impossible.",
      });
    }
    return;
  }

  if (msg.type === "apply-result") {
    try {
      const { x, y } = resolveCardPosition(msg);
      const frame = buildProductCard(new Uint8Array(msg.bytes), msg.nodeName, x, y);
      figma.ui.postMessage({
        type: "card-created",
        requestId: msg.requestId,
        frameId: frame.id,
        nodeName: msg.nodeName,
        sourceUrl: msg.sourceUrl ?? "",
      });
    } catch (err) {
      figma.ui.postMessage({
        type: "card-error",
        requestId: msg.requestId,
        message: err instanceof Error ? err.message : "Impossible de créer la fiche.",
      });
    }
    return;
  }
};

figma.showUI(__html__, { width: 380, height: 480 });

function resolveCardPosition(msg: Extract<UiMessage, { type: "apply-result" }>) {
  const total = Math.max(1, msg.batchTotal ?? 1);
  const index = msg.placementIndex ?? 0;
  const rows = Math.ceil(total / CARD_COLS);
  const cols = Math.min(total, CARD_COLS);
  const gridW = cols * CARD_W + (cols - 1) * CARD_GAP;
  const gridH = rows * CARD_H + (rows - 1) * CARD_GAP;

  const originX = figma.viewport.center.x - gridW / 2;
  const originY = figma.viewport.center.y - gridH / 2;
  const col = index % CARD_COLS;
  const row = Math.floor(index / CARD_COLS);

  return {
    x: originX + col * (CARD_W + CARD_GAP),
    y: originY + row * (CARD_H + CARD_GAP),
  };
}

function buildProductCard(imageBytes: Uint8Array, name: string, x: number, y: number): FrameNode {
  const image = figma.createImage(imageBytes);
  const imageFill: ImagePaint = {
    type: "IMAGE",
    scaleMode: "FILL",
    imageHash: image.hash,
  };

  const frame = figma.createFrame();
  frame.name = name || "Maillot";
  frame.resize(CARD_W, CARD_H);
  frame.x = x;
  frame.y = y;
  frame.fills = [{ type: "SOLID", color: CARD_BG }];
  frame.clipsContent = true;

  const halo = figma.createRectangle();
  halo.name = "Halo";
  halo.resize(CARD_W, CARD_H);
  halo.opacity = 0.37;
  halo.fills = [imageFill];
  halo.effects = [
    { type: "LAYER_BLUR", radius: HALO_BLUR, visible: true, blurType: "NORMAL" },
  ];

  const jersey = figma.createRectangle();
  jersey.name = "Maillot";
  jersey.resize(CARD_W, CARD_H);
  jersey.fills = [{ type: "IMAGE", scaleMode: "FILL", imageHash: image.hash }];

  frame.appendChild(halo);
  frame.appendChild(jersey);
  figma.currentPage.appendChild(frame);

  return frame;
}

type UiMessage =
  | { type: "ui-ready" }
  | { type: "network-test"; requestId: string }
  | {
      type: "api-request";
      requestId: string;
      path: string;
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    }
  | { type: "save-category"; categoryId: string }
  | {
      type: "apply-result";
      requestId: string;
      nodeName: string;
      sourceUrl?: string;
      placementIndex?: number;
      batchTotal?: number;
      bytes: number[];
    }
  | { type: "export-frame"; requestId: string; frameId: string }
  | { type: "scrape-product"; requestId: string; url: string };

declare const __html__: string;
declare const __PLUGIN_API_ORIGIN__: string;
declare const __PLUGIN_API_ORIGINS__: string;
declare const __PLUGIN_ADMIN_SECRET__: string;

function uniqueOrigins(originsJson: string, fallbackOrigin: string): string[] {
  const origins: string[] = [];
  const add = (value: string) => {
    const normalized = value.replace(/\/$/, "");
    if (normalized && !origins.includes(normalized)) origins.push(normalized);
  };

  try {
    const parsed = JSON.parse(originsJson) as unknown;
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item === "string") add(item);
      }
    }
  } catch {
    // ignore invalid JSON
  }

  add("https://foot-shop.onrender.com");
  add(fallbackOrigin);
  add("https://foot-shop.fr");
  add("https://www.foot-shop.fr");
  return origins;
}

type NetworkCheck = {
  label: string;
  ok: boolean;
  status: number;
  error?: string;
};

async function probeNetworkAccess(): Promise<NetworkCheck[]> {
  const origins = uniqueOrigins(__PLUGIN_API_ORIGINS__, __PLUGIN_API_ORIGIN__);
  const authHeaders = {
    Authorization: `Bearer ${__PLUGIN_ADMIN_SECRET__}`,
    "x-admin-secret": __PLUGIN_ADMIN_SECRET__,
  };
  const checks: NetworkCheck[] = [];

  const tasks: { label: string; url: string; headers?: Record<string, string> }[] = [
    { label: "internet", url: "https://httpbin.org/get" },
  ];

  for (const origin of origins.slice(0, 3)) {
    tasks.push({
      label: origin.replace(/^https:\/\//, ""),
      url: `${origin.replace(/\/$/, "")}/api/admin/product-import?pluginSecret=${encodeURIComponent(__PLUGIN_ADMIN_SECRET__)}`,
      headers: authHeaders,
    });
  }

  for (const task of tasks) {
    try {
      const res = await fetch(task.url, { headers: task.headers });
      checks.push({ label: task.label, ok: true, status: res.status });
    } catch (err) {
      checks.push({
        label: task.label,
        ok: false,
        status: 0,
        error: err instanceof Error ? err.message : "failed to fetch",
      });
    }
  }

  return checks;
}
