import type { AnalysisPlanAudit, CreateLayerDocInput, GenerationState, LayerDoc, TokenSet, VerificationScores } from "./types.js";

const emptyTokens: TokenSet = {
  colors: {},
  typography: {},
  spacing: {},
  radii: {}
};

const emptyScores: VerificationScores = {
  visualSimilarity: null,
  structureScore: null,
  componentScore: null,
  projectFitScore: null
};

const emptyGeneration: GenerationState = {
  sectionRequests: [],
  sectionApplications: []
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneGeneration(generation: Partial<GenerationState> | undefined): GenerationState {
  return {
    sectionRequests: (generation?.sectionRequests ?? emptyGeneration.sectionRequests).map((request) => ({ ...request })),
    sectionApplications: (generation?.sectionApplications ?? emptyGeneration.sectionApplications).map(cloneJson)
  };
}

function cloneAnalysisPlanAudit(audit: AnalysisPlanAudit): AnalysisPlanAudit {
  return {
    summary: { ...audit.summary },
    tracks: { ...audit.tracks },
    coverage: {
      sectionsWithLayers: audit.coverage.sectionsWithLayers,
      emptySectionIds: [...audit.coverage.emptySectionIds]
    },
    readiness: {
      ...audit.readiness,
      blockers: [...audit.readiness.blockers]
    },
    issues: [...audit.issues],
    sectionBreakdown: audit.sectionBreakdown.map((section) => ({
      ...section,
      tracks: { ...section.tracks }
    }))
  };
}

/**
 * Create a complete LayerDoc shell from partial product data.
 * Consumers should never branch on missing top-level arrays; the editor,
 * exporter, and verifier all get the same stable document shape.
 */
export function createLayerDoc(input: CreateLayerDocInput): LayerDoc {
  return {
    schema: "layerdoc",
    version: "0.1.0",
    metadata: {
      name: input.name,
      createdAt: new Date(0).toISOString(),
      ...(input.sourceImage ? { sourceImage: { ...input.sourceImage } } : {}),
      ...(input.analysisPlan ? { analysisPlan: { ...input.analysisPlan } } : {}),
      ...(input.analysisPlanAudit ? { analysisPlanAudit: cloneAnalysisPlanAudit(input.analysisPlanAudit) } : {})
    },
    canvas: { ...input.canvas },
    tokens: {
      colors: { ...emptyTokens.colors, ...input.tokens?.colors },
      typography: { ...emptyTokens.typography, ...input.tokens?.typography },
      spacing: { ...emptyTokens.spacing, ...input.tokens?.spacing },
      radii: { ...emptyTokens.radii, ...input.tokens?.radii }
    },
    sections: [...(input.sections ?? [])],
    layers: [...(input.layers ?? [])],
    assets: [...(input.assets ?? [])],
    components: [...(input.components ?? [])],
    interactions: [...(input.interactions ?? [])],
    responsive: {
      breakpoints: { ...(input.responsive?.breakpoints ?? {}) },
      rules: [...(input.responsive?.rules ?? [])]
    },
    generation: cloneGeneration(input.generation),
    verification: {
      scores: { ...emptyScores },
      issues: [],
      visualProblemAreas: []
    }
  };
}
