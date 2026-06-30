import type { LayerDoc } from "../layerdoc/types.js";
import {
  evaluateVerificationGates,
  type VerificationGates
} from "./gates.js";
import {
  createVerificationReport,
  verificationVisualEvidence,
  type VerificationReport,
  type VerificationVisualEvidence
} from "./report.js";
import { comparePngSnapshots, type PngSnapshotComparisonResult } from "./visualDiff.js";

export type { VerificationGates } from "./gates.js";

export interface RunLayerDocVerificationInput {
  doc: LayerDoc;
  referencePath: string;
  candidatePath: string;
  diffPath?: string;
  threshold?: number;
  includeAA?: boolean;
  gates?: Partial<VerificationGates>;
  visualEvidence?: VerificationVisualEvidence;
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
  const report = createVerificationReport(input.doc, {
    visualDiff,
    visualEvidence: input.visualEvidence ?? verificationVisualEvidence.imageData
  });
  const gateResult = evaluateVerificationGates(report, input.gates);

  return {
    report,
    visualDiff,
    artifacts: {
      referencePath: input.referencePath,
      candidatePath: input.candidatePath,
      diffPath: visualDiff.diffPath
    },
    gates: gateResult.gates,
    passed: gateResult.passed,
    failures: gateResult.failures
  };
}
