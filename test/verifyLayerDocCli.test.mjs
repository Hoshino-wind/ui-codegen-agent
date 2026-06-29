import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { PNG } from "pngjs";

import { createLayerDoc } from "../dist/index.js";

const rootDir = process.cwd();
const cliPath = join(rootDir, "dist", "cli", "verifyLayerDoc.js");

function writeSolidPng(filePath, width, height, color) {
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

  writeFileSync(filePath, PNG.sync.write(png));
}

function createVerifierCliDoc() {
  return createLayerDoc({
    name: "CLI Verifier Homepage",
    canvas: { width: 8, height: 6, background: "#ffffff" },
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
        bounds: { x: 1, y: 1, width: 5, height: 1 },
        content: { text: "Verify LayerDoc" }
      },
      {
        id: "cta",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 1, y: 3, width: 4, height: 1 },
        content: { text: "Run diff" }
      }
    ]
  });
}

test("verify LayerDoc CLI compares reference and candidate PNGs and writes report artifacts", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-verify-cli-"));
  const inputPath = join(directory, "source.layerdoc.json");
  const referencePath = join(directory, "reference.png");
  const candidatePath = join(directory, "candidate.png");
  const outputDir = join(directory, "verification");
  writeFileSync(inputPath, JSON.stringify(createVerifierCliDoc(), null, 2));
  writeSolidPng(referencePath, 8, 6, [255, 255, 255, 255]);
  writeSolidPng(candidatePath, 8, 6, [255, 255, 255, 255]);

  const result = spawnSync(process.execPath, [
    cliPath,
    "--input",
    inputPath,
    "--reference",
    referencePath,
    "--candidate",
    candidatePath,
    "--out",
    outputDir
  ], { cwd: rootDir, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  const report = JSON.parse(readFileSync(join(outputDir, "report.json"), "utf8"));

  assert.equal(summary.passed, true);
  assert.equal(summary.reportPath, join(outputDir, "report.json"));
  assert.equal(summary.artifacts.referencePath, referencePath);
  assert.equal(summary.artifacts.candidatePath, candidatePath);
  assert.equal(summary.artifacts.diffPath, join(outputDir, "diff.png"));
  assert.equal(summary.scores.visualSimilarity, 100);
  assert.equal(report.report.visualSimilarity, 100);
  assert.equal(report.passed, true);
  assert.equal(existsSync(join(outputDir, "diff.png")), true);
  assert.equal(existsSync(join(outputDir, "report.json")), true);
});

test("verify LayerDoc CLI rejects missing required arguments with usage guidance", () => {
  const result = spawnSync(process.execPath, [cliPath], { cwd: rootDir, encoding: "utf8" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage: layerdoc-verify/);
  assert.match(result.stderr, /--input <layerdoc.json>/);
  assert.match(result.stderr, /--reference <reference.png>/);
  assert.match(result.stderr, /--out <directory>/);
});
