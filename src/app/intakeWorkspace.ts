import {
  addAnalysisLayer,
  updateAnalysisLayer,
  createHomepageAnalysisPlan,
  toPngIntakeSections,
  validateHomepageAnalysisPlan,
  type AnalysisLayerPatch,
  type HomepageAnalysisPlan
} from "../importers/homepageAnalysisPlan.js";
import { addHeroAnnotationSetToPlan, seedHomepageAnalysisPlan } from "../importers/homepageSeed.js";
import { createLayerDocFromImageManifest, type ImageAnalysisManifest } from "../importers/imageManifest.js";
import type { PngIntakeLayerPlan } from "../importers/pngIntake.js";
import type { LayerKind, Rect } from "../layerdoc/types.js";
import { createEditorWorkspace, selectWorkspaceLayer, type EditorWorkspace } from "./editorWorkspace.js";

export interface SourceImageMetadata {
  uri: string;
  width: number;
  height: number;
}

export interface IntakeWorkspace {
  sourceImage: SourceImageMetadata;
  analysisPlan: HomepageAnalysisPlan;
  selectedSectionId: string;
  selectedLayerId: string | null;
  issues: string[];
  layerCount: number;
  ready: boolean;
}

export type ManualAnalysisLayerKind = Extract<LayerKind, "text" | "button" | "image">;

export interface AddManualAnalysisLayerInput {
  sectionId?: string;
  kind: ManualAnalysisLayerKind;
}

function materialize(
  sourceImage: SourceImageMetadata,
  analysisPlan: HomepageAnalysisPlan,
  selectedSectionId: string,
  selectedLayerId: string | null = null
): IntakeWorkspace {
  const issues = validateHomepageAnalysisPlan(analysisPlan);
  const layerId = selectedLayerId && hasLayer(analysisPlan, selectedLayerId) ? selectedLayerId : null;

  return {
    sourceImage: { ...sourceImage },
    analysisPlan,
    selectedSectionId,
    selectedLayerId: layerId,
    issues,
    layerCount: analysisPlan.sections.reduce((total, section) => total + section.layers.length, 0),
    ready: issues.length === 0
  };
}

function hasLayer(plan: HomepageAnalysisPlan, layerId: string): boolean {
  return plan.sections.some((section) => section.layers.some((layer) => layer.id === layerId));
}

function sectionById(plan: HomepageAnalysisPlan, sectionId: string) {
  const section = plan.sections.find((candidate) => candidate.id === sectionId);
  if (!section) {
    throw new Error(`Section "${sectionId}" was not found.`);
  }
  return section;
}

function layerSectionId(plan: HomepageAnalysisPlan, layerId: string): string | null {
  const section = plan.sections.find((candidate) => candidate.layers.some((layer) => layer.id === layerId));
  return section?.id ?? null;
}

function countSectionLayers(plan: HomepageAnalysisPlan, sectionId: string, kind?: ManualAnalysisLayerKind): number {
  const section = sectionById(plan, sectionId);
  return section.layers.filter((layer) => !kind || layer.kind === kind).length;
}

function nextManualLayerId(plan: HomepageAnalysisPlan, sectionId: string, kind: ManualAnalysisLayerKind): string {
  let index = countSectionLayers(plan, sectionId, kind) + 1;
  let id = `${sectionId}-${kind}-${index}`;

  while (hasLayer(plan, id)) {
    index += 1;
    id = `${sectionId}-${kind}-${index}`;
  }

  return id;
}

function clampRectToSection(rect: Rect, sectionBounds: Rect): Rect {
  const width = Math.max(1, Math.min(rect.width, sectionBounds.width));
  const height = Math.max(1, Math.min(rect.height, sectionBounds.height));
  const x = Math.min(Math.max(rect.x, sectionBounds.x), sectionBounds.x + sectionBounds.width - width);
  const y = Math.min(Math.max(rect.y, sectionBounds.y), sectionBounds.y + sectionBounds.height - height);

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height)
  };
}

function defaultManualBounds(plan: HomepageAnalysisPlan, sectionId: string, kind: ManualAnalysisLayerKind): Rect {
  const section = sectionById(plan, sectionId);
  const gutter = Math.min(80, Math.max(24, Math.round(section.bounds.width * 0.055)));
  const rowIndex = countSectionLayers(plan, sectionId);
  const rowY = section.bounds.y + gutter + rowIndex * 54;

  if (kind === "button") {
    return clampRectToSection(
      {
        x: section.bounds.x + gutter,
        y: rowY,
        width: Math.min(220, section.bounds.width - gutter * 2),
        height: 44
      },
      section.bounds
    );
  }

  if (kind === "image") {
    const width = Math.min(360, Math.max(160, Math.round(section.bounds.width * 0.28)));
    const height = Math.min(180, Math.max(96, section.bounds.height - gutter * 2));
    return clampRectToSection(
      {
        x: section.bounds.x + section.bounds.width - gutter - width,
        y: section.bounds.y + gutter,
        width,
        height
      },
      section.bounds
    );
  }

  return clampRectToSection(
    {
      x: section.bounds.x + gutter,
      y: rowY,
      width: Math.min(560, section.bounds.width - gutter * 2),
      height: 44
    },
    section.bounds
  );
}

