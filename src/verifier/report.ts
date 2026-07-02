import { scoreProjectFit } from "../layerdoc/scoring.js";
import { validateLayerDoc } from "../layerdoc/validation.js";
import type { LayerDoc, LayerNode, ProjectFitScore, Rect, VerificationIssue, VerificationVisualProblemArea } from "../layerdoc/types.js";
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

export interface VerificationComponentBreakdown {
  componentLayerCount: number;
  coveredComponentLayerCount: number;
  coverageRatio: number;
  coveredLayerIds: string[];
  uncoveredLayerIds: string[];
}

export interface VerificationProjectFitBreakdown {
  baseScore: number;
  finalScore: number;
  assetCoverageRatio: number;
  fullPageBitmapRisk: boolean;
  exportableComponents: number;
  editableComponentLayers: number;
  contributions: ProjectFitScore["contributions"];
}

export interface VerificationStructureBreakdown {
  valid: boolean;
  totalIssueCount: number;
  structuralIssueCount: number;
  trackMismatchCount: number;
  penaltyPerStructuralIssue: number;
  issueCodes: Record<string, number>;
  blockingIssuePaths: string[];
  ignoredIssueCodes: string[];
}

export interface VerificationReport {
  visualSimilarity: number | null;
  visualDiff: PngSnapshotComparisonResult | null;
  visualProblemAreas: VerificationVisualProblemArea[];
  evidence: VerificationEvidence;
  structureScore: number;
  structureBreakdown: VerificationStructureBreakdown;
  componentScore: number;
  componentBreakdown: VerificationComponentBreakdown;
  projectFitScore: number;
  projectFitBreakdown: VerificationProjectFitBreakdown;
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

const scoreSchema = { type: ["number", "null"], minimum: 0, maximum: 100 };

const boundedNumberSchema = { type: "number", minimum: 0, maximum: 100 };

const rectJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["x", "y", "width", "height"],
  properties: {
    x: { type: "number" },
    y: { type: "number" },
    width: { type: "number", minimum: 0 },
    height: { type: "number", minimum: 0 }
  }
};

const stringArrayJsonSchema = {
  type: "array",
  items: { type: "string", minLength: 1 }
};

/**
 * Public contract for verification-report.json. The report is consumed by CI,
 * generated project manifests, and editor handoff tools, so it needs a stable
 * machine-readable schema instead of being treated as an informal log file.
 */
