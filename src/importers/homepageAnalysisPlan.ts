import { classifyLayer } from "../layerdoc/classification.js";
import type {
  AnalysisPlanAudit,
  AnalysisPlanSectionAudit,
  AnalysisPlanTrackCounts,
  Canvas,
  LayerKind,
  LayerStyle,
  LayerTrack,
  Rect
} from "../layerdoc/types.js";
import type { PngIntakeAssetPlan, PngIntakeLayerPlan, PngIntakeSectionPlan } from "./pngIntake.js";

export interface HomepageAnalysisPlan {
  name: string;
  canvas: Canvas;
  sections: PngIntakeSectionPlan[];
}

export interface CreateHomepageAnalysisPlanInput {
  name: string;
  canvas: Canvas;
  sectionNames?: string[];
}

export type AnalysisLayerPatch = Partial<Omit<PngIntakeLayerPlan, "id" | "kind">>;

export type HomepageAnalysisPlanTrackCounts = AnalysisPlanTrackCounts;
export type HomepageAnalysisPlanSectionAudit = AnalysisPlanSectionAudit;
export type HomepageAnalysisPlanAudit = AnalysisPlanAudit;

const defaultSectionNames = ["Hero", "Proof", "Workflow", "Features", "Editor", "Export", "Verifier", "Final CTA"];
const layerKinds: readonly LayerKind[] = [
  "section",
  "group",
  "text",
  "button",
  "nav",
  "card",
  "form",
  "input",
  "list",
  "table",
  "image",
  "icon",
  "background",
  "chart",
  "map",
  "scene3d"
];
const assetSources: readonly PngIntakeAssetPlan["source"][] = ["reference-crop", "generated", "uploaded", "remote", "project"];
const assetTypes: readonly PngIntakeAssetPlan["type"][] = ["image", "video", "font", "json", "model", "other"];
const trackOrder: readonly LayerTrack[] = ["component", "asset", "approximation", "layout"];

function toKebabCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function assertHomepageRange(sections: readonly PngIntakeSectionPlan[]): void {
  if (sections.length < 8 || sections.length > 15) {
    throw new Error(`Homepage analysis plan expects 8-15 sections, received ${sections.length}.`);
  }
}

function emptyTrackCounts(): HomepageAnalysisPlanTrackCounts {
  return {
    component: 0,
    asset: 0,
    approximation: 0,
    layout: 0
  };
}

function countTracks(layers: readonly PngIntakeLayerPlan[]): HomepageAnalysisPlanTrackCounts {
  const counts = emptyTrackCounts();
  for (const layer of layers) {
    counts[classifyLayer(layer)] += 1;
  }
  return counts;
}

function countEditableLayers(layers: readonly PngIntakeLayerPlan[]): number {
  return layers.filter((layer) => layer.editable !== false).length;
}

function cloneLayer(layer: PngIntakeLayerPlan): PngIntakeLayerPlan {
  return {
    ...layer,
    bounds: { ...layer.bounds },
    style: cloneLayerStyle(layer.style),
    asset: layer.asset ? { ...layer.asset, cropBounds: layer.asset.cropBounds ? { ...layer.asset.cropBounds } : undefined } : undefined
  };
}

function cloneLayerStyle(style: LayerStyle | undefined): LayerStyle | undefined {
  return style
    ? {
        ...style,
        ...(style.padding ? { padding: { ...style.padding } } : {})
      }
    : undefined;
}

function cloneSection(section: PngIntakeSectionPlan): PngIntakeSectionPlan {
  return {
    ...section,
    bounds: { ...section.bounds },
    layers: section.layers.map(cloneLayer)
  };
}

function clonePlan(plan: HomepageAnalysisPlan): HomepageAnalysisPlan {
  return {
    ...plan,
    canvas: { ...plan.canvas },
    sections: plan.sections.map(cloneSection)
  };
}

function isRectInsideCanvas(rect: Rect, canvas: Canvas): boolean {
  return rect.width > 0 && rect.height > 0 && rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= canvas.width && rect.y + rect.height <= canvas.height;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === "boolean";
}

function isRectCandidate(value: unknown): value is Rect {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y) && isFiniteNumber(value.width) && isFiniteNumber(value.height);
}

function isCanvasCandidate(value: unknown): value is Canvas {
  return isRecord(value) && isFiniteNumber(value.width) && isFiniteNumber(value.height) && isOptionalString(value.background);
}

