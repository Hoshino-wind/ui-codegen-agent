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

function createExternalAnalysisPlan() {
  const sectionNames = ["Hero", "Proof", "Workflow", "Features", "Editor", "Export", "Verifier", "Final CTA"];
  return {
    name: "Provided Plan Homepage",
    canvas: { width: 640, height: 960 },
    sections: sectionNames.map((name, index) => {
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
            text: index === 0 ? "Provided hero headline" : `Provided ${name} copy`
          }
        ]
      };
    })
  };
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
  assert.equal(pipelineReport.intake.analysisPlanSource, "seeded");
  assert.equal(pipelineReport.intake.layerCount, 18);
  assert.equal(pipelineReport.verification.passed, true);
  assert.equal(pipelineReport.verification.scores.visualSimilarity, 100);
  assert.equal(pipelineReport.project.referencePath, join(outputDir, "project", "reference.png"));
  assert.deepEqual(pipelineReport.project.copiedAssets.sort(), ["assets/hero-crop.png", "public/assets/hero-crop.png"]);
  assert.equal(projectManifest.scores.visualSimilarity, 100);
  assert.match(readFileSync(join(outputDir, "project", "src", "ProductionHomepage.tsx"), "utf8"), /Pipeline Homepage|Imported hero headline/);
});

test("homepage pipeline CLI can build from a provided analysis plan", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-homepage-provided-plan-"));
  const inputPath = join(directory, "homepage.png");
  const candidatePath = join(directory, "candidate.png");
  const analysisPlanPath = join(directory, "analysis-plan.json");
  const outputDir = join(directory, "run");
  writeHomepagePng(inputPath);
  writeHomepagePng(candidatePath);
  writeFileSync(analysisPlanPath, JSON.stringify(createExternalAnalysisPlan(), null, 2));

  const result = spawnSync(process.execPath, [
    cliPath,
    "--input",
    inputPath,
    "--candidate",
    candidatePath,
    "--analysis-plan",
    analysisPlanPath,
    "--out",
    outputDir,
    "--component",
    "ProductionHomepage"
  ], { cwd: rootDir, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  const pipelineReport = JSON.parse(readFileSync(join(outputDir, "pipeline-report.json"), "utf8"));
  const layerDoc = JSON.parse(readFileSync(join(outputDir, "intake", "layerdoc.json"), "utf8"));
  const exportedComponent = readFileSync(join(outputDir, "project", "src", "ProductionHomepage.tsx"), "utf8");

  assert.equal(pipelineReport.name, "Provided Plan Homepage");
  assert.equal(pipelineReport.intake.analysisPlanSource, "provided");
  assert.equal(pipelineReport.intake.sourceAnalysisPlanPath, analysisPlanPath);
  assert.equal(pipelineReport.intake.sectionCount, 8);
  assert.equal(pipelineReport.intake.layerCount, 8);
  assert.equal(pipelineReport.intake.analysisPlanAudit.readiness.readyForLayerDoc, true);
  assert.deepEqual(pipelineReport.intake.analysisPlanAudit.tracks, {
    component: 8,
    asset: 0,
    approximation: 0,
    layout: 0
  });
  assert.deepEqual(layerDoc.metadata.analysisPlan, {
    source: "provided",
    name: "Provided Plan Homepage",
    sectionCount: 8,
    layerCount: 8,
    uri: analysisPlanPath
  });
  assert.deepEqual(layerDoc.metadata.analysisPlanAudit, pipelineReport.intake.analysisPlanAudit);
  assert.equal(layerDoc.layers.some((layer) => layer.id === "hero-copy" && layer.content.text === "Provided hero headline"), true);
  assert.match(exportedComponent, /Provided hero headline/);
});

test("homepage pipeline CLI rejects provided analysis plans for a different PNG canvas", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-homepage-plan-canvas-mismatch-"));
  const inputPath = join(directory, "homepage.png");
  const candidatePath = join(directory, "candidate.png");
  const analysisPlanPath = join(directory, "analysis-plan.json");
  const outputDir = join(directory, "run");
  const analysisPlan = createExternalAnalysisPlan();
  analysisPlan.canvas.width = 800;
  writeHomepagePng(inputPath);
  writeHomepagePng(candidatePath);
  writeFileSync(analysisPlanPath, JSON.stringify(analysisPlan, null, 2));

  const result = spawnSync(process.execPath, [
    cliPath,
    "--input",
    inputPath,
    "--candidate",
    candidatePath,
    "--analysis-plan",
    analysisPlanPath,
    "--out",
    outputDir,
    "--component",
    "ProductionHomepage"
  ], { cwd: rootDir, encoding: "utf8" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Analysis Plan canvas 800x960 must match source PNG 640x960/);
});

test("homepage pipeline CLI rejects malformed analysis plan JSON with stable guidance", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-homepage-plan-malformed-"));
  const inputPath = join(directory, "homepage.png");
  const candidatePath = join(directory, "candidate.png");
  const analysisPlanPath = join(directory, "analysis-plan.json");
  const outputDir = join(directory, "run");
  writeHomepagePng(inputPath);
  writeHomepagePng(candidatePath);
  writeFileSync(analysisPlanPath, JSON.stringify({
    name: "Malformed plan",
    canvas: { width: 640, height: 960 },
    sections: [{ id: "hero", name: "Hero" }]
  }, null, 2));

  const result = spawnSync(process.execPath, [
    cliPath,
    "--input",
    inputPath,
    "--candidate",
    candidatePath,
    "--analysis-plan",
    analysisPlanPath,
    "--out",
    outputDir,
    "--component",
    "ProductionHomepage"
  ], { cwd: rootDir, encoding: "utf8" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Input file is not a Homepage Analysis Plan/);
});

test("homepage pipeline CLI rejects missing required arguments with usage guidance", () => {
  const result = spawnSync(process.execPath, [cliPath], { cwd: rootDir, encoding: "utf8" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage: layerdoc-run-homepage/);
  assert.match(result.stderr, /--input <homepage.png>/);
  assert.match(result.stderr, /--out <directory>/);
  assert.match(result.stderr, /--component <ComponentName>/);
});
