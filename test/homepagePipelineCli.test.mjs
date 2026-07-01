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
  const projectAnalysisPlan = JSON.parse(readFileSync(join(outputDir, "project", "analysis-plan.json"), "utf8"));
  const projectImageManifest = JSON.parse(readFileSync(join(outputDir, "project", "image-manifest.json"), "utf8"));
  const handoffSummary = JSON.parse(readFileSync(join(outputDir, "project", "handoff-summary.json"), "utf8"));

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
  assert.equal(existsSync(join(outputDir, "project", "analysis-plan.json")), true);
  assert.equal(existsSync(join(outputDir, "project", "image-manifest.json")), true);
  assert.equal(existsSync(join(outputDir, "project", "analysis-plan.schema.json")), true);
  assert.equal(existsSync(join(outputDir, "project", "analysis-plan-audit.json")), true);
  assert.equal(existsSync(join(outputDir, "project", "scripts", "verify-handoff.mjs")), true);
  assert.equal(existsSync(join(outputDir, "project", "scripts", "verify-image-manifest.mjs")), true);
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
  assert.equal(projectManifest.analysisPlanFile, "analysis-plan.json");
  assert.equal(projectManifest.imageManifestFile, "image-manifest.json");
  assert.equal(projectManifest.analysisPlanSchema, "analysis-plan.schema.json");
  assert.equal(projectManifest.analysisPlanAuditFile, "analysis-plan-audit.json");
  assert.equal(projectManifest.files.includes("reference.png"), true);
  assert.deepEqual([...readFileSync(join(outputDir, "project", "reference.png"))], [...readFileSync(inputPath)]);
  assert.equal(handoffSummary.sourceImageManifestFile, "image-manifest.json");
  assert.deepEqual(handoffSummary.sourceAnalysisPlanFiles, {
    planFile: "analysis-plan.json",
    schemaFile: "analysis-plan.schema.json",
    auditFile: "analysis-plan-audit.json"
  });
  assert.equal(projectAnalysisPlan.name, "Pipeline Homepage");
  assert.equal(projectAnalysisPlan.sections.length, 8);
  assert.equal(projectAnalysisPlan.sections.reduce((total, section) => total + section.layers.length, 0), 18);
  assert.equal(projectImageManifest.name, "Pipeline Homepage");
  assert.equal(projectImageManifest.sourceImage.width, 640);
  assert.equal(projectImageManifest.sourceImage.height, 960);
  assert.equal(projectImageManifest.sections.length, 8);
  assert.equal(projectImageManifest.sections.reduce((total, section) => total + section.layers.length, 0), 18);
  assert.equal(projectManifest.scores.visualSimilarity, 100);
  const analysisPlanVerification = spawnSync(process.execPath, ["scripts/verify-analysis-plan.mjs"], {
    cwd: join(outputDir, "project"),
    encoding: "utf8"
  });
  assert.equal(analysisPlanVerification.status, 0, analysisPlanVerification.stderr);
  assert.match(analysisPlanVerification.stdout, /"passed": true/);
  const handoffVerification = spawnSync(process.execPath, ["scripts/verify-handoff.mjs"], {
    cwd: join(outputDir, "project"),
    encoding: "utf8"
  });
  assert.equal(handoffVerification.status, 0, handoffVerification.stderr);
  assert.match(handoffVerification.stdout, /"passed": true/);
  const imageManifestVerification = spawnSync(process.execPath, ["scripts/verify-image-manifest.mjs"], {
    cwd: join(outputDir, "project"),
    encoding: "utf8"
  });
  assert.equal(imageManifestVerification.status, 0, imageManifestVerification.stderr);
  assert.match(imageManifestVerification.stdout, /"passed": true/);
  assert.match(readFileSync(join(outputDir, "project", "src", "ProductionHomepage.tsx"), "utf8"), /Pipeline Homepage|Imported hero headline/);
});

test("homepage pipeline CLI can verify the exported project handoff", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-homepage-project-verification-"));
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
    "--component",
    "ProductionHomepage",
    "--verify-project"
  ], { cwd: rootDir, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  const pipelineReport = JSON.parse(readFileSync(join(outputDir, "pipeline-report.json"), "utf8"));
  const projectReport = JSON.parse(readFileSync(join(outputDir, "project", "verification-report.json"), "utf8"));

  assert.deepEqual(summary.projectVerification, {
    mode: "preview",
    passed: true
  });
  assert.equal(pipelineReport.project.verification.mode, "preview");
  assert.deepEqual(
    pipelineReport.project.verification.results.map((entry) => entry.command),
    [
      `node scripts/verify-preview.mjs --candidate ${candidatePath}`,
      "node scripts/verify-handoff.mjs",
      "node scripts/verify-analysis-plan.mjs",
      "node scripts/verify-image-manifest.mjs",
      "node scripts/verify-layerdoc.mjs",
      "node scripts/verify-contract.mjs",
      "node scripts/verify-gates.mjs"
    ]
  );
  assert.equal(pipelineReport.project.verification.results.every((entry) => entry.status === 0), true);
  assert.equal(pipelineReport.project.verification.results[0].result.visualSimilarity, 100);
  assert.equal(projectReport.visualSimilarity, 100);
  assert.equal(projectReport.evidence.visual.kind, "html-screenshot");
  assert.equal(existsSync(join(outputDir, "project", "verification-artifacts", "diff.png")), true);
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
