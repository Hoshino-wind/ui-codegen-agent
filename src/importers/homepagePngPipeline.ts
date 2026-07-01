import { readFileSync } from "node:fs";

import { PNG } from "pngjs";

import {
  createHomepageAnalysisPlan,
  createHomepageAnalysisPlanAudit,
  toPngIntakeSections,
  validateHomepageAnalysisPlan,
  type HomepageAnalysisPlan,
  type HomepageAnalysisPlanAudit
} from "./homepageAnalysisPlan.js";
import { seedHomepageAnalysisPlan } from "./homepageSeed.js";
import { createLayerDocFromImageManifest, type ImageAnalysisManifest } from "./imageManifest.js";
import { createImageManifestFromPng } from "./pngIntake.js";
import type { AnalysisPlanProvenance, LayerDoc } from "../layerdoc/types.js";

export interface HomepagePngPipelineInput {
  name: string;
  sourcePngPath: string;
  analysisPlan?: HomepageAnalysisPlan;
  analysisPlanUri?: string;
  assetOutputDir?: string;
  publicAssetBaseUri?: string;
  canvasBackground?: string;
  seedAnnotations?: boolean;
}

export interface HomepagePngPipelineResult {
  analysisPlan: HomepageAnalysisPlan;
  analysisPlanAudit: HomepageAnalysisPlanAudit;
  imageManifest: ImageAnalysisManifest;
  layerDoc: LayerDoc;
}

function readPngCanvas(path: string): { width: number; height: number } {
  const png = PNG.sync.read(readFileSync(path));
  return {
    width: png.width,
    height: png.height
  };
}

function assertAnalysisPlanCanvasMatchesSource(plan: HomepageAnalysisPlan | undefined, canvas: { width: number; height: number }): void {
  if (!plan) {
    return;
  }

  if (plan.canvas.width !== canvas.width || plan.canvas.height !== canvas.height) {
    throw new Error(`Analysis Plan canvas ${plan.canvas.width}x${plan.canvas.height} must match source PNG ${canvas.width}x${canvas.height}.`);
  }
}

function analysisPlanProvenance(plan: HomepageAnalysisPlan, source: AnalysisPlanProvenance["source"], uri?: string): AnalysisPlanProvenance {
  return {
    source,
    name: plan.name,
    sectionCount: plan.sections.length,
    layerCount: plan.sections.reduce((total, section) => total + section.layers.length, 0),
    ...(uri ? { uri } : {})
  };
}

/**
 * Run the PNG intake half of the production chain:
 * source PNG -> analysis plan -> image manifest with crops -> LayerDoc.
 */
export function createHomepageLayerDocFromPng(input: HomepagePngPipelineInput): HomepagePngPipelineResult {
  const canvas = readPngCanvas(input.sourcePngPath);
  assertAnalysisPlanCanvasMatchesSource(input.analysisPlan, canvas);
  const scaffold = input.analysisPlan ?? createHomepageAnalysisPlan({
    name: input.name,
    canvas: {
      ...canvas,
      background: input.canvasBackground
    }
  });
  const shouldSeed = input.seedAnnotations ?? !input.analysisPlan;
  const analysisPlan = shouldSeed ? seedHomepageAnalysisPlan(scaffold) : scaffold;
  const analysisPlanAudit = createHomepageAnalysisPlanAudit(analysisPlan);
  const provenanceSource = shouldSeed ? "seeded" : "provided";
  const provenance = analysisPlanProvenance(
    analysisPlan,
    provenanceSource,
    provenanceSource === "provided" ? input.analysisPlanUri : undefined
  );
  const issues = validateHomepageAnalysisPlan(analysisPlan);
  if (issues.length > 0) {
    throw new Error(`Cannot create LayerDoc from invalid analysis plan: ${issues.join(" ")}`);
  }

  const imageManifest = createImageManifestFromPng({
    name: analysisPlan.name,
    sourcePngPath: input.sourcePngPath,
    sections: toPngIntakeSections(analysisPlan),
    assetOutputDir: input.assetOutputDir,
    publicAssetBaseUri: input.publicAssetBaseUri,
    canvasBackground: input.canvasBackground,
    analysisPlan: provenance
  });

  return {
    analysisPlan,
    analysisPlanAudit,
    imageManifest,
    layerDoc: createLayerDocFromImageManifest(imageManifest)
  };
}
