import type { AssetNode, InteractionNode, LayerDoc, LayerNode } from "../layerdoc/types.js";
import { renderResponsiveCss } from "./responsiveCss.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeStyleText(value: string): string {
  return value.replace(/<\/style/gi, "<\\/style");
}

function styleFor(layer: LayerNode): string {
  const declarations = [
    "position:absolute",
    `left:${layer.bounds.x}px`,
    `top:${layer.bounds.y}px`,
    `width:${layer.bounds.width}px`,
    `height:${layer.bounds.height}px`
  ];

  if (layer.style?.backgroundColor) {
    declarations.push(`background-color:${escapeHtml(layer.style.backgroundColor)}`);
  }
  if (layer.style?.textColor) {
    declarations.push(`color:${escapeHtml(layer.style.textColor)}`);
  }
  if (layer.style?.borderColor) {
    declarations.push(`border-color:${escapeHtml(layer.style.borderColor)}`);
  }
  if (layer.style?.borderRadius !== undefined) {
    declarations.push(`border-radius:${layer.style.borderRadius}px`);
  }
  if (layer.style?.padding) {
    const vertical = layer.style.padding.y ?? layer.style.padding.top ?? layer.style.padding.bottom ?? 0;
    const horizontal = layer.style.padding.x ?? layer.style.padding.left ?? layer.style.padding.right ?? 0;
    declarations.push(`padding:${vertical}px ${horizontal}px`);
  }
  if (layer.style?.gap !== undefined) {
    declarations.push(`gap:${layer.style.gap}px`);
  }
  if (layer.style?.opacity !== undefined) {
    declarations.push(`opacity:${layer.style.opacity}`);
  }

  return declarations.join(";");
}

function assetById(doc: LayerDoc, assetId: string | undefined): AssetNode | undefined {
  if (!assetId) {
    return undefined;
  }
  return doc.assets.find((asset) => asset.id === assetId);
}

function visibleLayers(doc: LayerDoc): LayerNode[] {
  const hiddenSectionIds = new Set(doc.sections.filter((section) => section.visible === false).map((section) => section.id));
  return doc.layers.filter((layer) => !layer.sectionId || !hiddenSectionIds.has(layer.sectionId));
}

function interactionsForLayer(doc: LayerDoc, layerId: string): InteractionNode[] {
  return doc.interactions.filter((interaction) => interaction.layerId === layerId);
}

function interactionAttributes(doc: LayerDoc, layer: LayerNode): string {
  const interactions = interactionsForLayer(doc, layer.id);
  if (interactions.length === 0) {
    return "";
  }

  return ` data-interaction-ids="${escapeHtml(interactions.map((interaction) => interaction.id).join(" "))}" data-interaction-events="${escapeHtml(interactions.map((interaction) => interaction.event).join(" "))}" data-interaction-actions="${escapeHtml(interactions.map((interaction) => interaction.action).join(" "))}"`;
}

function renderLayer(doc: LayerDoc, layer: LayerNode): string {
  const common = `data-layer-id="${escapeHtml(layer.id)}" data-kind="${layer.kind}" data-track="${layer.track}"${interactionAttributes(doc, layer)} style="${styleFor(layer)}"`;

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
  const layers = visibleLayers(doc).map((layer) => renderLayer(doc, layer)).join("\n    ");
  const responsiveCss = renderResponsiveCss(doc);
  const responsiveStyle = responsiveCss ? `\n    <style>\n${escapeStyleText(responsiveCss)}\n    </style>` : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(doc.metadata.name)}</title>
    ${responsiveStyle}
  </head>
  <body style="margin:0;background:${background};">
    <main data-layerdoc="${doc.version}" style="position:relative;width:${doc.canvas.width}px;height:${doc.canvas.height}px;overflow:hidden;background:${background};">
    ${layers}
    </main>
  </body>
</html>`;
}
