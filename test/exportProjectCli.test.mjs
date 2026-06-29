import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { createLayerDoc } from "../dist/index.js";

const rootDir = process.cwd();
const cliPath = join(rootDir, "dist", "cli", "exportProject.js");

function createCliDoc() {
  return createLayerDoc({
    name: "CLI Export Homepage",
    canvas: { width: 1440, height: 900, background: "#f7f8fb" },
    sections: [{ id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 1440, height: 900 }, layerIds: ["headline", "cta"] }],
    components: [{ id: "HeroSection", layerIds: ["headline", "cta"], exportable: true }],
    layers: [
      {
        id: "headline",
        sectionId: "hero",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 96, y: 112, width: 720, height: 96 },
        content: { text: "Exported from LayerDoc CLI" }
      },
      {
        id: "cta",
        sectionId: "hero",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 96, y: 256, width: 220, height: 56 },
        content: { text: "Ship package" }
      }
    ]
  });
}

test("export project CLI writes a project package from a LayerDoc file", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-cli-export-"));
  const inputPath = join(directory, "source.layerdoc.json");
  const outputDir = join(directory, "exported-project");
  writeFileSync(inputPath, JSON.stringify(createCliDoc(), null, 2));

  const result = spawnSync(process.execPath, [
    cliPath,
    "--input",
    inputPath,
    "--out",
    outputDir,
    "--component",
    "ProductionHomepage",
    "--package",
    "production-homepage"
  ], { cwd: rootDir, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);

  assert.equal(summary.packageName, "production-homepage");
  assert.equal(summary.componentName, "ProductionHomepage");
  assert.equal(summary.rootDir, outputDir);
  assert.deepEqual(summary.files.sort(), [
    "README.md",
    "layerdoc.json",
    "manifest.json",
    "preview.html",
    "src/ProductionHomepage.tsx"
  ]);
  assert.equal(existsSync(join(outputDir, "src", "ProductionHomepage.tsx")), true);
  assert.match(readFileSync(join(outputDir, "src", "ProductionHomepage.tsx"), "utf8"), /Exported from LayerDoc CLI/);
  assert.match(readFileSync(join(outputDir, "manifest.json"), "utf8"), /"packageName": "production-homepage"/);
});

test("export project CLI rejects missing required arguments with usage guidance", () => {
  const result = spawnSync(process.execPath, [cliPath], { cwd: rootDir, encoding: "utf8" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage: layerdoc-export-project/);
  assert.match(result.stderr, /--input <layerdoc.json>/);
  assert.match(result.stderr, /--out <directory>/);
});
