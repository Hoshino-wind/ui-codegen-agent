import type { AssetNode, LayerDoc, LayerNode } from "../layerdoc/types.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function styleFor(layer: LayerNode): string {
  return [
    "position:absolute",
    `left:${layer.bounds.x}px`,
    `top:${layer.bounds.y}px`,
    `width:${layer.bounds.width}px`,
    `height:${layer.bounds.height}px`
  ].join(";");
}

function assetById(doc: LayerDoc, assetId: string | undefined): AssetNode | undefined {
  if (!assetId) {
    return undefined;
  }
  return doc.assets.find((asset) => asset.id === assetId);
}

function renderLayer(doc: LayerDoc, layer: LayerNode): string {
  const common = `data-layer-id="${escapeHtml(layer.id)}" data-kind="${layer.kind}" data-track="${layer.track}" style="${styleFor(layer)}"`;

  if (layer.track === "asset") {
    const asset = assetById(doc, layer.assetId);
    const src = escapeHtml(asset?.uri ?? "");
    const alt = escapeHtml(layer.content?.alt ?? "");
    return `<img ${common} src="${src}" alt="${alt}" />`;
  }

  const text = escapeHtml(layer.content?.text ?? "");
  if (layer.kind === "button") {
    return `<button ${common} type="button">${text}</button>`;
  }
  if (layer.kind === "input") {
    return `<input ${common} value="${text}" />`;
  }

  return `<div ${common}>${text}</div>`;
}

/**
 * Render a deterministic HTML preview from LayerDoc.
 * This preview is not the final app; it is a verification surface where every
 * rendered node can be traced back to a layer id.
 */
export function renderHtmlPreview(doc: LayerDoc): string {
  const background = escapeHtml(doc.canvas.background ?? "#ffffff");
  const layers = doc.layers.map((layer) => renderLayer(doc, layer)).join("\n    ");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(doc.metadata.name)}</title>
  </head>
  <body style="margin:0;background:${background};">
    <main data-layerdoc="${doc.version}" style="position:relative;width:${doc.canvas.width}px;height:${doc.canvas.height}px;overflow:hidden;background:${background};">
    ${layers}
    </main>
  </body>
</html>`;
}
