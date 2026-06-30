import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { PNG } from "pngjs";

import { createLayerDoc, runLayerDocPreviewVerification } from "../dist/index.js";

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

function createPreviewDoc() {
  return createLayerDoc({
    name: "Preview verifier",
    canvas: { width: 6, height: 4, background: "#ffffff" },
    components: [
      { id: "Title", layerIds: ["title"], exportable: true },
      { id: "CTA", layerIds: ["cta"], exportable: true }
    ],
    layers: [
      {
        id: "title",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 1, y: 1, width: 4, height: 1 },
        content: { text: "Preview" }
      },
      {
        id: "cta",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 1, y: 2, width: 3, height: 1 },
        content: { text: "Run" }
      }
    ]
  });
}

test("runLayerDocPreviewVerification renders preview HTML before comparing screenshots", async () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-preview-verifier-"));
  const referencePath = join(directory, "reference.png");
  writeSolidPng(referencePath, 6, 4, [255, 255, 255, 255]);

  const run = await runLayerDocPreviewVerification({
    doc: createPreviewDoc(),
    referencePath,
    outputDir: directory,
    browserExecutablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    renderer: async ({ browserExecutablePath, htmlPath, screenshotPath, viewport }) => {
      assert.equal(existsSync(htmlPath), true);
      assert.match(readFileSync(htmlPath, "utf8"), /data-layerdoc="0.1.0"/);
      assert.deepEqual(viewport, { width: 6, height: 4 });
      assert.equal(browserExecutablePath, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
      writeSolidPng(screenshotPath, 6, 4, [255, 255, 255, 255], [{ x: 5, y: 3, color: [220, 38, 38, 255] }]);
    },
    gates: { visualSimilarity: 99 }
  });

  assert.equal(existsSync(run.artifacts.previewHtmlPath), true);
  assert.equal(existsSync(run.artifacts.candidatePath), true);
  assert.equal(existsSync(run.artifacts.diffPath), true);
  assert.equal(run.report.visualSimilarity, 95.83);
  assert.equal(run.report.evidence.visual.kind, "html-screenshot");
  assert.deepEqual(run.report.visualDiff?.problemAreas, [{ x: 5, y: 3, width: 1, height: 1 }]);
  assert.equal(run.passed, false);
  assert.deepEqual(run.failures, ["visual_similarity 95.83 is below 99"]);
});

test("runLayerDocPreviewVerification passes when the rendered preview screenshot matches the reference", async () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-preview-verifier-"));
  const referencePath = join(directory, "reference.png");
  writeSolidPng(referencePath, 6, 4, [15, 23, 42, 255]);

  const run = await runLayerDocPreviewVerification({
    doc: createPreviewDoc(),
    referencePath,
    outputDir: directory,
    renderer: ({ screenshotPath }) => {
      writeSolidPng(screenshotPath, 6, 4, [15, 23, 42, 255]);
    }
  });

  assert.equal(run.report.visualSimilarity, 100);
  assert.equal(run.report.evidence.visual.kind, "html-screenshot");
  assert.equal(run.passed, true);
  assert.deepEqual(run.failures, []);
});
