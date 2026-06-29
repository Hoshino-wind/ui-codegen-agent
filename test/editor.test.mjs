import assert from "node:assert/strict";
import test from "node:test";

import { createLayerDoc, moveSection, updateTextLayer } from "../dist/index.js";

test("updateTextLayer changes copy without mutating the original LayerDoc", () => {
  const doc = createLayerDoc({
    name: "Editable page",
    canvas: { width: 800, height: 600 },
    layers: [
      {
        id: "headline",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 40, y: 40, width: 320, height: 48 },
        content: { text: "Old headline" }
      }
    ]
  });

  const next = updateTextLayer(doc, "headline", "New headline");

  assert.equal(doc.layers[0].content.text, "Old headline");
  assert.equal(next.layers[0].content.text, "New headline");
});

test("moveSection reorders sections while keeping layer membership intact", () => {
  const doc = createLayerDoc({
    name: "Section order",
    canvas: { width: 800, height: 1200 },
    sections: [
      { id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 800, height: 400 }, layerIds: ["headline"] },
      { id: "proof", name: "Proof", bounds: { x: 0, y: 400, width: 800, height: 400 }, layerIds: ["metric"] },
      { id: "cta", name: "CTA", bounds: { x: 0, y: 800, width: 800, height: 400 }, layerIds: ["button"] }
    ]
  });

  const next = moveSection(doc, "cta", 0);

  assert.deepEqual(next.sections.map((section) => section.id), ["cta", "hero", "proof"]);
  assert.deepEqual(next.sections[0].layerIds, ["button"]);
});
