import assert from "node:assert/strict";
import test from "node:test";

import { defaultVerificationGates, evaluateVerificationGates } from "../dist/index.js";

const passingReport = {
  visualSimilarity: 96,
  visualDiff: null,
  structureScore: 100,
  componentScore: 100,
  projectFitScore: 90,
  issues: []
};

test("evaluateVerificationGates passes when all default thresholds are met", () => {
  const result = evaluateVerificationGates(passingReport);

  assert.equal(result.passed, true);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.gates, defaultVerificationGates);
});

test("evaluateVerificationGates fails missing visual similarity and structural issues", () => {
  const result = evaluateVerificationGates({
    ...passingReport,
    visualSimilarity: null,
    issues: [{ code: "missing_component", path: "components", message: "Missing component coverage." }]
  });

  assert.equal(result.passed, false);
  assert.deepEqual(result.failures, ["visual_similarity n/a is below 85", "1 structural issue(s) reported"]);
});

test("evaluateVerificationGates applies custom thresholds without mutating defaults", () => {
  const result = evaluateVerificationGates(
    {
      ...passingReport,
      visualSimilarity: 92,
      projectFitScore: 88
    },
    { visualSimilarity: 95, projectFitScore: 90 }
  );

  assert.equal(result.passed, false);
  assert.deepEqual(result.gates, {
    ...defaultVerificationGates,
    visualSimilarity: 95,
    projectFitScore: 90
  });
  assert.deepEqual(result.failures, [
    "visual_similarity 92 is below 95",
    "project_fit_score 88 is below 90"
  ]);
  assert.equal(defaultVerificationGates.visualSimilarity, 85);
});

test("evaluateVerificationGates blocks failed asset compliance audits", () => {
  const result = evaluateVerificationGates(
    passingReport,
    {},
    {
      assetCompliance: {
        passed: false,
        findings: ["Potential full-page bitmap shortcut: asset coverage is 1."]
      }
    }
  );

  assert.equal(result.passed, false);
  assert.deepEqual(result.failures, ["asset_compliance failed: Potential full-page bitmap shortcut: asset coverage is 1."]);
});

test("evaluateVerificationGates blocks visible sections without editable layers", () => {
  const result = evaluateVerificationGates(
    passingReport,
    {},
    {
      editableCoverage: {
        visibleSections: 2,
        sectionsWithEditableLayers: 1,
        editableSectionRatio: 0.5,
        editableLayerRatio: 0.5,
        sectionsWithoutEditableLayers: ["visual-only"]
      }
    }
  );

  assert.equal(result.passed, false);
  assert.deepEqual(result.failures, ["editable_coverage failed: visible sections without editable layers: visual-only"]);
});
