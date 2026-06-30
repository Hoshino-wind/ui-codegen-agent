import assert from "node:assert/strict";
import test from "node:test";

import { createProblemAreaAnnotations } from "../dist/app/problemAreaOverlay.js";

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
