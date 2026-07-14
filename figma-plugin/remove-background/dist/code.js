"use strict";
(() => {
  // src/code.ts
  var STORAGE_KEY = "remove_bg_api_key";
  figma.showUI("", { width: 340, height: 320, themeColors: true });
  void figma.clientStorage.getAsync(STORAGE_KEY).then((key) => {
    figma.ui.postMessage({ type: "init", apiKey: typeof key === "string" ? key : "" });
  });
  figma.ui.onmessage = async (msg) => {
    if (msg.type === "save-key") {
      await figma.clientStorage.setAsync(STORAGE_KEY, msg.apiKey.trim());
      figma.notify("Cl\xE9 API enregistr\xE9e");
      return;
    }
    if (msg.type === "remove-bg") {
      const apiKey = msg.apiKey.trim();
      if (!apiKey) {
        figma.ui.postMessage({ type: "error", message: "Ajoutez votre cl\xE9 API remove.bg." });
        return;
      }
      const selection = figma.currentPage.selection;
      if (selection.length !== 1) {
        figma.ui.postMessage({
          type: "error",
          message: "S\xE9lectionnez un seul calque (image, frame, rectangle\u2026)."
        });
        return;
      }
      const node = selection[0];
      if (!("exportAsync" in node) || typeof node.exportAsync !== "function") {
        figma.ui.postMessage({ type: "error", message: "Ce type de calque ne peut pas \xEAtre export\xE9." });
        return;
      }
      try {
        figma.ui.postMessage({ type: "status", message: "Export du calque\u2026" });
        const bytes = await node.exportAsync({
          format: "PNG",
          constraint: { type: "SCALE", value: 2 }
        });
        figma.ui.postMessage({
          type: "process",
          apiKey,
          nodeId: node.id,
          nodeName: node.name,
          bytes: Array.from(bytes)
        });
      } catch (err) {
        figma.ui.postMessage({
          type: "error",
          message: err instanceof Error ? err.message : "Export impossible."
        });
      }
      return;
    }
    if (msg.type === "apply-result") {
      try {
        const node = await figma.getNodeByIdAsync(msg.nodeId);
        if (!node || !("fills" in node)) {
          throw new Error("Calque introuvable.");
        }
        const image = figma.createImage(new Uint8Array(msg.bytes));
        const fills = Array.isArray(node.fills) ? [...node.fills] : [];
        const imageIndex = fills.findIndex((f) => f.type === "IMAGE");
        const newFill = {
          type: "IMAGE",
          scaleMode: "FILL",
          imageHash: image.hash
        };
        if (imageIndex >= 0) {
          fills[imageIndex] = newFill;
        } else {
          fills.unshift(newFill);
        }
        node.fills = fills;
        figma.notify(`Fond retir\xE9 \u2014 ${msg.nodeName}`);
        figma.ui.postMessage({ type: "done" });
      } catch (err) {
        figma.ui.postMessage({
          type: "error",
          message: err instanceof Error ? err.message : "Impossible d'appliquer l'image."
        });
      }
    }
  };
})();
