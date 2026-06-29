import assert from "node:assert/strict";
import test from "node:test";

import { createLayerDoc, renderHtmlPreview } from "../dist/index.js";

test("renderHtmlPreview emits editable DOM markers from LayerDoc layers", () => {
  const doc = createLayerDoc({
    name: "Preview",
    canvas: { width: 640, height: 480, background: "#ffffff" },
    layers: [
      {
        id: "headline",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 24, y: 32, width: 320, height: 48 },
        content: { text: "LayerDoc first" }
      },
      {
        id: "hero-art",
        kind: "image",
        track: "asset",
        editable: true,
        bounds: { x: 360, y: 32, width: 200, height: 160 },
        assetId: "asset-hero"
      }
    ],
    assets: [{ id: "asset-hero", type: "image", source: "generated", uri: "/hero.png" }]
  });

  const html = renderHtmlPreview(doc);

  assert.match(html, /data-layer-id="headline"/);
  assert.match(html, /LayerDoc first/);
  assert.match(html, /data-track="asset"/);
  assert.match(html, /src="\/hero.png"/);
  assert.match(html, /width:640px/);
});
