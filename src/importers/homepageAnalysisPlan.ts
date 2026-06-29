import type { Canvas, Rect } from "../layerdoc/types.js";
import type { PngIntakeLayerPlan, PngIntakeSectionPlan } from "./pngIntake.js";

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

const defaultSectionNames = ["Hero", "Proof", "Workflow", "Features", "Editor", "Export", "Verifier", "Final CTA"];

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

function cloneLayer(layer: PngIntakeLayerPlan): PngIntakeLayerPlan {
  return {
    ...layer,
    bounds: { ...layer.bounds },
    asset: layer.asset ? { ...layer.asset, cropBounds: layer.asset.cropBounds ? { ...layer.asset.cropBounds } : undefined } : undefined
  };
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
      if (patch.asset !== undefined) {
        layer.asset = { ...patch.asset, cropBounds: patch.asset.cropBounds ? { ...patch.asset.cropBounds } : undefined };
      }
      return next;
    }
  }

  throw new Error(`Layer "${layerId}" was not found.`);
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
