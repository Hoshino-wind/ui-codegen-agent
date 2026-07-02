import assert from "node:assert/strict";
import test from "node:test";

import { createWorkflowSummary } from "../dist/app/workflowSummary.js";

test("createWorkflowSummary derives visible workflow counts from current intake and LayerDoc state", () => {
  const summary = createWorkflowSummary({
    sourceUri: "homepage_source.png",
    intakeSectionCount: 8,
    intakeLayerCount: 4,
    layerDocSectionCount: 8,
    layerDocLayerCount: 4,
    editableLayerCount: 4,
    previewReady: true,
    exportFileName: "ProductionHomepage.tsx",
    visualSimilarity: null,
    structuralIssueCount: 0,
    qualityGatePassed: false
  });

  assert.deepEqual(
    summary.map((item) => [item.label, item.detail]),
    [
      ["Image", "homepage_source.png"],
      ["LayerDoc", "8 sections / 4 layers"],
      ["Editor", "4 editable layers"],
      ["Preview", "HTML preview ready"],
      ["Export", "ProductionHomepage.tsx"],
      ["Verifier", "Awaiting screenshot diff"]
    ]
  );
  assert.equal(summary[0].done, true);
  assert.equal(summary[1].done, true);
  assert.equal(summary[2].done, true);
  assert.equal(summary[3].done, true);
  assert.equal(summary[4].done, true);
  assert.equal(summary[5].active, true);
});

test("createWorkflowSummary marks image upload as the first active stage before intake", () => {
  const summary = createWorkflowSummary({
    sourceUri: null,
    intakeSectionCount: 0,
    intakeLayerCount: 0,
    layerDocSectionCount: 0,
    layerDocLayerCount: 0,
    editableLayerCount: 0,
    previewReady: false,
    exportFileName: null,
    visualSimilarity: null,
    structuralIssueCount: 0,
    qualityGatePassed: false
  });

  assert.deepEqual(
    summary.map((item) => [item.label, item.detail, item.done ?? false, item.active ?? false]),
    [
      ["Image", "Upload PNG", false, true],
      ["LayerDoc", "0 sections / 0 planned layers", false, false],
      ["Editor", "Waiting for LayerDoc", false, false],
      ["Preview", "Waiting for editor", false, false],
      ["Export", "Waiting for preview", false, false],
      ["Verifier", "Waiting for export", false, false]
    ]
  );
});

test("createWorkflowSummary marks verifier done only when screenshot evidence passes gates", () => {
  const summary = createWorkflowSummary({
    sourceUri: "homepage_source.png",
    intakeSectionCount: 8,
    intakeLayerCount: 17,
    layerDocSectionCount: 8,
    layerDocLayerCount: 17,
    editableLayerCount: 17,
    previewReady: true,
    exportFileName: "ProductionHomepage.tsx",
    visualSimilarity: 96,
    structuralIssueCount: 0,
    qualityGatePassed: true
  });

  assert.equal(summary[5].label, "Verifier");
  assert.equal(summary[5].detail, "Gate passed / 96 similarity");
  assert.equal(summary[5].done, true);
  assert.equal(summary.some((item) => item.active), false);
});

test("createWorkflowSummary keeps verifier active when screenshot evidence is blocked", () => {
  const summary = createWorkflowSummary({
    sourceUri: "homepage_source.png",
    intakeSectionCount: 8,
    intakeLayerCount: 17,
    layerDocSectionCount: 8,
    layerDocLayerCount: 17,
    editableLayerCount: 17,
    previewReady: true,
    exportFileName: "ProductionHomepage.tsx",
    visualSimilarity: 72,
    structuralIssueCount: 2,
    qualityGatePassed: false
  });

  assert.equal(summary[5].label, "Verifier");
  assert.equal(summary[5].detail, "Gate blocked / 72 similarity / 2 blockers");
  assert.equal(summary[5].done, undefined);
  assert.equal(summary[5].active, true);
});
