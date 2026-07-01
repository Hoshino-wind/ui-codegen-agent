import assert from "node:assert/strict";
import test from "node:test";

import { createProblemAreaAnnotations, createProblemAreaAnnotationsFromReport } from "../dist/app/problemAreaOverlay.js";

test("createProblemAreaAnnotations scales verifier problem areas for the current preview", () => {
  const annotations = createProblemAreaAnnotations(
    [
      { x: 20, y: 40, width: 100, height: 50 },
      { x: 300, y: 120, width: 80, height: 90 }
    ],
    { scale: 0.5 }
  );

  assert.deepEqual(annotations, [
    {
      id: "problem-area-1",
      label: "#1 20,40 100x50",
      bounds: { x: 10, y: 20, width: 50, height: 25 }
    },
    {
      id: "problem-area-2",
      label: "#2 300,120 80x90",
      bounds: { x: 150, y: 60, width: 40, height: 45 }
    }
  ]);
});

test("createProblemAreaAnnotations keeps tiny mismatches visible in the editor", () => {
  const annotations = createProblemAreaAnnotations([{ x: 5, y: 6, width: 1, height: 1 }], { scale: 0.25 });

  assert.deepEqual(annotations[0].bounds, { x: 1.25, y: 1.5, width: 6, height: 6 });
});

test("createProblemAreaAnnotations identifies the most specific affected layer", () => {
  const annotations = createProblemAreaAnnotations(
    [{ x: 112, y: 124, width: 30, height: 18 }],
    {
      scale: 0.5,
      layers: [
        {
          id: "hero-art",
          kind: "image",
          track: "asset",
          editable: true,
          bounds: { x: 80, y: 96, width: 340, height: 220 }
        },
        {
          id: "hero-title",
          kind: "text",
          track: "component",
          editable: true,
          bounds: { x: 104, y: 118, width: 180, height: 48 }
        }
      ]
    }
  );

  assert.equal(annotations[0].affectedLayerId, "hero-title");
  assert.equal(annotations[0].affectedLayerLabel, "hero-title");
});

test("createProblemAreaAnnotations leaves unmatched problem areas unbound", () => {
  const annotations = createProblemAreaAnnotations(
    [{ x: 500, y: 600, width: 40, height: 30 }],
    {
      scale: 1,
      layers: [
        {
          id: "hero-title",
          kind: "text",
          track: "component",
          editable: true,
          bounds: { x: 104, y: 118, width: 180, height: 48 }
        }
      ]
    }
  );

  assert.equal(annotations[0].affectedLayerId, null);
  assert.equal(annotations[0].affectedLayerLabel, null);
});

test("createProblemAreaAnnotationsFromReport scales report-owned visual problem attribution", () => {
  const annotations = createProblemAreaAnnotationsFromReport(
    [
      {
        id: "visual-problem-1",
        bounds: { x: 20, y: 40, width: 4, height: 2 },
        affectedLayerId: "hero-title",
        affectedLayerKind: "text",
        affectedLayerTrack: "component",
        affectedLayerEditable: true,
        affectedSectionId: "hero"
      }
    ],
    { scale: 0.5 }
  );

  assert.deepEqual(annotations, [
    {
      id: "visual-problem-1",
      label: "#1 20,40 4x2",
      bounds: { x: 10, y: 20, width: 6, height: 6 },
      affectedLayerId: "hero-title",
      affectedLayerLabel: "hero-title"
    }
  ]);
});
