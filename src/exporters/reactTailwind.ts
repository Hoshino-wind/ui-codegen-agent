import type { AssetNode, LayerDoc, LayerNode, LayerStyle, Rect, SectionNode } from "../layerdoc/types.js";

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

function renderLayer(doc: LayerDoc, layer: LayerNode): string {
  const baseProps = `data-layer-id="${escapeAttribute(layer.id)}" data-kind="${layer.kind}" data-track="${layer.track}" className="absolute" style=${inlineStyle(layer.bounds, layer.style)}`;

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

function visibleSections(doc: LayerDoc): SectionNode[] {
  return doc.sections.filter((section) => section.visible !== false);
}

function renderSection(doc: LayerDoc, section: SectionNode): string {
  const layers = sectionLayers(doc, section)
    .map((layer) => `        ${renderLayer(doc, layer)}`)
    .join("\n");

  return `      <section data-section-id="${escapeAttribute(section.id)}" className="absolute" style=${inlineStyle(section.bounds)}>
${layers}
      </section>`;
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

  const sections = visibleSections(doc).map((section) => renderSection(doc, section)).join("\n");
  const orphanLayers = doc.layers
    .filter((layer) => !layer.sectionId)
    .map((layer) => `      ${renderLayer(doc, layer)}`)
    .join("\n");
  const body = [sections, orphanLayers].filter(Boolean).join("\n");

  return {
    fileName: `${options.componentName}.tsx`,
    code: `export function ${options.componentName}() {
  return (
    <main data-layerdoc-version="${doc.version}" className="relative overflow-hidden" style={{ width: ${doc.canvas.width}, height: ${doc.canvas.height}, background: "${doc.canvas.background ?? "#ffffff"}" }}>
${body}
    </main>
  );
}
`
  };
}
