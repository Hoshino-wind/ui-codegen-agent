import assert from "node:assert/strict";
import test from "node:test";

import { createPreviewViewport } from "../dist/app/previewViewport.js";

test("createPreviewViewport returns full-canvas desktop preview geometry", () => {
  const viewport = createPreviewViewport({
    mode: "desktop",
    canvas: { width: 1440, height: 1760 }
  });

  assert.equal(viewport.mode, "desktop");
  assert.deepEqual(viewport.frame, { width: 1440, height: 1760 });
  assert.equal(viewport.scale, 0.46);
  assert.equal(viewport.display.width, 662.4);
  assert.equal(viewport.display.height, 809.6);
  assert.deepEqual(viewport.rulerTicks, [0, 480, 960, 1440]);
});

test("createPreviewViewport returns a clipped mobile viewport over the LayerDoc canvas", () => {
  const viewport = createPreviewViewport({
    mode: "mobile",
    canvas: { width: 1440, height: 1760 }
  });

  assert.equal(viewport.mode, "mobile");
  assert.deepEqual(viewport.frame, { width: 390, height: 844 });
  assert.equal(viewport.scale, 0.72);
  assert.equal(viewport.display.width, 280.8);
  assert.equal(viewport.display.height, 607.68);
  assert.deepEqual(viewport.rulerTicks, [0, 130, 260, 390]);
});

test("createPreviewViewport keeps mobile height within the source canvas", () => {
  const viewport = createPreviewViewport({
    mode: "mobile",
    canvas: { width: 320, height: 480 }
  });

  assert.deepEqual(viewport.frame, { width: 320, height: 480 });
  assert.deepEqual(viewport.rulerTicks, [0, 107, 213, 320]);
});
