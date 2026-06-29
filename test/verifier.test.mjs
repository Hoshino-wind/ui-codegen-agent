import assert from "node:assert/strict";
import test from "node:test";

import { createLayerDoc, createVerificationReport } from "../dist/index.js";

test("createVerificationReport separates visual, structure, component, and project-fit scores", () => {
  const doc = createLayerDoc({
    name: "Verification",
    canvas: { width: 1000, height: 1000 },
    assets: [{ id: "photo", type: "image", source: "generated", bounds: { x: 0, y: 0, width: 200, height: 200 } }],
    components: [{ id: "Hero", layerIds: ["title", "cta"], exportable: true }],
    layers: [
      {
        id: "title",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 80, y: 80, width: 300, height: 50 },
        content: { text: "AI UI Production" }
      },
      {
        id: "cta",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 80, y: 150, width: 120, height: 44 },
        content: { text: "Export" }
      },
      {
        id: "photo-layer",
        kind: "image",
        track: "asset",
        editable: true,
        bounds: { x: 600, y: 80, width: 200, height: 200 },
        assetId: "photo"
      }
    ]
  });

  const report = createVerificationReport(doc, { visualSimilarity: 87.4 });

  assert.equal(report.visualSimilarity, 87.4);
  assert.equal(report.structureScore, 100);
  assert.equal(report.componentScore, 100);
  assert.equal(report.projectFitScore, 75);
  assert.deepEqual(report.issues, []);
});

test("createVerificationReport can consume a PNG visual diff result", () => {
  const doc = createLayerDoc({
    name: "Visual diff report",
    canvas: { width: 300, height: 200 },
    layers: [
      {
        id: "headline",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 24, y: 24, width: 180, height: 32 },
        content: { text: "Production UI" }
      }
    ],
    components: [{ id: "Headline", layerIds: ["headline"], exportable: true }]
  });

  const report = createVerificationReport(doc, {
    visualDiff: {
      visualSimilarity: 96.5,
      mismatchedPixels: 14,
      comparedPixels: 400,
      dimensions: { width: 20, height: 20 },
      diffPath: "/tmp/diff.png",
      threshold: 0.1
    }
  });

  assert.equal(report.visualSimilarity, 96.5);
  assert.equal(report.structureScore, 100);
  assert.equal(report.componentScore, 100);
});
