import { classifyLayer } from "./classification.js";
import type { LayerDoc, LayerTrack, Rect, ValidationResult, VerificationIssue } from "./types.js";

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

const analysisPlanSources = new Set(["seeded", "provided", "editor", "manual", "mock-vision"]);
const analysisPlanTrackKeys: readonly LayerTrack[] = ["component", "asset", "approximation", "layout"];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateNonNegativeNumber(value: unknown, path: string, message: string, issues: VerificationIssue[]): void {
  if (!isNonNegativeNumber(value)) {
    issues.push(issue("metadata_invalid", path, message));
  }
}

function validateBoolean(value: unknown, path: string, message: string, issues: VerificationIssue[]): void {
  if (typeof value !== "boolean") {
    issues.push(issue("metadata_invalid", path, message));
  }
}

function validateStringArray(value: unknown, path: string, message: string, issues: VerificationIssue[]): void {
  if (!isStringArray(value)) {
    issues.push(issue("metadata_invalid", path, message));
  }
}

function validateAnalysisPlanTrackCounts(value: unknown, path: string, issues: VerificationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(issue("metadata_invalid", path, "Analysis Plan audit track counts must be an object."));
    return;
  }

  for (const track of analysisPlanTrackKeys) {
    validateNonNegativeNumber(value[track], `${path}.${track}`, `Analysis Plan audit ${track} track count must be a non-negative number.`, issues);
  }
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

function validateAnalysisPlanAudit(doc: LayerDoc, issues: VerificationIssue[]): void {
  const audit = doc.metadata.analysisPlanAudit;
  if (!audit) {
    return;
  }

  const metadataPath = "metadata.analysisPlanAudit";
  if (!isRecord(audit)) {
    issues.push(issue("metadata_invalid", metadataPath, "Analysis Plan audit must be an object."));
    return;
  }

  const summary = audit.summary;
  if (!isRecord(summary)) {
    issues.push(issue("metadata_invalid", `${metadataPath}.summary`, "Analysis Plan audit summary must be an object."));
  } else {
    validateNonNegativeNumber(summary.sections, `${metadataPath}.summary.sections`, "Analysis Plan audit section count must be a non-negative number.", issues);
    validateNonNegativeNumber(summary.layers, `${metadataPath}.summary.layers`, "Analysis Plan audit layer count must be a non-negative number.", issues);
    validateNonNegativeNumber(
      summary.editableLayers,
      `${metadataPath}.summary.editableLayers`,
      "Analysis Plan audit editable layer count must be a non-negative number.",
      issues
    );
  }

  validateAnalysisPlanTrackCounts(audit.tracks, `${metadataPath}.tracks`, issues);

  const coverage = audit.coverage;
  if (!isRecord(coverage)) {
    issues.push(issue("metadata_invalid", `${metadataPath}.coverage`, "Analysis Plan audit coverage must be an object."));
  } else {
    validateNonNegativeNumber(
      coverage.sectionsWithLayers,
      `${metadataPath}.coverage.sectionsWithLayers`,
      "Analysis Plan audit sectionsWithLayers must be a non-negative number.",
      issues
    );
    validateStringArray(
      coverage.emptySectionIds,
      `${metadataPath}.coverage.emptySectionIds`,
      "Analysis Plan audit emptySectionIds must be a string array.",
      issues
    );
  }

  const readiness = audit.readiness;
  if (!isRecord(readiness)) {
    issues.push(issue("metadata_invalid", `${metadataPath}.readiness`, "Analysis Plan audit readiness must be an object."));
  } else {
    validateBoolean(readiness.sectionRangeOk, `${metadataPath}.readiness.sectionRangeOk`, "Analysis Plan audit sectionRangeOk must be boolean.", issues);
    validateBoolean(readiness.validPlan, `${metadataPath}.readiness.validPlan`, "Analysis Plan audit validPlan must be boolean.", issues);
    validateBoolean(
      readiness.allSectionsHaveLayers,
      `${metadataPath}.readiness.allSectionsHaveLayers`,
      "Analysis Plan audit allSectionsHaveLayers must be boolean.",
      issues
    );
    validateBoolean(
      readiness.readyForLayerDoc,
      `${metadataPath}.readiness.readyForLayerDoc`,
      "Analysis Plan audit readyForLayerDoc must be boolean.",
      issues
    );
    validateStringArray(
      readiness.blockers,
      `${metadataPath}.readiness.blockers`,
      "Analysis Plan audit blockers must be a string array.",
      issues
    );
  }

  validateStringArray(audit.issues, `${metadataPath}.issues`, "Analysis Plan audit issues must be a string array.", issues);

  if (!Array.isArray(audit.sectionBreakdown)) {
    issues.push(issue("metadata_invalid", `${metadataPath}.sectionBreakdown`, "Analysis Plan audit sectionBreakdown must be an array."));
    return;
  }

  for (const [index, section] of audit.sectionBreakdown.entries()) {
    const sectionPath = `${metadataPath}.sectionBreakdown[${index}]`;
    if (!isRecord(section)) {
      issues.push(issue("metadata_invalid", sectionPath, "Analysis Plan audit section breakdown item must be an object."));
      continue;
    }

    if (!isNonEmptyString(section.sectionId)) {
      issues.push(issue("metadata_invalid", `${sectionPath}.sectionId`, "Analysis Plan audit sectionId must be a non-empty string."));
    }
    if (!isNonEmptyString(section.name)) {
      issues.push(issue("metadata_invalid", `${sectionPath}.name`, "Analysis Plan audit section name must be a non-empty string."));
    }
    validateNonNegativeNumber(section.layerCount, `${sectionPath}.layerCount`, "Analysis Plan audit section layerCount must be a non-negative number.", issues);
    validateNonNegativeNumber(
      section.editableLayerCount,
      `${sectionPath}.editableLayerCount`,
      "Analysis Plan audit section editableLayerCount must be a non-negative number.",
      issues
    );
    validateAnalysisPlanTrackCounts(section.tracks, `${sectionPath}.tracks`, issues);
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
  const requestIds = new Set(doc.generation.sectionRequests.map((request) => request.id));
  const duplicateIds = collectDuplicateIds([
    ...doc.sections.map((section) => section.id),
    ...doc.layers.map((layer) => layer.id),
    ...doc.assets.map((asset) => asset.id),
    ...doc.components.map((component) => component.id),
    ...doc.interactions.map((interaction) => interaction.id),
    ...doc.responsive.rules.map((rule) => rule.id),
    ...doc.generation.sectionRequests.map((request) => request.id),
    ...doc.generation.sectionApplications.map((application) => application.id)
  ]);

  validateAnalysisPlanProvenance(doc, issues);
  validateAnalysisPlanAudit(doc, issues);

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

  for (const [index, application] of doc.generation.sectionApplications.entries()) {
    const path = `generation.sectionApplications[${index}]`;
    if (!sectionIds.has(application.sectionId)) {
      issues.push(
        issue(
          "section_missing",
          `${path}.sectionId`,
          `Section regeneration application "${application.id}" references missing section "${application.sectionId}".`
        )
      );
    }
    if (application.requestId && !requestIds.has(application.requestId)) {
      issues.push(
        issue(
          "metadata_invalid",
          `${path}.requestId`,
          `Section regeneration application "${application.id}" references missing request "${application.requestId}".`
        )
      );
    }
    if (application.previous.section.id !== application.sectionId || application.applied.section.id !== application.sectionId) {
      issues.push(
        issue(
          "metadata_invalid",
          `${path}.section`,
          `Section regeneration application "${application.id}" snapshots must match section "${application.sectionId}".`
        )
      );
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}
