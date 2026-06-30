import { scoreProjectFit } from "../layerdoc/scoring.js";
import { validateLayerDoc } from "../layerdoc/validation.js";
import type { LayerDoc, VerificationIssue } from "../layerdoc/types.js";
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
    evidence: {
      visual: visualEvidenceFor(input)
    },
    structureScore: structureScore(doc, validation.issues),
    componentScore: componentScore(doc),
    projectFitScore: projectFit.projectFitScore,
    issues: validation.issues
  };
}
