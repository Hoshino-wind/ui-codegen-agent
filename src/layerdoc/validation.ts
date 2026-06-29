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

/**
 * Validate a LayerDoc as an engineering asset, not just as JSON.
 * The checks intentionally target production risks: missing source assets,
 * impossible geometry, broken section membership, and dishonest track labels.
 */
export function validateLayerDoc(doc: LayerDoc): ValidationResult {
  const issues: VerificationIssue[] = [];
  const sectionIds = new Set(doc.sections.map((section) => section.id));
  const layerIds = new Set(doc.layers.map((layer) => layer.id));
  const assetIds = new Set(doc.assets.map((asset) => asset.id));
  const duplicateIds = collectDuplicateIds([
    ...doc.sections.map((section) => section.id),
    ...doc.layers.map((layer) => layer.id),
    ...doc.assets.map((asset) => asset.id),
    ...doc.components.map((component) => component.id)
  ]);

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

    for (const layerId of section.layerIds) {
      if (!layerIds.has(layerId)) {
        issues.push(issue("layer_missing", `${path}.layerIds`, `Section "${section.id}" references missing layer "${layerId}".`));
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

    if (layer.sectionId && !sectionIds.has(layer.sectionId)) {
      issues.push(issue("section_missing", `${path}.sectionId`, `Layer "${layer.id}" references missing section "${layer.sectionId}".`));
    }

    if (layer.track !== classifyLayer(layer)) {
      issues.push(issue("track_mismatch", `${path}.track`, `Layer "${layer.id}" is "${layer.kind}" but is routed to "${layer.track}".`));
    }

    if (layer.track === "asset" && (!layer.assetId || !assetIds.has(layer.assetId))) {
      issues.push(issue("asset_missing", `${path}.assetId`, `Asset layer "${layer.id}" does not point at a known asset.`));
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}
