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
  const rules = doc.responsive.rules.flatMap((rule) => {
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
