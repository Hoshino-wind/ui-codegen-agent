import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { PNG } from "pngjs";

import {
  createLayerDoc,
  createProjectExportPackage,
  createVerificationReport
} from "../dist/index.js";

const rootDir = process.cwd();
const cliPath = join(rootDir, "dist", "cli", "materializeProjectPackage.js");

function createCliDoc() {
  return createLayerDoc({
    name: "Studio JSON Handoff",
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
        content: { text: "Materialized from Studio JSON" }
      },
      {
        id: "cta",
        sectionId: "hero",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 96, y: 256, width: 220, height: 56 },
        content: { text: "Run package" }
      }
    ]
  });
}

function projectPackageJson(packageOutput) {
  return {
    ...packageOutput,
    files: packageOutput.files.map((file) =>
      typeof file.contents === "string"
        ? file
        : {
            path: file.path,
            contentEncoding: "base64",
            contentsBase64: Buffer.from(file.contents).toString("base64")
          }
    )
  };
}

function solidPngBytes(width, height, color) {
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

  return PNG.sync.write(png);
}

test("materialize project package CLI writes a runnable project from Studio JSON handoff", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-cli-materialize-"));
  const inputPath = join(directory, "project-package.json");
  const outputDir = join(directory, "materialized-project");
  const referencePng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
  const projectPackage = createProjectExportPackage(createCliDoc(), {
    componentName: "ProductionHomepage",
    packageName: "studio-json-handoff",
    referencePng
  });
  writeFileSync(inputPath, `${JSON.stringify(projectPackageJson(projectPackage), null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    cliPath,
    "--input",
    inputPath,
    "--out",
    outputDir
  ], { cwd: rootDir, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);

  assert.equal(summary.packageName, "studio-json-handoff");
  assert.equal(summary.componentName, "ProductionHomepage");
  assert.equal(summary.rootDir, outputDir);
  assert.equal(summary.files.includes("reference.png"), true);
  assert.equal(existsSync(join(outputDir, "src", "ProductionHomepage.tsx")), true);
  assert.equal(existsSync(join(outputDir, "scripts", "verify-handoff.mjs")), true);
  assert.match(readFileSync(join(outputDir, "src", "ProductionHomepage.tsx"), "utf8"), /Materialized from Studio JSON/);
  assert.deepEqual([...readFileSync(join(outputDir, "reference.png"))], [...referencePng]);
});

test("materialize project package CLI can verify the written handoff", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-cli-materialize-verify-"));
  const inputPath = join(directory, "project-package.json");
  const outputDir = join(directory, "materialized-project");
  const projectPackage = createProjectExportPackage(createCliDoc(), {
    componentName: "ProductionHomepage",
    packageName: "studio-json-handoff"
  });
  writeFileSync(inputPath, `${JSON.stringify(projectPackageJson(projectPackage), null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    cliPath,
    "--input",
    inputPath,
    "--out",
    outputDir,
    "--verify-handoff"
  ], { cwd: rootDir, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);

  assert.equal(summary.verification.command, "node scripts/verify-handoff.mjs");
  assert.equal(summary.verification.status, 0);
  assert.equal(summary.verification.result.passed, true);
});

test("materialize project package CLI can verify the written structure chain", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-cli-materialize-structure-"));
  const inputPath = join(directory, "project-package.json");
  const outputDir = join(directory, "materialized-project");
  const projectPackage = createProjectExportPackage(createCliDoc(), {
    componentName: "ProductionHomepage",
    packageName: "studio-json-handoff"
  });
  writeFileSync(inputPath, `${JSON.stringify(projectPackageJson(projectPackage), null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    cliPath,
    "--input",
    inputPath,
    "--out",
    outputDir,
    "--verify-structure"
  ], { cwd: rootDir, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);

  assert.equal(summary.verification.mode, "structure");
  assert.deepEqual(
    summary.verification.results.map((entry) => entry.command),
    [
      "node scripts/verify-handoff.mjs",
      "node scripts/verify-analysis-plan.mjs",
      "node scripts/verify-image-manifest.mjs",
      "node scripts/verify-layerdoc.mjs",
      "node scripts/verify-contract.mjs"
    ]
  );
  assert.equal(summary.verification.results.every((entry) => entry.status === 0), true);
  assert.equal(summary.verification.results.every((entry) => entry.result.passed === true), true);
});

test("materialize project package CLI can verify the written quality gates", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-cli-materialize-quality-"));
  const inputPath = join(directory, "project-package.json");
  const outputDir = join(directory, "materialized-project");
  const doc = createCliDoc();
  const report = {
    ...createVerificationReport(doc, { visualSimilarity: 96 }),
    projectFitScore: 95
  };
  const projectPackage = createProjectExportPackage(doc, {
    componentName: "ProductionHomepage",
    packageName: "studio-json-handoff",
    report
  });
  writeFileSync(inputPath, `${JSON.stringify(projectPackageJson(projectPackage), null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    cliPath,
    "--input",
    inputPath,
    "--out",
    outputDir,
    "--verify-quality"
  ], { cwd: rootDir, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);

  assert.equal(summary.verification.mode, "quality");
  assert.deepEqual(
    summary.verification.results.map((entry) => entry.command),
    [
      "node scripts/verify-handoff.mjs",
      "node scripts/verify-analysis-plan.mjs",
      "node scripts/verify-image-manifest.mjs",
      "node scripts/verify-layerdoc.mjs",
      "node scripts/verify-contract.mjs",
      "node scripts/verify-gates.mjs"
    ]
  );
  assert.equal(summary.verification.results.every((entry) => entry.status === 0), true);
  assert.equal(summary.verification.results.at(-1).result.passed, true);
});

test("materialize project package CLI can verify preview diff from a candidate PNG", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-cli-materialize-preview-"));
  const inputPath = join(directory, "project-package.json");
  const outputDir = join(directory, "materialized-project");
  const candidatePath = join(directory, "candidate.png");
  const doc = createCliDoc();
  const report = {
    ...createVerificationReport(doc, { visualSimilarity: 92 }),
    projectFitScore: 95
  };
  const referencePng = solidPngBytes(2, 1, [255, 255, 255, 255]);
  const projectPackage = createProjectExportPackage(doc, {
    componentName: "ProductionHomepage",
    packageName: "studio-json-handoff",
    report,
    referencePng
  });
  writeFileSync(candidatePath, solidPngBytes(2, 1, [255, 255, 255, 255]));
  writeFileSync(inputPath, `${JSON.stringify(projectPackageJson(projectPackage), null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    cliPath,
    "--input",
    inputPath,
    "--out",
    outputDir,
    "--verify-preview",
    "--candidate",
    candidatePath
  ], { cwd: rootDir, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  const verificationReport = JSON.parse(readFileSync(join(outputDir, "verification-report.json"), "utf8"));

  assert.equal(summary.verification.mode, "preview");
  assert.match(summary.verification.results[0].command, /^node scripts\/verify-preview\.mjs --candidate /);
  assert.deepEqual(
    summary.verification.results.slice(1).map((entry) => entry.command),
    [
      "node scripts/verify-handoff.mjs",
      "node scripts/verify-analysis-plan.mjs",
      "node scripts/verify-image-manifest.mjs",
      "node scripts/verify-layerdoc.mjs",
      "node scripts/verify-contract.mjs",
      "node scripts/verify-gates.mjs"
    ]
  );
  assert.equal(summary.verification.results.every((entry) => entry.status === 0), true);
  assert.equal(summary.verification.results[0].result.visualSimilarity, 100);
  assert.equal(verificationReport.visualSimilarity, 100);
  assert.equal(verificationReport.evidence.visual.kind, "html-screenshot");
  assert.equal(existsSync(join(outputDir, "verification-artifacts", "diff.png")), true);
});

test("materialize project package CLI rejects missing required arguments with usage guidance", () => {
  const result = spawnSync(process.execPath, [cliPath], { cwd: rootDir, encoding: "utf8" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage: layerdoc-materialize-project/);
  assert.match(result.stderr, /--input <project-package.json>/);
  assert.match(result.stderr, /--out <directory>/);
});
