import type { AssetNode, ComponentNode, InteractionNode, LayerDoc, LayerNode, LayerStyle, Rect, SectionNode } from "../layerdoc/types.js";
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

function rectDeclarations(bounds: Rect): string[] {
  return [
    "position:absolute",
    `left:${bounds.x}px`,
    `top:${bounds.y}px`,
    `width:${bounds.width}px`,
    `height:${bounds.height}px`
  ];
}

function styleFor(bounds: Rect, style?: LayerStyle): string {
  const declarations = [
    ...rectDeclarations(bounds)
  ];

  if (style?.backgroundColor) {
    declarations.push(`background-color:${escapeHtml(style.backgroundColor)}`);
  }
  if (style?.textColor) {
    declarations.push(`color:${escapeHtml(style.textColor)}`);
  }
  if (style?.borderColor) {
    declarations.push(`border-color:${escapeHtml(style.borderColor)}`);
  }
  if (style?.borderRadius !== undefined) {
    declarations.push(`border-radius:${style.borderRadius}px`);
  }
  if (style?.padding) {
    const vertical = style.padding.y ?? style.padding.top ?? style.padding.bottom ?? 0;
    const horizontal = style.padding.x ?? style.padding.left ?? style.padding.right ?? 0;
    declarations.push(`padding:${vertical}px ${horizontal}px`);
  }
  if (style?.gap !== undefined) {
    declarations.push(`gap:${style.gap}px`);
  }
  if (style?.opacity !== undefined) {
    declarations.push(`opacity:${style.opacity}`);
  }

  return declarations.join(";");
}

function relativeBounds(bounds: Rect, origin: Rect): Rect {
  return {
    x: bounds.x - origin.x,
    y: bounds.y - origin.y,
    width: bounds.width,
    height: bounds.height
  };
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

function visibleLayerIds(doc: LayerDoc): Set<string> {
  return new Set(visibleLayers(doc).map((layer) => layer.id));
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

function renderLayer(doc: LayerDoc, layer: LayerNode, bounds: Rect = layer.bounds): string {
  const common = `data-layer-id="${escapeHtml(layer.id)}" data-kind="${layer.kind}" data-track="${layer.track}"${interactionAttributes(doc, layer)} style="${styleFor(bounds, layer.style)}"`;

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

function sectionLayers(doc: LayerDoc, section: SectionNode): LayerNode[] {
  const byId = new Map(doc.layers.map((layer) => [layer.id, layer]));
  return section.layerIds.map((layerId) => byId.get(layerId)).filter((layer): layer is LayerNode => Boolean(layer));
}

function sectionComponents(doc: LayerDoc, section: SectionNode): ComponentNode[] {
  const sectionLayerIds = new Set(section.layerIds);
  return doc.components.filter((component) => component.exportable && component.layerIds.some((layerId) => sectionLayerIds.has(layerId)));
}

function renderComponent(doc: LayerDoc, component: ComponentNode, origin: Rect, visibleIds: Set<string>): string {
  const componentLayers = component.layerIds
    .map((layerId) => doc.layers.find((layer) => layer.id === layerId))
    .filter((layer): layer is LayerNode => layer !== undefined && visibleIds.has(layer.id))
    .map((layer) => `      ${renderLayer(doc, layer, relativeBounds(layer.bounds, origin))}`)
    .join("\n");

  return `<div data-component-id="${escapeHtml(component.id)}" style="position:absolute;inset:0;">
${componentLayers}
    </div>`;
}

function renderSection(doc: LayerDoc, section: SectionNode, visibleIds: Set<string>): string {
  const components = sectionComponents(doc, section);
  const componentLayerIds = new Set(components.flatMap((component) => component.layerIds.filter((layerId) => visibleIds.has(layerId))));
  const componentNodes = components.map((component) => `    ${renderComponent(doc, component, section.bounds, visibleIds)}`);
  const layerNodes = sectionLayers(doc, section)
    .filter((layer) => !componentLayerIds.has(layer.id))
    .map((layer) => `    ${renderLayer(doc, layer, relativeBounds(layer.bounds, section.bounds))}`);
  const body = [...componentNodes, ...layerNodes].join("\n");

  return `<section data-section-id="${escapeHtml(section.id)}" style="${rectDeclarations(section.bounds).join(";")}">
${body}
  </section>`;
}

function visibleSections(doc: LayerDoc): SectionNode[] {
  return doc.sections.filter((section) => section.visible !== false);
}

/**
 * Render a deterministic HTML preview from LayerDoc.
 * This preview is not the final app; it is a verification surface where every
 * rendered node can be traced back to a layer id.
 */
export function renderHtmlPreview(doc: LayerDoc): string {
  const background = escapeHtml(doc.canvas.background ?? "#ffffff");
  const sectionLayerIds = new Set(visibleSections(doc).flatMap((section) => section.layerIds));
  const visibleIds = visibleLayerIds(doc);
  const sections = visibleSections(doc).map((section) => renderSection(doc, section, visibleIds)).join("\n    ");
  const layers = visibleLayers(doc)
    .filter((layer) => !sectionLayerIds.has(layer.id))
    .map((layer) => renderLayer(doc, layer))
    .join("\n    ");
  const body = [sections, layers].filter(Boolean).join("\n    ");
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
    ${body}
    </main>
  </body>
</html>`;
}
