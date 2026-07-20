"use strict";
(() => {
  // src/code.ts
  var AUTO_DEBOUNCE_MS = 450;
  var busy = false;
  var autoTimer;
  figma.showUI(__html__, { width: 320, height: 200, themeColors: true });
  figma.ui.onmessage = async (msg) => {
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
          message: err instanceof Error ? err.message : "Impossible d'appliquer l'image."
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
  async function runRemoveBg(opts) {
    if (busy) return;
    const selection = figma.currentPage.selection;
    if (selection.length !== 1) {
      if (!(opts == null ? void 0 : opts.auto)) {
        figma.ui.postMessage({
          type: "error",
          message: "S\xE9lectionnez un seul calque (image, frame, rectangle\u2026)."
        });
      } else {
        figma.ui.postMessage({ type: "status", message: "S\xE9lectionnez une image\u2026" });
      }
      return;
    }
    const node = selection[0];
    if (!("exportAsync" in node) || typeof node.exportAsync !== "function") {
      if (!(opts == null ? void 0 : opts.auto)) {
        figma.ui.postMessage({
          type: "error",
          message: "Ce type de calque ne peut pas \xEAtre export\xE9."
        });
      }
      return;
    }
    busy = true;
    figma.ui.postMessage({
      type: "status",
      message: (opts == null ? void 0 : opts.auto) ? "D\xE9tourage automatique\u2026" : "Export du calque\u2026"
    });
    try {
      const bytes = await node.exportAsync({
        format: "PNG",
        constraint: { type: "SCALE", value: 2 }
      });
      figma.ui.postMessage({
        type: "process",
        nodeId: node.id,
        nodeName: node.name,
        bytes: Array.from(bytes)
      });
    } catch (err) {
      busy = false;
      figma.ui.postMessage({
        type: "error",
        message: err instanceof Error ? err.message : "Export impossible."
      });
    }
  }
  async function applyCutout(nodeId, nodeName, bytes) {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node || !("fills" in node)) {
      throw new Error("Calque introuvable.");
    }
    const image = figma.createImage(new Uint8Array(bytes));
    const fills = Array.isArray(node.fills) ? [...node.fills] : [];
    const imageIndex = fills.findIndex((fill) => fill.type === "IMAGE");
    const newFill = {
      type: "IMAGE",
      scaleMode: "FIT",
      imageHash: image.hash
    };
    if (imageIndex >= 0) {
      fills[imageIndex] = newFill;
    } else {
      fills.unshift(newFill);
    }
    node.fills = fills;
    figma.notify(`Fond retir\xE9 \u2014 ${nodeName}`);
  }
})();
