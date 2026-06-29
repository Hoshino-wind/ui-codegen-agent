import { scoreProjectFit } from "../layerdoc/scoring.js";
import { validateLayerDoc } from "../layerdoc/validation.js";
import type { LayerDoc, VerificationIssue } from "../layerdoc/types.js";

export interface VerificationInput {
  visualSimilarity?: number;
}

export interface VerificationReport {
  visualSimilarity: number | null;
  structureScore: number;
  componentScore: number;
  projectFitScore: number;
  issues: VerificationIssue[];
}

function percentage(part: number, whole: number): number {
  if (whole === 0) {
    return 100;
  }
  return Math.round((part / whole) * 100);
}

function structureScore(doc: LayerDoc, issues: VerificationIssue[]): number {
  const structuralIssues = issues.filter((issue) => issue.code !== "track_mismatch");
  return structuralIssues.length === 0 ? 100 : Math.max(0, 100 - structuralIssues.length * 20);
}

function componentScore(doc: LayerDoc): number {
  const componentLayers = doc.layers.filter((layer) => layer.track === "component");
  const coveredLayerIds = new Set(doc.components.flatMap((component) => component.layerIds));
  const covered = componentLayers.filter((layer) => coveredLayerIds.has(layer.id)).length;
  return percentage(covered, componentLayers.length);
}

/**
 * Combine verifier dimensions without pretending they measure the same thing.
 * Pixel similarity comes from screenshots; structure and component scores come
 * from the LayerDoc graph; project fit estimates integration health.
 */
export function createVerificationReport(doc: LayerDoc, input: VerificationInput = {}): VerificationReport {
  const validation = validateLayerDoc(doc);
  const projectFit = scoreProjectFit(doc);

  return {
    visualSimilarity: input.visualSimilarity ?? null,
    structureScore: structureScore(doc, validation.issues),
    componentScore: componentScore(doc),
    projectFitScore: projectFit.projectFitScore,
    issues: validation.issues
  };
}
