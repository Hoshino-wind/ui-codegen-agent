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
  assert.deepEqual(report.componentBreakdown, {
    componentLayerCount: 2,
    coveredComponentLayerCount: 2,
    coverageRatio: 1,
    coveredLayerIds: ["title", "cta"],
    uncoveredLayerIds: []
  });
  assert.equal(report.projectFitScore, 75);
  assert.deepEqual(report.projectFitBreakdown, {
    baseScore: 50,
    finalScore: 75,
    assetCoverageRatio: 0.04,
    fullPageBitmapRisk: false,
    exportableComponents: 1,
    editableComponentLayers: 2,
    contributions: [
      {
        id: "base",
        label: "LayerDoc project-ready baseline",
        delta: 50
      },
      {
        id: "exportable-components",
        label: "Exportable components",
        delta: 15,
        count: 1,
        maximum: 30
      },
      {
        id: "editable-component-layers",
        label: "Editable component layers",
        delta: 10,
        count: 2,
        maximum: 10
      },
      {
        id: "full-page-bitmap-risk",
        label: "Full-page bitmap risk",
        delta: 0,
        triggered: false
      }
    ]
  });
  assert.equal(report.evidence.visual.kind, "none");
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
      mismatchBounds: { x: 4, y: 8, width: 6, height: 3 },
      problemAreas: [{ x: 4, y: 8, width: 6, height: 3 }],
      diffPath: "/tmp/diff.png",
      threshold: 0.1
    }
  });

  assert.equal(report.visualSimilarity, 96.5);
  assert.equal(report.evidence.visual.kind, "image-data");
  assert.deepEqual(report.visualDiff?.mismatchBounds, { x: 4, y: 8, width: 6, height: 3 });
  assert.deepEqual(report.visualDiff?.problemAreas, [{ x: 4, y: 8, width: 6, height: 3 }]);
  assert.equal(report.structureScore, 100);
  assert.equal(report.componentScore, 100);
});

test("createVerificationReport maps visual problem areas to affected LayerDoc layers", () => {
  const doc = createLayerDoc({
    name: "Visual problem attribution",
    canvas: { width: 300, height: 200 },
    layers: [
      {
        id: "hero-art",
        kind: "image",
        track: "asset",
        editable: true,
        bounds: { x: 24, y: 24, width: 220, height: 120 },
        assetId: "art"
      },
      {
        id: "headline",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 40, y: 48, width: 160, height: 36 },
        content: { text: "Production UI" }
      }
    ],
    assets: [{ id: "art", type: "image", source: "generated", bounds: { x: 24, y: 24, width: 220, height: 120 } }],
    components: [{ id: "Headline", layerIds: ["headline"], exportable: true }]
  });

  const report = createVerificationReport(doc, {
    visualDiff: {
      visualSimilarity: 96.5,
      mismatchedPixels: 14,
      comparedPixels: 400,
      dimensions: { width: 20, height: 20 },
      mismatchBounds: { x: 42, y: 50, width: 12, height: 8 },
      problemAreas: [{ x: 42, y: 50, width: 12, height: 8 }],
      diffPath: "/tmp/diff.png",
      threshold: 0.1
    }
  });

  assert.deepEqual(report.visualProblemAreas, [
    {
      id: "visual-problem-1",
      bounds: { x: 42, y: 50, width: 12, height: 8 },
      affectedLayerId: "headline",
      affectedLayerKind: "text",
      affectedLayerTrack: "component",
      affectedLayerEditable: true,
      affectedSectionId: null
    }
  ]);
});

test("createVerificationReport preserves explicit visual evidence provenance", () => {
  const doc = createLayerDoc({
    name: "Evidence override",
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
    visualSimilarity: 91,
    visualEvidence: {
      kind: "layerdoc-raster",
      label: "LayerDoc raster",
      description: "Studio rendered the LayerDoc graph into an ImageData candidate."
    }
  });

  assert.equal(report.visualSimilarity, 91);
  assert.deepEqual(report.evidence.visual, {
    kind: "layerdoc-raster",
    label: "LayerDoc raster",
    description: "Studio rendered the LayerDoc graph into an ImageData candidate."
  });
});
