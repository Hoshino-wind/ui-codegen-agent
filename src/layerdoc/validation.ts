import { classifyLayer } from "./classification.js";
import type { LayerDoc, Rect, ValidationResult, VerificationIssue } from "./types.js";

function issue(code: VerificationIssue["code"], path: string, message: string): VerificationIssue {
  return { code, path, message };
}

function isPositiveRect(rect: Rect): boolean {
  return rect.width > 0 && rect.height > 0;
}

function fitsCanvas(rect: Rect, canvas: LayerDoc["canvas"]): boolean {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= canvas.width && rect.y + rect.height <= canvas.height;
}

function collectDuplicateIds(ids: string[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.add(id);
    }
    seen.add(id);
  }
  return duplicates;
}

const analysisPlanSources = new Set(["seeded", "provided", "editor", "manual"]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validateAnalysisPlanProvenance(doc: LayerDoc, issues: VerificationIssue[]): void {
  const provenance = doc.metadata.analysisPlan;
  if (!provenance) {
    return;
  }

  if (!analysisPlanSources.has(provenance.source)) {
    issues.push(issue("metadata_invalid", "metadata.analysisPlan.source", `Analysis Plan source "${provenance.source}" is not supported.`));
  }
  if (!isNonEmptyString(provenance.name)) {
    issues.push(issue("metadata_invalid", "metadata.analysisPlan.name", "Analysis Plan name must be a non-empty string."));
  }
  if (!isNonNegativeNumber(provenance.sectionCount)) {
    issues.push(issue("metadata_invalid", "metadata.analysisPlan.sectionCount", "Analysis Plan sectionCount must be a non-negative number."));
  }
  if (!isNonNegativeNumber(provenance.layerCount)) {
    issues.push(issue("metadata_invalid", "metadata.analysisPlan.layerCount", "Analysis Plan layerCount must be a non-negative number."));
  }
  if (provenance.uri !== undefined && !isNonEmptyString(provenance.uri)) {
    issues.push(issue("metadata_invalid", "metadata.analysisPlan.uri", "Analysis Plan uri must be a non-empty string when provided."));
  }
}

/**
 * Validate a LayerDoc as an engineering asset, not just as JSON.
 * The checks intentionally target production risks: missing source assets,
 * impossible geometry, broken section membership, and dishonest track labels.
 */
export function validateLayerDoc(doc: LayerDoc): ValidationResult {
  const issues: VerificationIssue[] = [];
  const sectionIds = new Set(doc.sections.map((section) => section.id));
  const layerIds = new Set(doc.layers.map((layer) => layer.id));
  const componentIds = new Set(doc.components.map((component) => component.id));
  const sectionsById = new Map(doc.sections.map((section) => [section.id, section]));
  const layersById = new Map(doc.layers.map((layer) => [layer.id, layer]));
  const assetIds = new Set(doc.assets.map((asset) => asset.id));
  const duplicateIds = collectDuplicateIds([
    ...doc.sections.map((section) => section.id),
    ...doc.layers.map((layer) => layer.id),
    ...doc.assets.map((asset) => asset.id),
    ...doc.components.map((component) => component.id),
    ...doc.interactions.map((interaction) => interaction.id),
    ...doc.responsive.rules.map((rule) => rule.id),
    ...doc.generation.sectionRequests.map((request) => request.id)
  ]);

  validateAnalysisPlanProvenance(doc, issues);

  for (const id of duplicateIds) {
    issues.push(issue("duplicate_id", id, `Duplicate id "${id}" appears in the LayerDoc graph.`));
  }

  for (const [index, section] of doc.sections.entries()) {
    const path = `sections[${index}]`;
    if (!isPositiveRect(section.bounds)) {
      issues.push(issue("bounds_invalid", `${path}.bounds`, `Section "${section.id}" has non-positive bounds.`));
    } else if (!fitsCanvas(section.bounds, doc.canvas)) {
      issues.push(issue("bounds_outside_canvas", `${path}.bounds`, `Section "${section.id}" exceeds the canvas.`));
    }

    if (section.visible !== false && section.layerIds.length === 0) {
      issues.push(issue("section_empty", `${path}.layerIds`, `Visible section "${section.id}" must contain at least one layer.`));
    }

    for (const layerId of section.layerIds) {
      const layer = layersById.get(layerId);
      if (!layer) {
        issues.push(issue("layer_missing", `${path}.layerIds`, `Section "${section.id}" references missing layer "${layerId}".`));
      } else if (layer.sectionId !== section.id) {
        issues.push(
          issue(
            "layer_section_mismatch",
            `${path}.layerIds`,
            `Section "${section.id}" includes layer "${layerId}" but that layer points at section "${layer.sectionId ?? "none"}".`
          )
        );
      }
    }
  }

  for (const [index, layer] of doc.layers.entries()) {
    const path = `layers[${index}]`;
    if (!isPositiveRect(layer.bounds)) {
      issues.push(issue("bounds_invalid", `${path}.bounds`, `Layer "${layer.id}" has non-positive bounds.`));
    } else if (!fitsCanvas(layer.bounds, doc.canvas)) {
      issues.push(issue("bounds_outside_canvas", `${path}.bounds`, `Layer "${layer.id}" exceeds the canvas.`));
    }

    if (layer.sectionId) {
      const section = sectionsById.get(layer.sectionId);
      if (!section) {
        issues.push(issue("section_missing", `${path}.sectionId`, `Layer "${layer.id}" references missing section "${layer.sectionId}".`));
      } else if (!section.layerIds.includes(layer.id)) {
        issues.push(
          issue(
            "layer_section_mismatch",
            `${path}.sectionId`,
            `Layer "${layer.id}" points at section "${layer.sectionId}" but that section does not include the layer id.`
          )
        );
      }
    }

    if (layer.track !== classifyLayer(layer)) {
      issues.push(issue("track_mismatch", `${path}.track`, `Layer "${layer.id}" is "${layer.kind}" but is routed to "${layer.track}".`));
    }

    if (layer.track === "asset" && (!layer.assetId || !assetIds.has(layer.assetId))) {
      issues.push(issue("asset_missing", `${path}.assetId`, `Asset layer "${layer.id}" does not point at a known asset.`));
    }
  }

  for (const [index, component] of doc.components.entries()) {
    for (const layerId of component.layerIds) {
      if (!layerIds.has(layerId)) {
        issues.push(
          issue("layer_missing", `components[${index}].layerIds`, `Component "${component.id}" references missing layer "${layerId}".`)
        );
      }
    }
  }

  for (const [index, interaction] of doc.interactions.entries()) {
    if (!layerIds.has(interaction.layerId)) {
      issues.push(
        issue(
          "layer_missing",
          `interactions[${index}].layerId`,
          `Interaction "${interaction.id}" references missing layer "${interaction.layerId}".`
        )
      );
    }
  }

  for (const [index, rule] of doc.responsive.rules.entries()) {
    const target = rule.target;
    const targetExists =
      (target?.type === "section" && sectionIds.has(target.id)) ||
      (target?.type === "layer" && layerIds.has(target.id)) ||
      (target?.type === "component" && componentIds.has(target.id));

    if (!targetExists) {
      issues.push(
        issue(
          "responsive_target_missing",
          `responsive.rules[${index}].target.id`,
          `Responsive rule "${rule.id}" targets missing ${target?.type ?? "object"} "${target?.id ?? "unknown"}".`
        )
      );
    }
  }

  for (const [index, request] of doc.generation.sectionRequests.entries()) {
    if (!sectionIds.has(request.sectionId)) {
      issues.push(
        issue(
          "section_missing",
          `generation.sectionRequests[${index}].sectionId`,
          `Regeneration request "${request.id}" references missing section "${request.sectionId}".`
        )
      );
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}
