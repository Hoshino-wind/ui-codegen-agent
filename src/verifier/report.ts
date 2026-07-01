import { scoreProjectFit } from "../layerdoc/scoring.js";
import { validateLayerDoc } from "../layerdoc/validation.js";
import type { LayerDoc, LayerNode, Rect, VerificationIssue, VerificationVisualProblemArea } from "../layerdoc/types.js";
import type { PngSnapshotComparisonResult } from "./visualDiff.js";

export interface VerificationInput {
  visualSimilarity?: number;
  visualDiff?: PngSnapshotComparisonResult;
  visualEvidence?: VerificationVisualEvidence;
}

export type VerificationVisualEvidenceKind = "none" | "image-data" | "layerdoc-raster" | "html-screenshot";

export interface VerificationVisualEvidence {
  kind: VerificationVisualEvidenceKind;
  label: string;
  description: string;
}

export interface VerificationEvidence {
  visual: VerificationVisualEvidence;
}

export interface VerificationReport {
  visualSimilarity: number | null;
  visualDiff: PngSnapshotComparisonResult | null;
  visualProblemAreas: VerificationVisualProblemArea[];
  evidence: VerificationEvidence;
  structureScore: number;
  componentScore: number;
  projectFitScore: number;
  issues: VerificationIssue[];
}

export const verificationVisualEvidence = {
  none: {
    kind: "none",
    label: "Not captured",
    description: "No visual candidate has been compared yet."
  },
  imageData: {
    kind: "image-data",
    label: "Image data",
    description: "Raw reference and candidate image data were compared directly."
  },
  layerDocRaster: {
    kind: "layerdoc-raster",
    label: "LayerDoc raster",
    description: "Studio rendered the LayerDoc graph into ImageData; this is a verifier proxy, not a committed HTML screenshot."
  },
  htmlScreenshot: {
    kind: "html-screenshot",
    label: "HTML screenshot",
    description: "Playwright rendered preview.html and compared the captured screenshot."
  }
} satisfies Record<string, VerificationVisualEvidence>;

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

function visualEvidenceFor(input: VerificationInput): VerificationVisualEvidence {
  if (input.visualEvidence) {
    return { ...input.visualEvidence };
  }

  if (input.visualDiff) {
    return { ...verificationVisualEvidence.imageData };
  }

  return { ...verificationVisualEvidence.none };
}

function rectArea(rect: Rect): number {
  return rect.width * rect.height;
}

function intersectionArea(a: Rect, b: Rect): number {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);

  if (right <= left || bottom <= top) {
    return 0;
  }

  return (right - left) * (bottom - top);
}

function visibleLayers(doc: LayerDoc): LayerNode[] {
  const visibleSectionIds = new Set(doc.sections.filter((section) => section.visible !== false).map((section) => section.id));
  return doc.layers.filter((layer) => !layer.sectionId || visibleSectionIds.has(layer.sectionId));
}

function affectedLayerForProblemArea(area: Rect, layers: LayerNode[]): LayerNode | null {
  const ranked = layers
    .map((layer) => ({
      layer,
      overlap: intersectionArea(area, layer.bounds),
      layerArea: rectArea(layer.bounds)
    }))
    .filter((candidate) => candidate.overlap > 0)
    .sort((a, b) => {
      if (b.overlap !== a.overlap) {
        return b.overlap - a.overlap;
      }
      if (a.layer.editable !== b.layer.editable) {
        return a.layer.editable ? -1 : 1;
      }
      return a.layerArea - b.layerArea;
    });

  return ranked[0]?.layer ?? null;
}

function visualProblemAreasFor(doc: LayerDoc, visualDiff: PngSnapshotComparisonResult | undefined): VerificationVisualProblemArea[] {
  if (!visualDiff) {
    return [];
  }

  const layers = visibleLayers(doc);
  return visualDiff.problemAreas.map((area, index) => {
    const affectedLayer = affectedLayerForProblemArea(area, layers);
    return {
      id: `visual-problem-${index + 1}`,
      bounds: { ...area },
      affectedLayerId: affectedLayer?.id ?? null,
      affectedLayerKind: affectedLayer?.kind ?? null,
      affectedLayerTrack: affectedLayer?.track ?? null,
      affectedLayerEditable: affectedLayer?.editable ?? null,
      affectedSectionId: affectedLayer?.sectionId ?? null
    };
  });
}

/**
 * Combine verifier dimensions without pretending they measure the same thing.
 * Pixel similarity comes from screenshots; structure and component scores come
 * from the LayerDoc graph; project fit estimates integration health.
 */
export function createVerificationReport(doc: LayerDoc, input: VerificationInput = {}): VerificationReport {
  const validation = validateLayerDoc(doc);
  const projectFit = scoreProjectFit(doc);
  const visualSimilarity = input.visualSimilarity ?? input.visualDiff?.visualSimilarity ?? null;

  return {
    visualSimilarity,
    visualDiff: input.visualDiff ?? null,
    visualProblemAreas: visualProblemAreasFor(doc, input.visualDiff),
    evidence: {
      visual: visualEvidenceFor(input)
    },
    structureScore: structureScore(doc, validation.issues),
    componentScore: componentScore(doc),
    projectFitScore: projectFit.projectFitScore,
    issues: validation.issues
  };
}

export function layerDocWithVerificationReport(doc: LayerDoc, report: VerificationReport): LayerDoc {
  return {
    ...doc,
    verification: {
      scores: {
        visualSimilarity: report.visualSimilarity,
        structureScore: report.structureScore,
        componentScore: report.componentScore,
        projectFitScore: report.projectFitScore
      },
      issues: report.issues.map((issue) => ({ ...issue })),
      visualProblemAreas: report.visualProblemAreas.map((area) => ({ ...area, bounds: { ...area.bounds } }))
    }
  };
}

export type { VerificationVisualProblemArea } from "../layerdoc/types.js";
