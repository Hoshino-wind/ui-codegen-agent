import assert from "node:assert/strict";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { PNG } from "pngjs";

import { createLayerDoc, runLayerDocVerification } from "../dist/index.js";

function writeSolidPng(filePath, width, height, color, edits = []) {
  const png = new PNG({ width, height });

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (width * y + x) << 2;
      png.data[index] = color[0];
      png.data[index + 1] = color[1];
      png.data[index + 2] = color[2];
      png.data[index + 3] = color[3];
    }
  }

  for (const edit of edits) {
    const index = (width * edit.y + edit.x) << 2;
    png.data[index] = edit.color[0];
    png.data[index + 1] = edit.color[1];
    png.data[index + 2] = edit.color[2];
    png.data[index + 3] = edit.color[3];
  }

  writeFileSync(filePath, PNG.sync.write(png));
}

function createVerifierDoc() {
  return createLayerDoc({
    name: "Verifier run",
    canvas: { width: 6, height: 4 },
    components: [
      { id: "Headline", layerIds: ["headline"], exportable: true },
      { id: "CTA", layerIds: ["cta"], exportable: true }
    ],
    layers: [
      {
        id: "headline",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 1, y: 1, width: 3, height: 1 },
        content: { text: "LayerDoc" }
      },
      {
        id: "cta",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 1, y: 2, width: 2, height: 1 },
        content: { text: "Export" }
      }
    ]
  });
}

test("runLayerDocVerification combines screenshot diff artifacts with LayerDoc quality gates", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-verifier-run-"));
  const referencePath = join(directory, "reference.png");
  const candidatePath = join(directory, "candidate.png");
  const diffPath = join(directory, "diff.png");

  writeSolidPng(referencePath, 6, 4, [255, 255, 255, 255]);
  writeSolidPng(candidatePath, 6, 4, [255, 255, 255, 255], [{ x: 5, y: 3, color: [220, 38, 38, 255] }]);

  const run = runLayerDocVerification({
    doc: createVerifierDoc(),
    referencePath,
    candidatePath,
    diffPath,
    gates: { visualSimilarity: 99 }
  });

  assert.equal(run.report.visualSimilarity, 95.83);
  assert.equal(run.report.evidence.visual.kind, "image-data");
  assert.deepEqual(run.report.visualDiff?.problemAreas, [{ x: 5, y: 3, width: 1, height: 1 }]);
  assert.equal(run.artifacts.referencePath, referencePath);
  assert.equal(run.artifacts.candidatePath, candidatePath);
  assert.equal(run.artifacts.diffPath, diffPath);
  assert.equal(existsSync(diffPath), true);
  assert.equal(run.passed, false);
  assert.deepEqual(run.failures, ["visual_similarity 95.83 is below 99"]);
});

test("runLayerDocVerification passes when all quality gates are met", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-verifier-run-"));
  const referencePath = join(directory, "reference.png");
  const candidatePath = join(directory, "candidate.png");

  writeSolidPng(referencePath, 6, 4, [15, 23, 42, 255]);
  writeSolidPng(candidatePath, 6, 4, [15, 23, 42, 255]);

  const run = runLayerDocVerification({
    doc: createVerifierDoc(),
    referencePath,
    candidatePath
  });

  assert.equal(run.report.visualSimilarity, 100);
  assert.equal(run.report.evidence.visual.kind, "image-data");
  assert.equal(run.report.structureScore, 100);
  assert.equal(run.report.componentScore, 100);
  assert.equal(run.report.projectFitScore, 90);
  assert.equal(run.passed, true);
  assert.deepEqual(run.failures, []);
});