function isLayerKindCandidate(value: unknown): value is LayerKind {
  return typeof value === "string" && layerKinds.includes(value as LayerKind);
}

function isLayerSpacingCandidate(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  if (!isRecord(value)) {
    return false;
  }
  return ["x", "y", "top", "right", "bottom", "left"].every((key) => value[key] === undefined || isFiniteNumber(value[key]));
}

function isLayerStyleCandidate(value: unknown): value is LayerStyle | undefined {
  if (value === undefined) {
    return true;
  }
  if (!isRecord(value)) {
    return false;
  }

  return (
    isOptionalString(value.backgroundColor) &&
    isOptionalString(value.textColor) &&
    isOptionalString(value.borderColor) &&
    isOptionalString(value.fontFamily) &&
    ["borderRadius", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "gap", "opacity"].every(
      (key) => value[key] === undefined || isFiniteNumber(value[key])
    ) &&
    isLayerSpacingCandidate(value.padding)
  );
}

function isAssetSourceCandidate(value: unknown): value is PngIntakeAssetPlan["source"] | undefined {
  return value === undefined || (typeof value === "string" && assetSources.includes(value as PngIntakeAssetPlan["source"]));
}

function isAssetTypeCandidate(value: unknown): value is PngIntakeAssetPlan["type"] | undefined {
  return value === undefined || (typeof value === "string" && assetTypes.includes(value as PngIntakeAssetPlan["type"]));
}

function isAnalysisAssetCandidate(value: unknown): value is PngIntakeAssetPlan | undefined {
  if (value === undefined) {
    return true;
  }
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isOptionalString(value.fileName) &&
    (value.cropBounds === undefined || isRectCandidate(value.cropBounds)) &&
    isOptionalString(value.uri) &&
    isAssetSourceCandidate(value.source) &&
    isAssetTypeCandidate(value.type)
  );
}

function isAnalysisLayerCandidate(value: unknown): value is PngIntakeLayerPlan {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isLayerKindCandidate(value.kind) &&
    isRectCandidate(value.bounds) &&
    isOptionalString(value.text) &&
    isOptionalString(value.alt) &&
    isOptionalBoolean(value.editable) &&
    isLayerStyleCandidate(value.style) &&
    isAnalysisAssetCandidate(value.asset)
  );
}

function isAnalysisSectionCandidate(value: unknown): value is PngIntakeSectionPlan {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isRectCandidate(value.bounds) &&
    Array.isArray(value.layers) &&
    value.layers.every(isAnalysisLayerCandidate)
  );
}

function isHomepageAnalysisPlanCandidate(value: unknown): value is HomepageAnalysisPlan {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    isCanvasCandidate(value.canvas) &&
    Array.isArray(value.sections) &&
    value.sections.every(isAnalysisSectionCandidate)
  );
}

export function parseHomepageAnalysisPlanJson(contents: string): HomepageAnalysisPlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON.";
    throw new Error(`Analysis Plan JSON could not be parsed: ${message}`);
  }

  if (!isHomepageAnalysisPlanCandidate(parsed)) {
    throw new Error("Input file is not a Homepage Analysis Plan.");
  }

  return clonePlan(parsed);
}

function evenlySizedSections(names: string[], canvas: Canvas): PngIntakeSectionPlan[] {
  const baseHeight = Math.floor(canvas.height / names.length);

  return names.map((name, index) => {
    const y = index * baseHeight;
    const isLast = index === names.length - 1;
    return {
      id: toKebabCase(name),
      name,
      bounds: {
        x: 0,
        y,
        width: canvas.width,
        height: isLast ? canvas.height - y : baseHeight
      },
      layers: []
    };
  });
}

/**
 * Create the first structured artifact after image input.
 * It is a section scaffold, not generated app code: operators or vision models
 * refine the plan before PNG intake turns it into assets and LayerDoc.
 */
export function createHomepageAnalysisPlan(input: CreateHomepageAnalysisPlanInput): HomepageAnalysisPlan {
  const names = input.sectionNames ?? defaultSectionNames;
  const sections = evenlySizedSections(names, input.canvas);
  assertHomepageRange(sections);

  return {
    name: input.name,
    canvas: { ...input.canvas },
    sections
  };
}