export function createVerificationReportJsonSchema(): Record<string, unknown> {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "VerificationReport 0.1.0",
    type: "object",
    additionalProperties: false,
    required: [
      "visualSimilarity",
      "visualDiff",
      "visualProblemAreas",
      "evidence",
      "structureScore",
      "structureBreakdown",
      "componentScore",
      "componentBreakdown",
      "projectFitScore",
      "projectFitBreakdown",
      "issues"
    ],
    properties: {
      visualSimilarity: scoreSchema,
      visualDiff: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: false,
            required: [
              "visualSimilarity",
              "mismatchedPixels",
              "comparedPixels",
              "dimensions",
              "mismatchBounds",
              "problemAreas",
              "diffPath",
              "threshold"
            ],
            properties: {
              visualSimilarity: boundedNumberSchema,
              mismatchedPixels: { type: "integer", minimum: 0 },
              comparedPixels: { type: "integer", minimum: 0 },
              dimensions: {
                type: "object",
                additionalProperties: false,
                required: ["width", "height"],
                properties: {
                  width: { type: "integer", minimum: 1 },
                  height: { type: "integer", minimum: 1 }
                }
              },
              mismatchBounds: { anyOf: [{ type: "null" }, rectJsonSchema] },
              problemAreas: {
                type: "array",
                items: rectJsonSchema
              },
              diffPath: { type: ["string", "null"] },
              threshold: { type: "number", minimum: 0, maximum: 1 }
            }
          }
        ]
      },
      visualProblemAreas: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "bounds",
            "affectedLayerId",
            "affectedLayerKind",
            "affectedLayerTrack",
            "affectedLayerEditable",
            "affectedSectionId"
          ],
          properties: {
            id: { type: "string", minLength: 1 },
            bounds: rectJsonSchema,
            affectedLayerId: { type: ["string", "null"] },
            affectedLayerKind: { type: ["string", "null"] },
            affectedLayerTrack: {
              enum: ["component", "asset", "approximation", "layout", null]
            },
            affectedLayerEditable: { type: ["boolean", "null"] },
            affectedSectionId: { type: ["string", "null"] }
          }
        }
      },
      evidence: {
        type: "object",
        additionalProperties: false,
        required: ["visual"],
        properties: {
          visual: {
            type: "object",
            additionalProperties: false,
            required: ["kind", "label", "description"],
            properties: {
              kind: { enum: ["none", "image-data", "layerdoc-raster", "html-screenshot"] },
              label: { type: "string", minLength: 1 },
              description: { type: "string", minLength: 1 }
            }
          }
        }
      },
      structureScore: boundedNumberSchema,
      structureBreakdown: {
        type: "object",
        additionalProperties: false,
        required: [
          "valid",
          "totalIssueCount",
          "structuralIssueCount",
          "trackMismatchCount",
          "penaltyPerStructuralIssue",
          "issueCodes",
          "blockingIssuePaths",
          "ignoredIssueCodes"
        ],
        properties: {
          valid: { type: "boolean" },
          totalIssueCount: { type: "integer", minimum: 0 },
          structuralIssueCount: { type: "integer", minimum: 0 },
          trackMismatchCount: { type: "integer", minimum: 0 },
          penaltyPerStructuralIssue: { type: "number", minimum: 0 },
          issueCodes: {
            type: "object",
            additionalProperties: { type: "integer", minimum: 0 }
          },
          blockingIssuePaths: stringArrayJsonSchema,
          ignoredIssueCodes: stringArrayJsonSchema
        }
      },
      componentScore: boundedNumberSchema,
      componentBreakdown: {
        type: "object",
        additionalProperties: false,
        required: ["componentLayerCount", "coveredComponentLayerCount", "coverageRatio", "coveredLayerIds", "uncoveredLayerIds"],
        properties: {
          componentLayerCount: { type: "integer", minimum: 0 },
          coveredComponentLayerCount: { type: "integer", minimum: 0 },
          coverageRatio: { type: "number", minimum: 0, maximum: 1 },
          coveredLayerIds: stringArrayJsonSchema,
          uncoveredLayerIds: stringArrayJsonSchema
        }
      },
      projectFitScore: boundedNumberSchema,
      projectFitBreakdown: {
        type: "object",
        additionalProperties: true,
        required: [
          "baseScore",
          "finalScore",
          "assetCoverageRatio",
          "fullPageBitmapRisk",
          "exportableComponents",
          "editableComponentLayers",
          "contributions"
        ],
        properties: {
          baseScore: { type: "number" },
          finalScore: boundedNumberSchema,
          assetCoverageRatio: { type: "number", minimum: 0 },
          fullPageBitmapRisk: { type: "boolean" },
          exportableComponents: { type: "integer", minimum: 0 },
          editableComponentLayers: { type: "integer", minimum: 0 },
          contributions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: true,
              required: ["id", "label", "delta"],
              properties: {
                id: { type: "string", minLength: 1 },
                label: { type: "string", minLength: 1 },
                delta: { type: "number" },
                count: { type: "integer", minimum: 0 },
                maximum: { type: "number" },
                triggered: { type: "boolean" }
              }
            }
          }
        }
      },
      issues: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: true,
          required: ["code", "path", "message"],
          properties: {
            code: { type: "string", minLength: 1 },
            path: { type: "string", minLength: 1 },
            message: { type: "string", minLength: 1 }
          }
        }
      }
    }
  };
}

