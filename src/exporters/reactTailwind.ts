import type { AssetNode, ComponentNode, InteractionNode, LayerDoc, LayerNode, LayerStyle, Rect, SectionNode } from "../layerdoc/types.js";
import { renderResponsiveCss } from "./responsiveCss.js";

export interface ReactTailwindExportOptions {
  componentName: string;
}

export interface ReactTailwindExportResult {
  fileName: string;
  code: string;
}

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function isPascalCaseIdentifier(value: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(value);
}

function toPascalCase(value: string): string {
  const normalized = value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");

  return normalized && /^[A-Z]/.test(normalized) ? normalized : "LayerDocComponent";
}

function paddingValue(style: LayerStyle): string | undefined {
  if (!style.padding) {
    return undefined;
  }

  const vertical = style.padding.y ?? style.padding.top ?? style.padding.bottom ?? 0;
  const horizontal = style.padding.x ?? style.padding.left ?? style.padding.right ?? 0;
  return `${vertical}px ${horizontal}px`;
}

function inlineStyle(bounds: Rect, style?: LayerStyle): string {
  const entries = [`left: ${bounds.x}`, `top: ${bounds.y}`, `width: ${bounds.width}`, `height: ${bounds.height}`];

  if (style?.backgroundColor) {
    entries.push(`backgroundColor: ${JSON.stringify(style.backgroundColor)}`);
  }
  if (style?.textColor) {
    entries.push(`color: ${JSON.stringify(style.textColor)}`);
  }
  if (style?.borderColor) {
    entries.push(`borderColor: ${JSON.stringify(style.borderColor)}`);
  }
  if (style?.borderRadius !== undefined) {
    entries.push(`borderRadius: ${style.borderRadius}`);
  }
  if (style) {
    const padding = paddingValue(style);
    if (padding) {
      entries.push(`padding: ${JSON.stringify(padding)}`);
    }
  }
  if (style?.gap !== undefined) {
    entries.push(`gap: ${style.gap}`);
  }
  if (style?.opacity !== undefined) {
    entries.push(`opacity: ${style.opacity}`);
  }

  return `{{ ${entries.join(", ")} }}`;
}

function assetById(doc: LayerDoc, assetId: string | undefined): AssetNode | undefined {
  if (!assetId) {
    return undefined;
  }
  return doc.assets.find((asset) => asset.id === assetId);
}

function interactionsForLayer(doc: LayerDoc, layerId: string): InteractionNode[] {
  return doc.interactions.filter((interaction) => interaction.layerId === layerId);
}

function interactionAttributes(doc: LayerDoc, layer: LayerNode): string {
  const interactions = interactionsForLayer(doc, layer.id);
  if (interactions.length === 0) {
    return "";
  }

  return ` data-interaction-ids="${escapeAttribute(interactions.map((interaction) => interaction.id).join(" "))}" data-interaction-events="${escapeAttribute(interactions.map((interaction) => interaction.event).join(" "))}" data-interaction-actions="${escapeAttribute(interactions.map((interaction) => interaction.action).join(" "))}"`;
}

function relativeBounds(bounds: Rect, origin: Rect): Rect {
  return {
    x: bounds.x - origin.x,
    y: bounds.y - origin.y,
    width: bounds.width,
    height: bounds.height
  };
}

function renderLayer(doc: LayerDoc, layer: LayerNode, bounds: Rect = layer.bounds): string {
  const baseProps = `data-layer-id="${escapeAttribute(layer.id)}" data-kind="${layer.kind}" data-track="${layer.track}"${interactionAttributes(doc, layer)} className="absolute" style=${inlineStyle(bounds, layer.style)}`;

  if (layer.track === "asset") {
    const asset = assetById(doc, layer.assetId);
    const src = escapeAttribute(asset?.uri ?? "");
    const alt = escapeAttribute(layer.content?.alt ?? "");
    return `<img ${baseProps} src="${src}" alt="${alt}" />`;
  }

  const text = escapeText(layer.content?.text ?? "");
  if (layer.kind === "button") {
    return `<button ${baseProps} type="button">${text}</button>`;
  }

  return `<div ${baseProps}>${text}</div>`;
}

function sectionLayers(doc: LayerDoc, section: SectionNode): LayerNode[] {
  const byId = new Map(doc.layers.map((layer) => [layer.id, layer]));
  return section.layerIds.map((layerId) => byId.get(layerId)).filter((layer): layer is LayerNode => Boolean(layer));
}

