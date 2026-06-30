import assert from "node:assert/strict";
import test from "node:test";

import {
  createLayerDoc,
  moveSection,
  requestSectionRegeneration,
  setSectionVisibility,
  updateImageLayerAsset,
  updateLayerBounds,
  updateLayerStyle,
  updateTextLayer
} from "../dist/index.js";

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

test("setSectionVisibility hides a module without removing its editable layers", () => {
  const doc = createLayerDoc({
    name: "Visibility controls",
    canvas: { width: 800, height: 1200 },
    sections: [
      { id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 800, height: 400 }, layerIds: ["headline"] },
      { id: "proof", name: "Proof", bounds: { x: 0, y: 400, width: 800, height: 400 }, layerIds: ["metric"] }
    ],
    layers: [
      {
        id: "metric",
        sectionId: "proof",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 48, y: 460, width: 320, height: 40 },
        content: { text: "Trusted by product teams" }
      }
    ]
  });

  const next = setSectionVisibility(doc, "proof", false);

  assert.equal(doc.sections.find((section) => section.id === "proof").visible, undefined);
  assert.equal(next.sections.find((section) => section.id === "proof").visible, false);
  assert.equal(next.layers.find((layer) => layer.id === "metric").content.text, "Trusted by product teams");
});

test("requestSectionRegeneration queues an operator request without mutating the original LayerDoc", () => {
  const doc = createLayerDoc({
    name: "Regeneration controls",
    canvas: { width: 800, height: 1200 },
    sections: [
      { id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 800, height: 400 }, layerIds: ["headline"] }
    ]
  });

  const next = requestSectionRegeneration(doc, "hero", {
    prompt: "Make the hero feel more enterprise-grade while preserving layout.",
    requestedAt: "2026-06-30T10:00:00.000Z"
  });

  assert.equal(doc.generation.sectionRequests.length, 0);
  assert.deepEqual(next.generation.sectionRequests, [
    {
      id: "regen-hero-1",
      sectionId: "hero",
      prompt: "Make the hero feel more enterprise-grade while preserving layout.",
      status: "requested",
      requestedAt: "2026-06-30T10:00:00.000Z"
    }
  ]);
});

test("updateLayerStyle merges controlled visual style without mutating the original LayerDoc", () => {
  const doc = createLayerDoc({
    name: "Style controls",
    canvas: { width: 800, height: 600 },
    layers: [
      {
        id: "cta",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 40, y: 40, width: 160, height: 48 },
        style: { backgroundColor: "#e2e8f0", borderRadius: 8 },
        content: { text: "Start" }
      }
    ]
  });

  const next = updateLayerStyle(doc, "cta", {
    backgroundColor: "#111827",
    textColor: "#ffffff",
    borderRadius: 16,
    padding: { x: 24, y: 12 }
  });

  assert.equal(doc.layers[0].style.backgroundColor, "#e2e8f0");
  assert.equal(doc.layers[0].style.borderRadius, 8);
  assert.deepEqual(next.layers[0].style, {
    backgroundColor: "#111827",
    borderRadius: 16,
    textColor: "#ffffff",
    padding: { x: 24, y: 12 }
  });
});

test("updateImageLayerAsset replaces an image layer asset without mutating the original LayerDoc", () => {
  const doc = createLayerDoc({
    name: "Image controls",
    canvas: { width: 800, height: 600 },
    assets: [{ id: "hero-crop", type: "image", source: "reference-crop", uri: "/old.png" }],
    layers: [
      {
        id: "hero-image",
        kind: "image",
        track: "asset",
        editable: true,
        bounds: { x: 420, y: 40, width: 280, height: 180 },
        assetId: "hero-crop"
      }
    ]
  });

  const next = updateImageLayerAsset(doc, "hero-image", {
    uri: "/new.png",
    source: "uploaded"
  });

  assert.equal(doc.assets[0].uri, "/old.png");
  assert.equal(doc.assets[0].source, "reference-crop");
  assert.equal(next.assets[0].uri, "/new.png");
  assert.equal(next.assets[0].source, "uploaded");
});

test("updateLayerBounds patches geometry for spacing controls while preserving existing dimensions", () => {
  const doc = createLayerDoc({
    name: "Bounds controls",
    canvas: { width: 800, height: 600 },
    layers: [
      {
        id: "card",
        kind: "card",
        track: "component",
        editable: true,
        bounds: { x: 40, y: 40, width: 240, height: 160 }
      }
    ]
  });

  const next = updateLayerBounds(doc, "card", { x: 72, y: 96 });

  assert.deepEqual(doc.layers[0].bounds, { x: 40, y: 40, width: 240, height: 160 });
  assert.deepEqual(next.layers[0].bounds, { x: 72, y: 96, width: 240, height: 160 });
});
