import type { VerificationReport } from "./report.js";
import type { LayerDocAssetCompliance, LayerDocEditableCoverage } from "../layerdoc/audit.js";

export interface VerificationGates {
  visualSimilarity: number;
  structureScore: number;
  componentScore: number;
  projectFitScore: number;
}

export interface VerificationGateResult {
  passed: boolean;
  failures: string[];
  gates: VerificationGates;
}

export interface VerificationGateContext {
  assetCompliance?: Pick<LayerDocAssetCompliance, "passed" | "findings">;
  editableCoverage?: Pick<LayerDocEditableCoverage, "sectionsWithoutEditableLayers">;
}

export const defaultVerificationGates: VerificationGates = {
  visualSimilarity: 85,
  structureScore: 90,
  componentScore: 90,
  projectFitScore: 85
};

/**
 * Keep quality gate policy close to verifier scoring so UI, CLI, and exported
 * project packages explain failures with one shared vocabulary.
 */
export function evaluateVerificationGates(
  report: VerificationReport,
  overrides: Partial<VerificationGates> = {},
  context: VerificationGateContext = {}
): VerificationGateResult {
  const gates = { ...defaultVerificationGates, ...overrides };
  const checks = [
    ["visual_similarity", report.visualSimilarity, gates.visualSimilarity],
    ["structure_score", report.structureScore, gates.structureScore],
    ["component_score", report.componentScore, gates.componentScore],
    ["project_fit_score", report.projectFitScore, gates.projectFitScore]
  ] as const;

  const failures = checks.flatMap(([label, value, gate]) => {
    if (value === null || value < gate) {
      return [`${label} ${value ?? "n/a"} is below ${gate}`];
    }
    return [];
  });

  const structuralIssueCount = report.structureBreakdown?.structuralIssueCount ?? report.issues.length;
  if (structuralIssueCount > 0) {
    failures.push(`${structuralIssueCount} structural blocker(s) reported`);
  }

  if (context.assetCompliance?.passed === false) {
    const findings = context.assetCompliance.findings ?? [];
    const detail = findings.length > 0 ? findings.join(" ") : "asset compliance audit did not pass";
    failures.push(`asset_compliance failed: ${detail}`);
  }

  if ((context.editableCoverage?.sectionsWithoutEditableLayers.length ?? 0) > 0) {
    failures.push(
      `editable_coverage failed: visible sections without editable layers: ${context.editableCoverage?.sectionsWithoutEditableLayers.join(", ")}`
    );
  }

  return {
    passed: failures.length === 0,
    failures,
    gates
  };
}
