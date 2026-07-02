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
    "asset-index.json",
    "handoff-summary.json",
    "index.html",
    "integration-contract.json",
    "layerdoc-audit.json",
    "layerdoc.schema.json",
    "layerdoc.json",
    "manifest.json",
    "package.json",
    "preview.html",
    "production-manifest.json",
    "production-manifest.schema.json",
    "quality-gates.json",
    "scripts/apply-section-candidate.mjs",
    "scripts/verify-analysis-plan.mjs",
    "scripts/verify-contract.mjs",
    "scripts/verify-gates.mjs",
    "scripts/verify-handoff.mjs",
    "scripts/verify-image-manifest.mjs",
    "scripts/verify-layerdoc.mjs",
    "scripts/verify-preview.mjs",
    "scripts/verify-production-manifest.mjs",
    "scripts/verify-section-application.mjs",
    "scripts/verify-section-candidate.mjs",
    "section-candidate.schema.json",
    "src/App.tsx",
    "src/index.css",
    "src/main.tsx",
    "src/ProductionHomepage.tsx",
    "tsconfig.json",
    "verification-report.json",
    "vite.config.ts"
  ].sort());
  assert.equal(existsSync(join(outputDir, "src", "ProductionHomepage.tsx")), true);
  assert.equal(existsSync(join(outputDir, "src", "main.tsx")), true);
  assert.equal(existsSync(join(outputDir, "package.json")), true);
  assert.equal(existsSync(join(outputDir, "vite.config.ts")), true);
  assert.equal(existsSync(join(outputDir, "scripts", "verify-contract.mjs")), true);
  assert.equal(existsSync(join(outputDir, "scripts", "verify-handoff.mjs")), true);
  assert.equal(existsSync(join(outputDir, "scripts", "verify-analysis-plan.mjs")), true);
  assert.equal(existsSync(join(outputDir, "scripts", "verify-image-manifest.mjs")), true);
  assert.equal(existsSync(join(outputDir, "scripts", "verify-gates.mjs")), true);
  assert.equal(existsSync(join(outputDir, "scripts", "verify-layerdoc.mjs")), true);
  assert.equal(existsSync(join(outputDir, "scripts", "verify-preview.mjs")), true);
  assert.equal(existsSync(join(outputDir, "scripts", "verify-production-manifest.mjs")), true);
  assert.equal(existsSync(join(outputDir, "asset-index.json")), true);
  assert.equal(existsSync(join(outputDir, "handoff-summary.json")), true);
  assert.equal(existsSync(join(outputDir, "production-manifest.json")), true);
  assert.equal(existsSync(join(outputDir, "production-manifest.schema.json")), true);
  assert.equal(existsSync(join(outputDir, "integration-contract.json")), true);
  assert.equal(existsSync(join(outputDir, "layerdoc-audit.json")), true);
  assert.equal(existsSync(join(outputDir, "layerdoc.schema.json")), true);
  assert.equal(existsSync(join(outputDir, "verification-report.json")), true);
  assert.equal(existsSync(join(outputDir, "quality-gates.json")), true);
  assert.match(readFileSync(join(outputDir, "src", "ProductionHomepage.tsx"), "utf8"), /Exported from LayerDoc CLI/);
  assert.match(readFileSync(join(outputDir, "src", "App.tsx"), "utf8"), /<ProductionHomepage \/>/);
  assert.match(readFileSync(join(outputDir, "package.json"), "utf8"), /"name": "production-homepage"/);
  assert.match(readFileSync(join(outputDir, "package.json"), "utf8"), /"verify:contract"/);
  assert.match(readFileSync(join(outputDir, "package.json"), "utf8"), /"verify:handoff"/);
  assert.match(readFileSync(join(outputDir, "package.json"), "utf8"), /"verify:analysis-plan"/);
  assert.match(readFileSync(join(outputDir, "package.json"), "utf8"), /"verify:image-manifest"/);
  assert.match(readFileSync(join(outputDir, "package.json"), "utf8"), /"verify:preview"/);
  assert.match(readFileSync(join(outputDir, "package.json"), "utf8"), /"verify:production-manifest"/);
  assert.match(readFileSync(join(outputDir, "package.json"), "utf8"), /"verify:gates"/);
  assert.match(readFileSync(join(outputDir, "package.json"), "utf8"), /"verify:layerdoc"/);
  assert.match(readFileSync(join(outputDir, "production-manifest.json"), "utf8"), /"role": "project_integration_manifest"/);
  assert.match(readFileSync(join(outputDir, "production-manifest.schema.json"), "utf8"), /"title": "ProjectProductionManifest 0.1.0"/);
  assert.match(readFileSync(join(outputDir, "handoff-summary.json"), "utf8"), /"positioning": "AI UI Production System"/);
  assert.match(readFileSync(join(outputDir, "layerdoc-audit.json"), "utf8"), /"assetCompliance"/);
  assert.match(readFileSync(join(outputDir, "layerdoc.schema.json"), "utf8"), /"const": "layerdoc"/);
  assert.match(readFileSync(join(outputDir, "manifest.json"), "utf8"), /"packageName": "production-homepage"/);
  assert.match(readFileSync(join(outputDir, "manifest.json"), "utf8"), /"integrationContract": "integration-contract\.json"/);
  assert.match(readFileSync(join(outputDir, "integration-contract.json"), "utf8"), /"file": "src\/ProductionHomepage\.tsx"/);
});

test("export project CLI rejects missing required arguments with usage guidance", () => {
  const result = spawnSync(process.execPath, [cliPath], { cwd: rootDir, encoding: "utf8" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage: layerdoc-export-project/);
  assert.match(result.stderr, /--input <layerdoc.json>/);
  assert.match(result.stderr, /--out <directory>/);
});
