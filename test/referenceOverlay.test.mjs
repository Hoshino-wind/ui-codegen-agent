import assert from "node:assert/strict";
import test from "node:test";

import { createReferenceOverlayDataUrl, createReferenceOverlayStyle } from "../dist/app/referenceOverlay.js";

test("createReferenceOverlayDataUrl turns PNG bytes into a browser image source", () => {
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

  assert.equal(createReferenceOverlayDataUrl(pngBytes), "data:image/png;base64,iVBORw==");
});

test("createReferenceOverlayDataUrl returns null when no source PNG is available", () => {
  assert.equal(createReferenceOverlayDataUrl(undefined), null);
});

test("createReferenceOverlayStyle scales the full source canvas for clipped viewports", () => {
  assert.deepEqual(
    createReferenceOverlayStyle({
      canvas: { width: 1440, height: 1760 },
      opacity: 0.45,
      scale: 0.72
    }),
    {
      width: 1036.8,
      height: 1267.2,
      opacity: 0.45
    }
  );
});
