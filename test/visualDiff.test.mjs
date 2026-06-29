import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { PNG } from "pngjs";

import { comparePngSnapshots } from "../dist/index.js";

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

test("comparePngSnapshots scores identical PNG screenshots as a perfect visual match", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-visual-diff-"));
  const referencePath = join(directory, "reference.png");
  const candidatePath = join(directory, "candidate.png");

  writeSolidPng(referencePath, 3, 2, [24, 32, 48, 255]);
  writeSolidPng(candidatePath, 3, 2, [24, 32, 48, 255]);

  const result = comparePngSnapshots({ referencePath, candidatePath });

  assert.equal(result.visualSimilarity, 100);
  assert.equal(result.mismatchedPixels, 0);
  assert.equal(result.comparedPixels, 6);
  assert.deepEqual(result.dimensions, { width: 3, height: 2 });
  assert.equal(result.mismatchBounds, null);
  assert.deepEqual(result.problemAreas, []);
  assert.equal(result.diffPath, null);
});

test("comparePngSnapshots writes a diff PNG and reports mismatched pixels", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-visual-diff-"));
  const referencePath = join(directory, "reference.png");
  const candidatePath = join(directory, "candidate.png");
  const diffPath = join(directory, "diff.png");

  writeSolidPng(referencePath, 3, 2, [24, 32, 48, 255]);
  writeSolidPng(candidatePath, 3, 2, [24, 32, 48, 255], [{ x: 2, y: 1, color: [220, 38, 38, 255] }]);

  const result = comparePngSnapshots({ referencePath, candidatePath, diffPath, threshold: 0 });

  assert.equal(result.visualSimilarity, 83.33);
  assert.equal(result.mismatchedPixels, 1);
  assert.equal(result.comparedPixels, 6);
  assert.deepEqual(result.mismatchBounds, { x: 2, y: 1, width: 1, height: 1 });
  assert.deepEqual(result.problemAreas, [{ x: 2, y: 1, width: 1, height: 1 }]);
  assert.equal(result.diffPath, diffPath);
  assert.equal(existsSync(diffPath), true);

  const diff = PNG.sync.read(readFileSync(diffPath));
  assert.equal(diff.width, 3);
  assert.equal(diff.height, 2);
});

test("comparePngSnapshots groups separate mismatch clusters into problem areas", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-visual-diff-"));
  const referencePath = join(directory, "reference.png");
  const candidatePath = join(directory, "candidate.png");

  writeSolidPng(referencePath, 6, 4, [248, 250, 252, 255]);
  writeSolidPng(candidatePath, 6, 4, [248, 250, 252, 255], [
    { x: 1, y: 1, color: [15, 23, 42, 255] },
    { x: 2, y: 1, color: [15, 23, 42, 255] },
    { x: 5, y: 3, color: [20, 184, 166, 255] }
  ]);

  const result = comparePngSnapshots({ referencePath, candidatePath, threshold: 0 });

  assert.equal(result.mismatchedPixels, 3);
  assert.deepEqual(result.mismatchBounds, { x: 1, y: 1, width: 5, height: 3 });
  assert.deepEqual(result.problemAreas, [
    { x: 1, y: 1, width: 2, height: 1 },
    { x: 5, y: 3, width: 1, height: 1 }
  ]);
});
