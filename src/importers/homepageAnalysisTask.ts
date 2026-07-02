import type { Canvas, LayerTrack } from "../layerdoc/types.js";

export interface HomepageAnalysisTaskSourceImage {
  uri: string;
  width: number;
  height: number;
}

export interface HomepageAnalysisTaskTrack {
  track: LayerTrack;
  description: string;
  examples: string[];
}

export interface HomepageAnalysisTask {
  version: "0.1.0";
  kind: "homepage-png-analysis";
  name: string;
  sourceImage: HomepageAnalysisTaskSourceImage;
  canvas: Canvas;
  outputContract: {
    artifact: "HomepageAnalysisPlan";
    schemaFile: string;
    minSections: number;
    maxSections: number;
    requiredTopLevelKeys: string[];
  };
  workflow: string[];
  classificationTracks: HomepageAnalysisTaskTrack[];
  constraints: string[];
  acceptanceGates: string[];
  operatorPrompt: string;
}

export interface CreateHomepageAnalysisTaskInput {
  name: string;
  sourceImage: HomepageAnalysisTaskSourceImage;
  outputSchemaFile?: string;
}

// These tracks are intentionally model-facing. They keep early visual
// decomposition aligned with the later LayerDoc renderer/export pipeline.
const classificationTracks: HomepageAnalysisTaskTrack[] = [
  {
    track: "component",
    description: "Editable UI objects that should become DOM/components.",
    examples: ["text", "button", "nav", "card", "form", "input", "list", "table", "icon"]
  },
  {
    track: "asset",
    description: "Image-like material that should be cropped or referenced as an asset.",
    examples: ["image", "background", "product image", "texture", "illustration"]
  },
  {
    track: "approximation",
    description: "Complex visuals that need an editable placeholder or later specialized renderer.",
    examples: ["chart", "map", "scene3d", "dense visualization"]
  },
  {
    track: "layout",
    description: "Structure, grouping, spacing, and hierarchy.",
    examples: ["section", "group", "grid", "spacing", "responsive relationship"]
  }
];

const workflow = [
  "Identify 8-15 vertical homepage sections from the PNG.",
  "Classify every meaningful object as component, asset, approximation, or layout.",
  "Create editable text/button layers instead of flattening UI into images.",
  "Use reference-crop assets for real image regions and include crop bounds.",
  "Return only a HomepageAnalysisPlan JSON object that matches the schema."
];

const constraints = [
  "Do not use the full PNG as one page-sized bitmap layer.",
  "Do not invent sections outside the source canvas.",
  "Do not output HTML, React, Figma, SVG mockups, or prose instead of the JSON plan.",
  "Do not classify charts, maps, or 3D scenes as ordinary text/card components.",
  "Preserve source pixel coordinates in absolute canvas space."
];

const acceptanceGates = [
  "Plan has 8-15 sections.",
  "Every section and layer bounds stay inside the source canvas.",
  "Every visible section has at least one editable layer.",
  "Every image/background asset layer includes a reference crop or explicit asset metadata.",
  "Layer kinds can be routed into component, asset, approximation, or layout tracks.",
  "The output can be converted into LayerDoc without structural validation errors."
];

function operatorPromptFor(input: CreateHomepageAnalysisTaskInput, schemaFile: string): string {
  // Treat the task package as prompt-as-data: deterministic enough for tests,
  // explicit enough for a model or human operator to produce the same artifact.
  return [
    `Decompose "${input.name}" from ${input.sourceImage.uri} (${input.sourceImage.width}x${input.sourceImage.height}).`,
    "Follow this chain: Image -> HomepageAnalysisPlan -> LayerDoc -> HTML Preview -> React/Tailwind -> Verifier.",
    `Return a HomepageAnalysisPlan JSON object that conforms to ${schemaFile}.`,
    "Use 8-15 sections, absolute source-canvas coordinates, and editable layers for real UI objects.",
    "Classify each layer as a kind that maps to component, asset, approximation, or layout.",
    "Do not use the original PNG as a full-page bitmap shortcut."
  ].join("\n");
}

export function createHomepageAnalysisTask(input: CreateHomepageAnalysisTaskInput): HomepageAnalysisTask {
  const schemaFile = input.outputSchemaFile ?? "analysis-plan.schema.json";
  return {
    version: "0.1.0",
    kind: "homepage-png-analysis",
    name: input.name,
    sourceImage: { ...input.sourceImage },
    canvas: {
      width: input.sourceImage.width,
      height: input.sourceImage.height
    },
    outputContract: {
      artifact: "HomepageAnalysisPlan",
      schemaFile,
      minSections: 8,
      maxSections: 15,
      requiredTopLevelKeys: ["name", "canvas", "sections"]
    },
    workflow: [...workflow],
    classificationTracks: classificationTracks.map((track) => ({
      ...track,
      examples: [...track.examples]
    })),
    constraints: [...constraints],
    acceptanceGates: [...acceptanceGates],
    operatorPrompt: operatorPromptFor(input, schemaFile)
  };
}