function componentFunctionName(component: ComponentNode): string {
  return isPascalCaseIdentifier(component.id) ? component.id : toPascalCase(component.id);
}

function sectionComponents(doc: LayerDoc, section: SectionNode): ComponentNode[] {
  const sectionLayerIds = new Set(section.layerIds);
  return doc.components.filter((component) => component.exportable && component.layerIds.some((layerId) => sectionLayerIds.has(layerId)));
}

function visibleSections(doc: LayerDoc): SectionNode[] {
  return doc.sections.filter((section) => section.visible !== false);
}

function visibleExportableComponents(doc: LayerDoc): ComponentNode[] {
  const visibleLayerIds = new Set(visibleSections(doc).flatMap((section) => section.layerIds));
  return doc.components.filter((component) => component.exportable && component.layerIds.some((layerId) => visibleLayerIds.has(layerId)));
}

function renderSection(doc: LayerDoc, section: SectionNode): string {
  const components = sectionComponents(doc, section);
  const componentLayerIds = new Set(components.flatMap((component) => component.layerIds));
  const componentCalls = components.map((component) => `        <${componentFunctionName(component)} />`);
  const layers = sectionLayers(doc, section)
    .filter((layer) => !componentLayerIds.has(layer.id))
    .map((layer) => `        ${renderLayer(doc, layer, relativeBounds(layer.bounds, section.bounds))}`);
  const body = [...componentCalls, ...layers].join("\n");

  return `      <section data-section-id="${escapeAttribute(section.id)}" className="absolute" style=${inlineStyle(section.bounds)}>
${body}
      </section>`;
}

function renderComponent(doc: LayerDoc, component: ComponentNode): string | null {
  const layers = component.layerIds.map((layerId) => doc.layers.find((layer) => layer.id === layerId)).filter((layer): layer is LayerNode => Boolean(layer));
  if (layers.length === 0) {
    return null;
  }

  const section = doc.sections.find((candidate) => candidate.id === layers[0].sectionId);
  const origin = section?.bounds ?? { x: 0, y: 0, width: doc.canvas.width, height: doc.canvas.height };
  const componentLayers = layers
    .map((layer) => `      ${renderLayer(doc, layer, relativeBounds(layer.bounds, origin))}`)
    .join("\n");

  return `function ${componentFunctionName(component)}() {
  return (
    <div data-component-id="${escapeAttribute(component.id)}" className="absolute inset-0">
${componentLayers}
    </div>
  );
}
`;
}

function renderResponsiveStyleTag(doc: LayerDoc): string {
  const css = renderResponsiveCss(doc);
  return css ? "      <style>{`" + escapeText(css) + "`}</style>" : "";
}

/**
 * Export LayerDoc to a React + Tailwind component.
 * The first exporter deliberately preserves LayerDoc geometry with absolute
 * positioning; later passes can transform validated sections into responsive
 * Tailwind layouts without losing traceability.
 */
export function exportReactTailwind(doc: LayerDoc, options: ReactTailwindExportOptions): ReactTailwindExportResult {
  if (!isPascalCaseIdentifier(options.componentName)) {
    throw new Error("componentName must be a PascalCase identifier.");
  }

  const componentFunctions = visibleExportableComponents(doc)
    .map((component) => renderComponent(doc, component))
    .filter((component): component is string => Boolean(component))
    .join("\n");
  const sections = visibleSections(doc).map((section) => renderSection(doc, section)).join("\n");
  const orphanLayers = doc.layers
    .filter((layer) => !layer.sectionId)
    .map((layer) => `      ${renderLayer(doc, layer)}`)
    .join("\n");
  const responsiveStyle = renderResponsiveStyleTag(doc);
  const body = [responsiveStyle, sections, orphanLayers].filter(Boolean).join("\n");

  return {
    fileName: `${options.componentName}.tsx`,
    code: `${componentFunctions ? `${componentFunctions}\n` : ""}export function ${options.componentName}() {
  return (
    <main data-layerdoc-version="${doc.version}" className="relative overflow-hidden" style={{ width: ${doc.canvas.width}, height: ${doc.canvas.height}, background: "${doc.canvas.background ?? "#ffffff"}" }}>
${body}
    </main>
  );
}
`
  };
}
