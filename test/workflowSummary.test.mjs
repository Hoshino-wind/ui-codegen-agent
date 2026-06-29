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
    exportFileName: "ProductionHomepage.tsx",
    issueCount: 0
  });

  assert.deepEqual(
    summary.map((item) => [item.label, item.detail]),
    [
      ["Image", "homepage_source.png"],
      ["LayerDoc", "8 sections / 4 layers"],
      ["Editor", "Fix and refine layers"],
      ["Preview", "Compare output"],
      ["Export", "ProductionHomepage.tsx"],
      ["Verifier", "0 issues"]
    ]
  );
  assert.equal(summary[0].done, true);
  assert.equal(summary[2].active, true);
});
