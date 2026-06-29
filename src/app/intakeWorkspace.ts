import {
  addAnalysisLayer,
  createHomepageAnalysisPlan,
  toPngIntakeSections,
  validateHomepageAnalysisPlan,
  type HomepageAnalysisPlan
} from "../importers/homepageAnalysisPlan.js";
import { createLayerDocFromImageManifest, type ImageAnalysisManifest } from "../importers/imageManifest.js";
import type { PngIntakeLayerPlan } from "../importers/pngIntake.js";
import { createEditorWorkspace, type EditorWorkspace } from "./editorWorkspace.js";

export interface SourceImageMetadata {
  uri: string;
  width: number;
  height: number;
}

export interface IntakeWorkspace {
  sourceImage: SourceImageMetadata;
  analysisPlan: HomepageAnalysisPlan;
  selectedSectionId: string;
  issues: string[];
  layerCount: number;
  ready: boolean;
}

function materialize(sourceImage: SourceImageMetadata, analysisPlan: HomepageAnalysisPlan, selectedSectionId: string): IntakeWorkspace {
  const issues = validateHomepageAnalysisPlan(analysisPlan);

  return {
    sourceImage: { ...sourceImage },
    analysisPlan,
    selectedSectionId,
    issues,
    layerCount: analysisPlan.sections.reduce((total, section) => total + section.layers.length, 0),
    ready: issues.length === 0
  };
}

function hasLayer(plan: HomepageAnalysisPlan, layerId: string): boolean {
  return plan.sections.some((section) => section.layers.some((layer) => layer.id === layerId));
}

function addLayerIfMissing(plan: HomepageAnalysisPlan, sectionId: string, layer: PngIntakeLayerPlan): HomepageAnalysisPlan {
  if (hasLayer(plan, layer.id)) {
    return plan;
  }
  return addAnalysisLayer(plan, sectionId, layer);
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
  if (!workspace.analysisPlan.sections.some((section) => section.id === sectionId)) {
    throw new Error(`Section "${sectionId}" was not found.`);
  }
  return materialize(workspace.sourceImage, workspace.analysisPlan, sectionId);
}

export function addHeroAnnotationSet(workspace: IntakeWorkspace): IntakeWorkspace {
  const sectionId = "hero";
  const canvasWidth = workspace.sourceImage.width;
  const gutter = Math.min(96, Math.max(24, Math.round(canvasWidth * 0.067)));
  const heroHeight = workspace.analysisPlan.sections[0].bounds.height;
  const imageWidth = Math.min(420, Math.max(120, Math.round(canvasWidth * 0.28)));
  const imageHeight = Math.min(164, Math.max(56, heroHeight - 64));
  const imageX = Math.min(Math.round(canvasWidth * 0.62), canvasWidth - imageWidth - gutter);
  const imageY = Math.min(48, Math.max(16, heroHeight - imageHeight - 12));
  const textWidth = Math.min(620, Math.max(140, imageX - gutter - 24));
  const titleY = Math.min(52, Math.max(16, Math.round(heroHeight * 0.16)));
  const titleHeight = Math.min(72, Math.max(34, Math.round(heroHeight * 0.3)));
  const copyY = Math.min(titleY + titleHeight + 10, Math.max(16, heroHeight - 72));
  const copyHeight = Math.min(48, Math.max(24, heroHeight - copyY - 32));
  const ctaY = Math.min(copyY + copyHeight + 10, Math.max(16, heroHeight - 56));
  const ctaWidth = Math.min(184, textWidth);
  let plan = workspace.analysisPlan;

  plan = addLayerIfMissing(plan, sectionId, {
    id: "hero-title",
    kind: "text",
    bounds: { x: gutter, y: titleY, width: textWidth, height: titleHeight },
    text: "Imported hero headline"
  });
  plan = addLayerIfMissing(plan, sectionId, {
    id: "hero-copy",
    kind: "text",
    bounds: { x: gutter, y: copyY, width: textWidth, height: copyHeight },
    text: "Annotated from the PNG analysis plan before code export."
  });
  plan = addLayerIfMissing(plan, sectionId, {
    id: "hero-cta",
    kind: "button",
    bounds: { x: gutter, y: ctaY, width: ctaWidth, height: 44 },
    text: "Generate LayerDoc"
  });
  plan = addLayerIfMissing(plan, sectionId, {
    id: "hero-image",
    kind: "image",
    bounds: { x: imageX, y: imageY, width: imageWidth, height: imageHeight },
    alt: "Hero visual crop",
    asset: {
      id: "hero-crop",
      uri: "/assets/hero-reference.svg",
      source: "reference-crop",
      cropBounds: { x: imageX, y: imageY, width: imageWidth, height: imageHeight }
    }
  });

  return materialize(workspace.sourceImage, plan, sectionId);
}

export function buildWorkspaceFromIntake(workspace: IntakeWorkspace): EditorWorkspace {
  const issues = validateHomepageAnalysisPlan(workspace.analysisPlan);
  if (issues.length > 0) {
    throw new Error(`Cannot build LayerDoc from invalid analysis plan: ${issues.join(" ")}`);
  }

  return createEditorWorkspace(createLayerDocFromImageManifest(toManifest(workspace)));
}
