import assert from "node:assert/strict";
import test from "node:test";

import { createEditorWorkspace } from "../dist/app/editorWorkspace.js";
import { createSampleHomepageLayerDoc } from "../dist/app/sampleDocument.js";
import { runWorkspaceVisualVerification } from "../dist/app/workspaceVerifier.js";

function solidSnapshot(width, height, rgba) {
  const data = new Uint8Array(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = rgba[0];
    data[index + 1] = rgba[1];
    data[index + 2] = rgba[2];
    data[index + 3] = rgba[3];
  }
  return { width, height, data };
}

test("runWorkspaceVisualVerification compares image snapshots and refreshes workspace verifier output", () => {
  const workspace = createEditorWorkspace(createSampleHomepageLayerDoc());
  const reference = solidSnapshot(2, 2, [255, 255, 255, 255]);
  const candidate = solidSnapshot(2, 2, [255, 255, 255, 255]);
  const changedPixel = (2 * 1 + 1) * 4;
  candidate.data[changedPixel] = 0;
  candidate.data[changedPixel + 1] = 0;
  candidate.data[changedPixel + 2] = 0;

  const next = runWorkspaceVisualVerification(workspace, { reference, candidate, threshold: 0 });

  assert.equal(workspace.report.visualSimilarity, null);
  assert.equal(next.report.visualSimilarity, 75);
  assert.equal(next.report.visualDiff.mismatchedPixels, 1);
  assert.equal(next.report.visualDiff.diffPath, null);
  assert.deepEqual(next.report.visualDiff.problemAreas, [{ x: 1, y: 1, width: 1, height: 1 }]);
  assert.equal(next.projectExport.manifest.scores.visualSimilarity, 75);
});
