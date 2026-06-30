import type { LayerDoc, ResponsiveTarget } from "../layerdoc/types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cssAttributeValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function selectorForTarget(target: ResponsiveTarget): string {
  if (target.type === "section") {
    return `[data-section-id="${cssAttributeValue(target.id)}"]`;
  }
  if (target.type === "component") {
    return `[data-component-id="${cssAttributeValue(target.id)}"]`;
  }
  return `[data-layer-id="${cssAttributeValue(target.id)}"]`;
}

function visibleSectionIds(doc: LayerDoc): Set<string> {
  return new Set(doc.sections.filter((section) => section.visible !== false).map((section) => section.id));
}

function visibleLayerIds(doc: LayerDoc): Set<string> {
  const hiddenSectionIds = new Set(doc.sections.filter((section) => section.visible === false).map((section) => section.id));
  return new Set(doc.layers.filter((layer) => !layer.sectionId || !hiddenSectionIds.has(layer.sectionId)).map((layer) => layer.id));
}

function visibleComponentIds(doc: LayerDoc, layerIds: Set<string>): Set<string> {
  return new Set(doc.components.filter((component) => component.layerIds.some((layerId) => layerIds.has(layerId))).map((component) => component.id));
}

function isVisibleTarget(target: ResponsiveTarget, sectionIds: Set<string>, layerIds: Set<string>, componentIds: Set<string>): boolean {
  if (target.type === "section") {
    return sectionIds.has(target.id);
  }
  if (target.type === "component") {
    return componentIds.has(target.id);
  }
  return layerIds.has(target.id);
}

function pxDeclaration(property: string, value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) ? `${property}:${value}px !important;` : null;
}

function rawDeclaration(property: string, value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? `${property}:${value} !important;` : null;
}

function numericDeclaration(property: string, value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) ? `${property}:${value} !important;` : null;
}

function numericSpacing(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function paddingValue(padding: Record<string, unknown>): string {
  const vertical = numericSpacing(padding.y) ?? numericSpacing(padding.top) ?? numericSpacing(padding.bottom) ?? 0;
  const horizontal = numericSpacing(padding.x) ?? numericSpacing(padding.left) ?? numericSpacing(padding.right) ?? 0;
  return `${vertical}px ${horizontal}px`;
}

function declarationsForChanges(changes: Record<string, unknown>): string[] {
  const declarations: Array<string | null> = [];
  const bounds = changes.bounds;
  const style = changes.style;

  if (isRecord(bounds)) {
    declarations.push(
      pxDeclaration("left", bounds.x),
      pxDeclaration("top", bounds.y),
      pxDeclaration("width", bounds.width),
      pxDeclaration("height", bounds.height)
    );
  }

  if (isRecord(style)) {
    declarations.push(
      rawDeclaration("background-color", style.backgroundColor),
      rawDeclaration("color", style.textColor),
      rawDeclaration("border-color", style.borderColor),
      pxDeclaration("border-radius", style.borderRadius),
      rawDeclaration("font-family", style.fontFamily),
      pxDeclaration("font-size", style.fontSize),
      numericDeclaration("font-weight", style.fontWeight),
      pxDeclaration("line-height", style.lineHeight),
      pxDeclaration("letter-spacing", style.letterSpacing),
      numericDeclaration("opacity", style.opacity),
      pxDeclaration("gap", style.gap)
    );

    if (isRecord(style.padding)) {
      declarations.push(`padding:${paddingValue(style.padding)} !important;`);
    }
  }

  if (changes.visible === false) {
    declarations.push("display:none !important;");
  }

  return declarations.filter((declaration): declaration is string => Boolean(declaration));
}

/**
 * Project validated responsive rules into CSS media queries.
 * LayerDoc still owns the structure; this function is only the deterministic
 * rendering adapter used by preview and generated React code.
 */
export function renderResponsiveCss(doc: LayerDoc): string {
  const sectionIds = visibleSectionIds(doc);
  const layerIds = visibleLayerIds(doc);
  const componentIds = visibleComponentIds(doc, layerIds);
  const rules = doc.responsive.rules.filter((rule) => isVisibleTarget(rule.target, sectionIds, layerIds, componentIds)).flatMap((rule) => {
    const declarations = declarationsForChanges(rule.changes);
    if (declarations.length === 0) {
      return [];
    }

    return [
      `@media ${rule.query} {\n  ${selectorForTarget(rule.target)} {\n    ${declarations.join("\n    ")}\n  }\n}`
    ];
  });

  return rules.join("\n\n");
}