function percentage(part: number, whole: number): number {
  if (whole === 0) {
    return 100;
  }
  return Math.round((part / whole) * 100);
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

function roundRatio(part: number, whole: number): number {
  if (whole === 0) {
    return 1;
  }

  return Math.round((part / whole) * 100) / 100;
}

function componentBreakdownFor(doc: LayerDoc): VerificationComponentBreakdown {
  const componentLayers = doc.layers.filter((layer) => layer.track === "component");
  const declaredComponentLayerIds = new Set(doc.components.flatMap((component) => component.layerIds));
  const coveredLayerIds = componentLayers.filter((layer) => declaredComponentLayerIds.has(layer.id)).map((layer) => layer.id);
  const uncoveredLayerIds = componentLayers.filter((layer) => !declaredComponentLayerIds.has(layer.id)).map((layer) => layer.id);

  return {
    componentLayerCount: componentLayers.length,
    coveredComponentLayerCount: coveredLayerIds.length,
    coverageRatio: roundRatio(coveredLayerIds.length, componentLayers.length),
    coveredLayerIds,
    uncoveredLayerIds
  };
}

function structureBreakdownFor(issues: VerificationIssue[]): VerificationStructureBreakdown {
  const ignoredIssueCodes = ["track_mismatch"];
  const structuralIssues = issues.filter((issue) => !ignoredIssueCodes.includes(issue.code));
  const issueCodes = issues.reduce<Record<string, number>>((counts, issue) => {
    counts[issue.code] = (counts[issue.code] ?? 0) + 1;
    return counts;
  }, {});

  return {
    valid: structuralIssues.length === 0,
    totalIssueCount: issues.length,
    structuralIssueCount: structuralIssues.length,
    trackMismatchCount: issueCodes.track_mismatch ?? 0,
    penaltyPerStructuralIssue: 20,
    issueCodes,
    blockingIssuePaths: structuralIssues.map((issue) => issue.path),
    ignoredIssueCodes
  };
}

function structureScoreFromBreakdown(breakdown: VerificationStructureBreakdown): number {
  return breakdown.structuralIssueCount === 0
    ? 100
    : Math.max(0, 100 - breakdown.structuralIssueCount * breakdown.penaltyPerStructuralIssue);
}

function projectFitBreakdownFor(projectFit: ProjectFitScore): VerificationProjectFitBreakdown {
  return {
    baseScore: projectFit.baseScore,
    finalScore: projectFit.projectFitScore,
    assetCoverageRatio: projectFit.assetCoverageRatio,
    fullPageBitmapRisk: projectFit.fullPageBitmapRisk,
    exportableComponents: projectFit.exportableComponents,
    editableComponentLayers: projectFit.editableComponentLayers,
    contributions: projectFit.contributions.map((contribution) => ({ ...contribution }))
  };
}

/**
 * Combine verifier dimensions without pretending they measure the same thing.
 * Pixel similarity comes from screenshots; structure and component scores come
 * from the LayerDoc graph; project fit estimates integration health.
 */
export function createVerificationReport(doc: LayerDoc, input: VerificationInput = {}): VerificationReport {
  const validation = validateLayerDoc(doc);
  const projectFit = scoreProjectFit(doc);
  const structureBreakdown = structureBreakdownFor(validation.issues);
  const componentBreakdown = componentBreakdownFor(doc);
  const visualSimilarity = input.visualSimilarity ?? input.visualDiff?.visualSimilarity ?? null;

  return {
    visualSimilarity,
    visualDiff: input.visualDiff ?? null,
    visualProblemAreas: visualProblemAreasFor(doc, input.visualDiff),
    evidence: {
      visual: visualEvidenceFor(input)
    },
    structureScore: structureScoreFromBreakdown(structureBreakdown),
    structureBreakdown,
    componentScore: percentage(componentBreakdown.coveredComponentLayerCount, componentBreakdown.componentLayerCount),
    componentBreakdown,
    projectFitScore: projectFit.projectFitScore,
    projectFitBreakdown: projectFitBreakdownFor(projectFit),
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
