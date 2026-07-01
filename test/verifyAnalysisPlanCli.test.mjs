import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { PNG } from "pngjs";

const rootDir = process.cwd();
const cliPath = join(rootDir, "dist", "cli", "verifyAnalysisPlan.js");

function writeHomepagePng(filePath) {
  const png = new PNG({ width: 640, height: 960 });

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (png.width * y + x) << 2;
      png.data[index] = 248;
      png.data[index + 1] = 250;
      png.data[index + 2] = 252;
      png.data[index + 3] = 255;
    }
  }

  writeFileSync(filePath, PNG.sync.write(png));
}

function createCompleteAnalysisPlan() {
  const names = ["Hero", "Proof", "Workflow", "Features", "Editor", "Export", "Verifier", "Final CTA"];
  return {
    name: "Verified homepage plan",
    canvas: { width: 640, height: 960 },
    sections: names.map((name, index) => {
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const y = index * 120;
      return {
        id,
        name,
        bounds: { x: 0, y, width: 640, height: 120 },
        layers: [
          {
            id: `${id}-copy`,
            kind: "text",
            bounds: { x: 32, y: y + 24, width: 320, height: 40 },
            text: `${name} copy`
          }
        ]
      };
    })
  };
}

test("verify analysis plan CLI accepts a complete plan and writes an audit report", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-analysis-plan-verify-"));
  const inputPath = join(directory, "analysis-plan.json");
  const sourcePath = join(directory, "homepage.png");
  const outputDir = join(directory, "out");
  writeHomepagePng(sourcePath);
  writeFileSync(inputPath, JSON.stringify(createCompleteAnalysisPlan(), null, 2));

  const result = spawnSync(process.execPath, [
    cliPath,
    "--input",
    inputPath,
    "--source",
    sourcePath,
    "--out",
    outputDir
  ], { cwd: rootDir, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  const audit = JSON.parse(readFileSync(join(outputDir, "analysis-plan-audit.json"), "utf8"));

  assert.equal(summary.passed, true);
  assert.equal(summary.paths.audit, join(outputDir, "analysis-plan-audit.json"));
  assert.equal(existsSync(summary.paths.audit), true);
  assert.equal(audit.readiness.readyForLayerDoc, true);
  assert.equal(audit.summary.sections, 8);
  assert.equal(audit.summary.layers, 8);
  assert.deepEqual(audit.tracks, {
    component: 8,
    asset: 0,
    approximation: 0,
    layout: 0
  });
});

test("verify analysis plan CLI rejects incomplete plans before LayerDoc build", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-analysis-plan-incomplete-"));
  const inputPath = join(directory, "analysis-plan.json");
  const outputDir = join(directory, "out");
  const plan = createCompleteAnalysisPlan();
  plan.sections[3].layers = [];
  writeFileSync(inputPath, JSON.stringify(plan, null, 2));

  const result = spawnSync(process.execPath, [
    cliPath,
    "--input",
    inputPath,
    "--out",
    outputDir
  ], { cwd: rootDir, encoding: "utf8" });

  assert.equal(result.status, 2);
  const summary = JSON.parse(result.stdout);
  const audit = JSON.parse(readFileSync(join(outputDir, "analysis-plan-audit.json"), "utf8"));

  assert.equal(summary.passed, false);
  assert.match(summary.blockers.join(" "), /Add at least one layer to each homepage section/);
  assert.deepEqual(audit.coverage.emptySectionIds, ["features"]);
});

test("verify analysis plan CLI rejects plans for a different source PNG canvas", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-analysis-plan-canvas-"));
  const inputPath = join(directory, "analysis-plan.json");
  const sourcePath = join(directory, "homepage.png");
  const plan = createCompleteAnalysisPlan();
  plan.canvas.width = 800;
  writeHomepagePng(sourcePath);
  writeFileSync(inputPath, JSON.stringify(plan, null, 2));

  const result = spawnSync(process.execPath, [
    cliPath,
    "--input",
    inputPath,
    "--source",
    sourcePath
  ], { cwd: rootDir, encoding: "utf8" });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Analysis Plan canvas 800x960 must match source PNG 640x960/);
});

