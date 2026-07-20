/// <reference types="@figma/plugin-typings" />

const AUTO_DEBOUNCE_MS = 450;

let busy = false;
let autoTimer: ReturnType<typeof setTimeout> | undefined;

figma.showUI(__html__, { width: 320, height: 200, themeColors: true });

figma.ui.onmessage = async (msg: UiMessage) => {
  if (msg.type === "ui-ready") {
    figma.ui.postMessage({ type: "init" });
    scheduleAutoRemove();
    return;
  }

  if (msg.type === "remove-bg") {
    await runRemoveBg();
    return;
  }

  if (msg.type === "apply-result") {
    try {
      await applyCutout(msg.nodeId, msg.nodeName, msg.bytes);
      figma.ui.postMessage({ type: "done" });
    } catch (err) {
      figma.ui.postMessage({
        type: "error",
        message: err instanceof Error ? err.message : "Impossible d'appliquer l'image.",
      });
    } finally {
      busy = false;
    }
  }
};

figma.on("selectionchange", () => {
  scheduleAutoRemove();
});

function scheduleAutoRemove() {
  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => {
    void runRemoveBg({ auto: true });
  }, AUTO_DEBOUNCE_MS);
}

async function runRemoveBg(opts?: { auto?: boolean }) {
  if (busy) return;

  const selection = figma.currentPage.selection;
  if (selection.length !== 1) {
    if (!opts?.auto) {
      figma.ui.postMessage({
        type: "error",
        message: "Sélectionnez un seul calque (image, frame, rectangle…).",
      });
    } else {
      figma.ui.postMessage({ type: "status", message: "Sélectionnez une image…" });
    }
    return;
  }

  const node = selection[0]!;
  if (!("exportAsync" in node) || typeof node.exportAsync !== "function") {
    if (!opts?.auto) {
      figma.ui.postMessage({
        type: "error",
        message: "Ce type de calque ne peut pas être exporté.",
      });
    }
    return;
  }

  busy = true;
  figma.ui.postMessage({
    type: "status",
    message: opts?.auto ? "Détourage automatique…" : "Export du calque…",
  });

  try {
    const bytes = await node.exportAsync({
      format: "PNG",
      constraint: { type: "SCALE", value: 2 },
    });

    figma.ui.postMessage({
      type: "process",
      nodeId: node.id,
      nodeName: node.name,
      bytes: Array.from(bytes),
    });
  } catch (err) {
    busy = false;
    figma.ui.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : "Export impossible.",
    });
  }
}

async function applyCutout(nodeId: string, nodeName: string, bytes: number[]) {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node || !("fills" in node)) {
    throw new Error("Calque introuvable.");
  }

  const image = figma.createImage(new Uint8Array(bytes));
  const fills = Array.isArray(node.fills) ? [...node.fills] : [];
  const imageIndex = fills.findIndex((fill) => fill.type === "IMAGE");
  const newFill: ImagePaint = {
    type: "IMAGE",
    scaleMode: "FIT",
    imageHash: image.hash,
  };

  if (imageIndex >= 0) {
    fills[imageIndex] = newFill;
  } else {
    fills.unshift(newFill);
  }

  node.fills = fills;
  figma.notify(`Fond retiré — ${nodeName}`);
}

type UiMessage =
  | { type: "ui-ready" }
  | { type: "remove-bg" }
  | {
      type: "apply-result";
      nodeId: string;
      nodeName: string;
      bytes: number[];
    };

declare const __html__: string;
