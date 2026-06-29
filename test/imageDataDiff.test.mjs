import assert from "node:assert/strict";
import test from "node:test";

import { compareImageDataSnapshots } from "../dist/verifier/imageDataDiff.js";

function solidPixels(width, height, rgba) {
  const data = new Uint8Array(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = rgba[0];
    data[index + 1] = rgba[1];
    data[index + 2] = rgba[2];
    data[index + 3] = rgba[3];
  }
  return data;
}

test("compareImageDataSnapshots scores raw RGBA snapshots and returns problem areas", () => {
  const reference = solidPixels(2, 2, [255, 255, 255, 255]);
  const candidate = solidPixels(2, 2, [255, 255, 255, 255]);
  const changedPixel = (2 * 1 + 1) * 4;
  candidate[changedPixel] = 0;
  candidate[changedPixel + 1] = 0;
  candidate[changedPixel + 2] = 0;

  const result = compareImageDataSnapshots({
    reference: { width: 2, height: 2, data: reference },
    candidate: { width: 2, height: 2, data: candidate },
    threshold: 0
  });

  assert.equal(result.visualSimilarity, 75);
  assert.equal(result.mismatchedPixels, 1);
  assert.equal(result.comparedPixels, 4);
  assert.deepEqual(result.dimensions, { width: 2, height: 2 });
  assert.deepEqual(result.mismatchBounds, { x: 1, y: 1, width: 1, height: 1 });
  assert.deepEqual(result.problemAreas, [{ x: 1, y: 1, width: 1, height: 1 }]);
  assert.equal(result.diffData.length, 16);
});

test("compareImageDataSnapshots rejects mismatched image dimensions", () => {
  assert.throws(
    () =>
      compareImageDataSnapshots({
        reference: { width: 2, height: 2, data: solidPixels(2, 2, [255, 255, 255, 255]) },
        candidate: { width: 3, height: 2, data: solidPixels(3, 2, [255, 255, 255, 255]) }
      }),
    /ImageData dimensions must match/
  );
});