function createManualLayer(plan: HomepageAnalysisPlan, sectionId: string, kind: ManualAnalysisLayerKind): PngIntakeLayerPlan {
  const section = sectionById(plan, sectionId);
  const id = nextManualLayerId(plan, sectionId, kind);
  const bounds = defaultManualBounds(plan, sectionId, kind);

  if (kind === "image") {
    return {
      id,
      kind,
      bounds,
      alt: `${section.name} image crop`,
      asset: {
        id: `${id}-asset`,
        uri: "/assets/hero-reference.svg",
        source: "reference-crop",
        cropBounds: { ...bounds }
      }
    };
  }

  return {
    id,
    kind,
    bounds,
    text: kind === "button" ? "Call to action" : `${section.name} text`
  };
}

function toManifest(intake: IntakeWorkspace): ImageAnalysisManifest {
  return {
    name: intake.analysisPlan.name,
    sourceImage: {
      uri: intake.sourceImage.uri,
      width: intake.sourceImage.width,
      height: intake.sourceImage.height
    },
    canvas: {
      width: intake.sourceImage.width,
      height: intake.sourceImage.height,
      background: "#f8fafc"
    },
    sections: toPngIntakeSections(intake.analysisPlan)
  };
}

export function createIntakeWorkspace(sourceImage: SourceImageMetadata): IntakeWorkspace {
  const analysisPlan = createHomepageAnalysisPlan({
    name: "Imported Homepage",
    canvas: { width: sourceImage.width, height: sourceImage.height, background: "#f8fafc" }
  });

  return materialize(sourceImage, analysisPlan, "hero");
}

export function selectIntakeSection(workspace: IntakeWorkspace, sectionId: string): IntakeWorkspace {
  const section = sectionById(workspace.analysisPlan, sectionId);
  return materialize(workspace.sourceImage, workspace.analysisPlan, sectionId, section.layers[0]?.id ?? null);
}

export function selectIntakeLayer(workspace: IntakeWorkspace, layerId: string): IntakeWorkspace {
  const sectionId = layerSectionId(workspace.analysisPlan, layerId);
  if (!sectionId) {
    throw new Error(`Layer "${layerId}" was not found.`);
  }

  return materialize(workspace.sourceImage, workspace.analysisPlan, sectionId, layerId);
}

export function addManualAnalysisLayer(workspace: IntakeWorkspace, input: AddManualAnalysisLayerInput): IntakeWorkspace {
  const sectionId = input.sectionId ?? workspace.selectedSectionId;
  const layer = createManualLayer(workspace.analysisPlan, sectionId, input.kind);
  const plan = addAnalysisLayer(workspace.analysisPlan, sectionId, layer);

  return materialize(workspace.sourceImage, plan, sectionId, layer.id);
}

export function updateManualAnalysisLayer(workspace: IntakeWorkspace, layerId: string, patch: AnalysisLayerPatch): IntakeWorkspace {
  const sectionId = layerSectionId(workspace.analysisPlan, layerId);
  if (!sectionId) {
    throw new Error(`Layer "${layerId}" was not found.`);
  }

  const plan = updateAnalysisLayer(workspace.analysisPlan, layerId, patch);
  return materialize(workspace.sourceImage, plan, sectionId, layerId);
}

export function addHeroAnnotationSet(workspace: IntakeWorkspace): IntakeWorkspace {
  return materialize(workspace.sourceImage, addHeroAnnotationSetToPlan(workspace.analysisPlan), "hero", "hero-title");
}

export function seedHomepageAnnotations(workspace: IntakeWorkspace): IntakeWorkspace {
  return materialize(workspace.sourceImage, seedHomepageAnalysisPlan(workspace.analysisPlan), "hero", "hero-title");
}

export function buildWorkspaceFromIntake(workspace: IntakeWorkspace): EditorWorkspace {
  const issues = validateHomepageAnalysisPlan(workspace.analysisPlan);
  if (issues.length > 0) {
    throw new Error(`Cannot build LayerDoc from invalid analysis plan: ${issues.join(" ")}`);
  }

  const nextWorkspace = createEditorWorkspace(createLayerDocFromImageManifest(toManifest(workspace)));
  if (workspace.selectedLayerId) {
    return selectWorkspaceLayer(nextWorkspace, workspace.selectedLayerId);
  }

  return nextWorkspace;
}
