import type { LayerDoc } from "../layerdoc/types.js";
import { createVerificationReport, type VerificationReport } from "./report.js";
import { comparePngSnapshots, type PngSnapshotComparisonResult } from "./visualDiff.js";

export interface VerificationGates {
  visualSimilarity: number;
  structureScore: number;
  componentScore: number;
  projectFitScore: number;
}

export interface RunLayerDocVerificationInput {
  doc: LayerDoc;
  referencePath: string;
  candidatePath: string;
  diffPath?: string;
  threshold?: number;
  includeAA?: boolean;
  gates?: Partial<VerificationGates>;
}

export interface LayerDocVerificationRun {
  report: VerificationReport;
  visualDiff: PngSnapshotComparisonResult;
  artifacts: {
    referencePath: string;
    candidatePath: string;
    diffPath: string | null;
  };
  gates: VerificationGates;
  passed: boolean;
  failures: string[];
}

const defaultGates: VerificationGates = {
  visualSimilarity: 85,
  structureScore: 90,
  componentScore: 90,
  projectFitScore: 85
};

function gateFailures(report: VerificationReport, gates: VerificationGates): string[] {
  const checks = [
    ["visual_similarity", report.visualSimilarity, gates.visualSimilarity],
    ["structure_score", report.structureScore, gates.structureScore],
    ["component_score", report.componentScore, gates.componentScore],
    ["project_fit_score", report.projectFitScore, gates.projectFitScore]
  ] as const;

  return checks.flatMap(([label, value, gate]) => {
    if (value === null || value < gate) {
      return [`${label} ${value ?? "n/a"} is below ${gate}`];
    }
    return [];
  });
}

/**
 * Produce one verifier run artifact from a LayerDoc and two PNG snapshots.
 * Rendering stays outside this function so Browser, Playwright, or a future
 * service renderer can supply candidate screenshots without changing scoring.
 */
export function runLayerDocVerification(input: RunLayerDocVerificationInput): LayerDocVerificationRun {
  const visualDiff = comparePngSnapshots({
    referencePath: input.referencePath,
    candidatePath: input.candidatePath,
    diffPath: input.diffPath,
    threshold: input.threshold,
    includeAA: input.includeAA
  });
  const report = createVerificationReport(input.doc, { visualDiff });
  const gates = { ...defaultGates, ...input.gates };
  const failures = gateFailures(report, gates);

  return {
    report,
    visualDiff,
    artifacts: {
      referencePath: input.referencePath,
      candidatePath: input.candidatePath,
      diffPath: visualDiff.diffPath
    },
    gates,
    passed: failures.length === 0,
    failures
  };
}