export function addAnalysisLayer(plan: HomepageAnalysisPlan, sectionId: string, layer: PngIntakeLayerPlan): HomepageAnalysisPlan {
  const next = clonePlan(plan);
  const section = next.sections.find((candidate) => candidate.id === sectionId);

  if (!section) {
    throw new Error(`Section "${sectionId}" was not found.`);
  }

  section.layers.push(cloneLayer(layer));
  return next;
}

export function updateAnalysisLayer(plan: HomepageAnalysisPlan, layerId: string, patch: AnalysisLayerPatch): HomepageAnalysisPlan {
  const next = clonePlan(plan);

  for (const section of next.sections) {
    const layer = section.layers.find((candidate) => candidate.id === layerId);
    if (layer) {
      if (patch.bounds) {
        layer.bounds = { ...patch.bounds };
      }
      if (patch.text !== undefined) {
        layer.text = patch.text;
      }
      if (patch.alt !== undefined) {
        layer.alt = patch.alt;
      }
      if (patch.editable !== undefined) {
        layer.editable = patch.editable;
      }
      if (patch.style !== undefined) {
        layer.style = cloneLayerStyle(patch.style);
      }
      if (patch.asset !== undefined) {
        layer.asset = { ...patch.asset, cropBounds: patch.asset.cropBounds ? { ...patch.asset.cropBounds } : undefined };
      }
      return next;
    }
  }

  throw new Error(`Layer "${layerId}" was not found.`);
}

export function createHomepageAnalysisPlanAudit(plan: HomepageAnalysisPlan): HomepageAnalysisPlanAudit {
  const layers = plan.sections.flatMap((section) => section.layers);
  const issues = validateHomepageAnalysisPlan(plan);
  const emptySections = plan.sections.filter((section) => section.layers.length === 0);
  const allSectionsHaveLayers = emptySections.length === 0;
  const sectionRangeOk = plan.sections.length >= 8 && plan.sections.length <= 15;
  const blockers = [
    ...issues,
    ...(!allSectionsHaveLayers ? ["Add at least one layer to each homepage section before building LayerDoc."] : [])
  ];

  return {
    summary: {
      sections: plan.sections.length,
      layers: layers.length,
      editableLayers: countEditableLayers(layers)
    },
    tracks: countTracks(layers),
    coverage: {
      sectionsWithLayers: plan.sections.length - emptySections.length,
      emptySectionIds: emptySections.map((section) => section.id)
    },
    readiness: {
      sectionRangeOk,
      validPlan: issues.length === 0,
      allSectionsHaveLayers,
      readyForLayerDoc: blockers.length === 0,
      blockers
    },
    issues,
    sectionBreakdown: plan.sections.map((section) => {
      const tracks = countTracks(section.layers);
      for (const track of trackOrder) {
        tracks[track] = tracks[track] ?? 0;
      }

      return {
        sectionId: section.id,
        name: section.name,
        layerCount: section.layers.length,
        editableLayerCount: countEditableLayers(section.layers),
        tracks
      };
    })
  };
}

export function validateHomepageAnalysisPlan(plan: HomepageAnalysisPlan): string[] {
  const issues: string[] = [];
  const sectionIds = new Set<string>();
  const layerIds = new Set<string>();

  if (plan.sections.length < 8 || plan.sections.length > 15) {
    issues.push(`Homepage analysis plan expects 8-15 sections, received ${plan.sections.length}.`);
  }

  for (const section of plan.sections) {
    if (sectionIds.has(section.id)) {
      issues.push(`Duplicate section id "${section.id}".`);
    }
    sectionIds.add(section.id);

    if (!isRectInsideCanvas(section.bounds, plan.canvas)) {
      issues.push(`Section "${section.id}" bounds must stay inside the canvas.`);
    }

    for (const layer of section.layers) {
      if (layerIds.has(layer.id)) {
        issues.push(`Duplicate layer id "${layer.id}".`);
      }
      layerIds.add(layer.id);

      if (!isRectInsideCanvas(layer.bounds, plan.canvas)) {
        issues.push(`Layer "${layer.id}" bounds must stay inside the canvas.`);
      }
      if (layer.asset?.cropBounds && !isRectInsideCanvas(layer.asset.cropBounds, plan.canvas)) {
        issues.push(`Asset crop for layer "${layer.id}" must stay inside the canvas.`);
      }
    }
  }

  return issues;
}

export function toPngIntakeSections(plan: HomepageAnalysisPlan): PngIntakeSectionPlan[] {
  return plan.sections.map(cloneSection);
}
