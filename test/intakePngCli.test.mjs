import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { PNG } from "pngjs";

import { validateLayerDoc } from "../dist/index.js";

const rootDir = process.cwd();
const cliPath = join(rootDir, "dist", "cli", "intakePng.js");

function writeHomepagePng(filePath) {
  const png = new PNG({ width: 640, height: 960 });

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (png.width * y + x) << 2;
      const inHeroVisual = x > 360 && x < 570 && y > 24 && y < 116;
      png.data[index] = inHeroVisual ? 20 : 248;
      png.data[index + 1] = inHeroVisual ? 184 : 250;
      png.data[index + 2] = inHeroVisual ? 166 : 252;
      png.data[index + 3] = 255;
    }
  }

  writeFileSync(filePath, PNG.sync.write(png));
}

test("intake PNG CLI writes analysis plan, image manifest, LayerDoc, and cropped assets", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-intake-cli-"));
  const inputPath = join(directory, "homepage.png");
  const outputDir = join(directory, "intake");
  writeHomepagePng(inputPath);

  const result = spawnSync(process.execPath, [
    cliPath,
    "--input",
    inputPath,
    "--out",
    outputDir,
    "--name",
    "CLI Imported Homepage"
  ], { cwd: rootDir, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  const analysisPlan = JSON.parse(readFileSync(join(outputDir, "analysis-plan.json"), "utf8"));
  const imageManifest = JSON.parse(readFileSync(join(outputDir, "image-manifest.json"), "utf8"));
  const layerDoc = JSON.parse(readFileSync(join(outputDir, "layerdoc.json"), "utf8"));

  assert.equal(summary.name, "CLI Imported Homepage");
  assert.equal(summary.sectionCount, 8);
  assert.equal(summary.layerCount, 18);
  assert.equal(summary.assetCount, 1);
  assert.equal(summary.analysisPlanPath, join(outputDir, "analysis-plan.json"));
  assert.equal(summary.layerDocPath, join(outputDir, "layerdoc.json"));
  assert.equal(existsSync(join(outputDir, "assets", "hero-crop.png")), true);
  assert.equal(analysisPlan.sections.length, 8);
  assert.equal(analysisPlan.sections[0].layers.length, 4);
  assert.equal(imageManifest.sections[0].layers.find((layer) => layer.id === "hero-image").asset.uri, "assets/hero-crop.png");
  assert.equal(layerDoc.sections.length, 8);
  assert.equal(layerDoc.layers.length, 18);
  assert.equal(layerDoc.assets[0].uri, "assets/hero-crop.png");
  assert.equal(validateLayerDoc(layerDoc).valid, true);
});

test("intake PNG CLI rejects missing required arguments with usage guidance", () => {
  const result = spawnSync(process.execPath, [cliPath], { cwd: rootDir, encoding: "utf8" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage: layerdoc-intake-png/);
  assert.match(result.stderr, /--input <homepage.png>/);
  assert.match(result.stderr, /--out <directory>/);
});
