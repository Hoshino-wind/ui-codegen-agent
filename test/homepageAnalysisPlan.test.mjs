import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { PNG } from "pngjs";

import {
  addAnalysisLayer,
  createHomepageAnalysisPlan,
  createImageManifestFromPng,
  seedHomepageAnalysisPlan,
  toPngIntakeSections,
  updateAnalysisLayer,
  validateHomepageAnalysisPlan
} from "../dist/index.js";

function writeSourcePng(path) {
  const png = new PNG({ width: 160, height: 800 });

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (png.width * y + x) << 2;
      png.data[index] = x > 96 && y < 120 ? 20 : 248;
      png.data[index + 1] = x > 96 && y < 120 ? 184 : 250;
      png.data[index + 2] = x > 96 && y < 120 ? 166 : 252;
      png.data[index + 3] = 255;
    }
  }

  writeFileSync(path, PNG.sync.write(png));
}

test("createHomepageAnalysisPlan scaffolds eight homepage sections across the PNG canvas", () => {
  const plan = createHomepageAnalysisPlan({
    name: "Imported homepage",
    canvas: { width: 160, height: 800 }
  });

  assert.equal(plan.sections.length, 8);
  assert.deepEqual(plan.sections.map((section) => section.id), [
    "hero",
    "proof",
    "workflow",
    "features",
    "editor",
    "export",
    "verifier",
    "final-cta"
  ]);
  assert.deepEqual(plan.sections[0].bounds, { x: 0, y: 0, width: 160, height: 100 });
  assert.deepEqual(plan.sections[7].bounds, { x: 0, y: 700, width: 160, height: 100 });
  assert.deepEqual(validateHomepageAnalysisPlan(plan), []);
});

test("addAnalysisLayer and updateAnalysisLayer edit the analysis plan without mutating the original", () => {
  const plan = createHomepageAnalysisPlan({
    name: "Imported homepage",
    canvas: { width: 160, height: 800 }
  });

  const withText = addAnalysisLayer(plan, "hero", {
    id: "hero-title",
    kind: "text",
    bounds: { x: 12, y: 20, width: 80, height: 20 },
    text: "Original"
  });
  const updated = updateAnalysisLayer(withText, "hero-title", {
    text: "Updated",
    bounds: { x: 16, y: 24, width: 96, height: 24 }
  });

  assert.equal(plan.sections[0].layers.length, 0);
  assert.equal(withText.sections[0].layers[0].text, "Original");
  assert.equal(updated.sections[0].layers[0].text, "Updated");
  assert.deepEqual(updated.sections[0].layers[0].bounds, { x: 16, y: 24, width: 96, height: 24 });
});

test("homepage analysis plan can feed PNG intake after layer annotation", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-analysis-plan-"));
  const sourcePngPath = join(directory, "homepage.png");
  writeSourcePng(sourcePngPath);

  const plan = createHomepageAnalysisPlan({
    name: "Imported homepage",
    canvas: { width: 160, height: 800 }
  });
  const withTitle = addAnalysisLayer(plan, "hero", {
    id: "hero-title",
    kind: "text",
    bounds: { x: 12, y: 20, width: 80, height: 20 },
    text: "Imported hero"
  });
  const withImage = addAnalysisLayer(withTitle, "hero", {
    id: "hero-image",
    kind: "image",
    bounds: { x: 100, y: 20, width: 48, height: 52 },
    alt: "Hero crop",
    asset: {
      id: "hero-crop",
      fileName: "hero-crop.png",
      cropBounds: { x: 100, y: 20, width: 48, height: 52 }
    }
  });

  const completePlan = seedHomepageAnalysisPlan(withImage);
  const manifest = createImageManifestFromPng({
    name: completePlan.name,
    sourcePngPath,
    assetOutputDir: join(directory, "assets"),
    publicAssetBaseUri: "/assets/imported",
    sections: toPngIntakeSections(completePlan)
  });

  assert.equal(manifest.sections.length, 8);
  assert.equal(manifest.sections[0].layers[0].text, "Imported hero");
  assert.equal(manifest.sections[0].layers[1].asset.uri, "/assets/imported/hero-crop.png");
  assert.equal(manifest.sections.every((section) => section.layers.length > 0), true);
});

test("homepage analysis plan preserves layer style through PNG intake sections", () => {
  const plan = createHomepageAnalysisPlan({
    name: "Styled homepage",
    canvas: { width: 160, height: 800 }
  });
  const withLayer = addAnalysisLayer(plan, "hero", {
    id: "hero-title",
    kind: "text",
    bounds: { x: 12, y: 20, width: 80, height: 20 },
    text: "Styled hero",
    style: {
      textColor: "#0f172a",
      fontSize: 22,
      fontWeight: 820,
      padding: { x: 4, y: 2 }
    }
  });
  const updated = updateAnalysisLayer(withLayer, "hero-title", {
    style: {
      textColor: "#111827",
      fontSize: 24,
      fontWeight: 860,
      padding: { x: 6, y: 3 }
    }
  });
  const sections = toPngIntakeSections(updated);

  assert.equal(withLayer.sections[0].layers[0].style.textColor, "#0f172a");
  assert.deepEqual(sections[0].layers[0].style, {
    textColor: "#111827",
    fontSize: 24,
    fontWeight: 860,
    padding: { x: 6, y: 3 }
  });

  sections[0].layers[0].style.padding.x = 99;
  assert.equal(updated.sections[0].layers[0].style.padding.x, 6);
});

test("validateHomepageAnalysisPlan reports duplicate ids and out-of-canvas bounds", () => {
  const plan = createHomepageAnalysisPlan({
    name: "Invalid homepage",
    canvas: { width: 160, height: 800 }
  });
  const withLayer = addAnalysisLayer(plan, "hero", {
    id: "duplicate",
    kind: "text",
    bounds: { x: 12, y: 20, width: 80, height: 20 },
    text: "One"
  });
  const invalid = addAnalysisLayer(withLayer, "proof", {
    id: "duplicate",
    kind: "text",
    bounds: { x: 120, y: 780, width: 80, height: 40 },
    text: "Two"
  });

  assert.deepEqual(validateHomepageAnalysisPlan(invalid), [
    'Duplicate layer id "duplicate".',
    'Layer "duplicate" bounds must stay inside the canvas.'
  ]);
});
