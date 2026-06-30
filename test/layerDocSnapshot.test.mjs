import assert from "node:assert/strict";
import test from "node:test";

import { renderLayerDocSnapshot } from "../dist/app/layerDocSnapshot.js";
import { createSampleHomepageLayerDoc } from "../dist/app/sampleDocument.js";

function pixelAt(snapshot, x, y) {
  const index = (snapshot.width * y + x) * 4;
  return Array.from(snapshot.data.slice(index, index + 4));
}

test("renderLayerDocSnapshot creates an origin-clean candidate image from LayerDoc geometry", () => {
  const doc = createSampleHomepageLayerDoc();
  const snapshot = renderLayerDocSnapshot(doc);

  assert.equal(snapshot.width, doc.canvas.width);
  assert.equal(snapshot.height, doc.canvas.height);
  assert.equal(snapshot.data.length, doc.canvas.width * doc.canvas.height * 4);
  assert.deepEqual(pixelAt(snapshot, 0, 0), [248, 250, 252, 255]);
});

test("renderLayerDocSnapshot paints editable component and asset layers into the candidate", () => {
  const snapshot = renderLayerDocSnapshot(createSampleHomepageLayerDoc());

  assert.deepEqual(pixelAt(snapshot, 98, 174), [20, 184, 166, 255]);
  assert.notDeepEqual(pixelAt(snapshot, 866, 50), [248, 250, 252, 255]);
});
