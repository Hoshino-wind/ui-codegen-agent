import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { PNG } from "pngjs";

const rootDir = process.cwd();
const cliPath = join(rootDir, "dist", "cli", "homepagePipeline.js");

function writeHomepagePng(filePath) {
  const png = new PNG({ width: 640, height: 960 });

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (png.width * y + x) << 2;
      const accent = x > 360 && x < 570 && y > 24 && y < 116;
      png.data[index] = accent ? 20 : 248;
      png.data[index + 1] = accent ? 184 : 250;
      png.data[index + 2] = accent ? 166 : 252;
      png.data[index + 3] = 255;
    }
  }

  writeFileSync(filePath, PNG.sync.write(png));
}

test("homepage pipeline CLI runs PNG intake, verification, and project export", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-homepage-pipeline-"));
  const inputPath = join(directory, "homepage.png");
  const candidatePath = join(directory, "candidate.png");
  const outputDir = join(directory, "run");
  writeHomepagePng(inputPath);
  writeHomepagePng(candidatePath);

  const result = spawnSync(process.execPath, [
    cliPath,
    "--input",
    inputPath,
    "--candidate",
    candidatePath,
    "--out",
    outputDir,
    "--name",
    "Pipeline Homepage",
    "--component",
    "ProductionHomepage"
  ], { cwd: rootDir, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  const pipelineReport = JSON.parse(readFileSync(join(outputDir, "pipeline-report.json"), "utf8"));
  const projectManifest = JSON.parse(readFileSync(join(outputDir, "project", "manifest.json"), "utf8"));

  assert.equal(summary.name, "Pipeline Homepage");
  assert.equal(summary.passed, true);
  assert.equal(summary.paths.pipelineReport, join(outputDir, "pipeline-report.json"));
  assert.equal(summary.paths.layerDoc, join(outputDir, "intake", "layerdoc.json"));
  assert.equal(summary.paths.project, join(outputDir, "project"));
  assert.equal(summary.paths.verificationReport, join(outputDir, "verification", "report.json"));
  assert.equal(existsSync(join(outputDir, "intake", "analysis-plan.json")), true);
  assert.equal(existsSync(join(outputDir, "intake", "image-manifest.json")), true);
  assert.equal(existsSync(join(outputDir, "intake", "assets", "hero-crop.png")), true);
  assert.equal(existsSync(join(outputDir, "project", "src", "ProductionHomepage.tsx")), true);
  assert.equal(existsSync(join(outputDir, "project", "reference.png")), true);
  assert.equal(existsSync(join(outputDir, "project", "assets", "hero-crop.png")), true);
  assert.equal(existsSync(join(outputDir, "project", "public", "assets", "hero-crop.png")), true);
  assert.equal(existsSync(join(outputDir, "verification", "diff.png")), true);
  assert.equal(pipelineReport.intake.sectionCount, 8);
  assert.equal(pipelineReport.intake.layerCount, 18);
  assert.equal(pipelineReport.verification.passed, true);
  assert.equal(pipelineReport.verification.scores.visualSimilarity, 100);
  assert.equal(pipelineReport.project.referencePath, join(outputDir, "project", "reference.png"));
  assert.deepEqual(pipelineReport.project.copiedAssets.sort(), ["assets/hero-crop.png", "public/assets/hero-crop.png"]);
  assert.equal(projectManifest.scores.visualSimilarity, 100);
  assert.match(readFileSync(join(outputDir, "project", "src", "ProductionHomepage.tsx"), "utf8"), /Pipeline Homepage|Imported hero headline/);
});

test("homepage pipeline CLI rejects missing required arguments with usage guidance", () => {
  const result = spawnSync(process.execPath, [cliPath], { cwd: rootDir, encoding: "utf8" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage: layerdoc-run-homepage/);
  assert.match(result.stderr, /--input <homepage.png>/);
  assert.match(result.stderr, /--out <directory>/);
  assert.match(result.stderr, /--component <ComponentName>/);
});
