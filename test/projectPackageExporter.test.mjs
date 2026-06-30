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
  createVerificationReport,
  writeProjectExportPackage
} from "../dist/index.js";

function createExportDoc() {
  return createLayerDoc({
    name: "Production Homepage",
    canvas: { width: 1440, height: 900, background: "#ffffff" },
    sections: [{ id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 1440, height: 900 }, layerIds: ["headline", "cta"] }],
    components: [{ id: "HeroSection", layerIds: ["headline", "cta"], exportable: true }],
    layers: [
      {
        id: "headline",
        sectionId: "hero",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 120, y: 120, width: 620, height: 96 },
        content: { text: "LayerDoc first" }
      },
      {
        id: "cta",
        sectionId: "hero",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 120, y: 260, width: 180, height: 48 },
        content: { text: "Export React" }
      }
    ]
  });
}

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

test("createProjectExportPackage returns project-ready files derived from one LayerDoc", () => {
  const doc = createExportDoc();
  const output = createProjectExportPackage(doc, { componentName: "ProductionHomepage" });
  const paths = output.files.map((file) => file.path).sort();

  assert.equal(output.manifest.packageName, "production-homepage");
  assert.equal(output.manifest.componentName, "ProductionHomepage");
  assert.deepEqual(paths, [
    "README.md",
    "index.html",
    "layerdoc-audit.json",
    "layerdoc.schema.json",
    "layerdoc.json",
    "manifest.json",
    "package.json",
    "preview.html",
    "quality-gates.json",
    "scripts/verify-gates.mjs",
    "scripts/verify-layerdoc.mjs",
    "scripts/verify-preview.mjs",
    "src/App.tsx",
    "src/index.css",
    "src/main.tsx",
    "src/ProductionHomepage.tsx",
    "tsconfig.json",
    "verification-report.json",
    "vite.config.ts"
  ].sort());
  assert.deepEqual(output.manifest.files.sort(), paths);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"scripts"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"dev": "vite"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"verify:preview": "node scripts\/verify-preview\.mjs"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"verify:gates": "node scripts\/verify-gates\.mjs"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"verify:layerdoc": "node scripts\/verify-layerdoc\.mjs"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"playwright"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"pixelmatch"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"pngjs"/);
  assert.match(output.files.find((file) => file.path === "src\/main.tsx").contents, /createRoot/);
  assert.match(output.files.find((file) => file.path === "src\/App.tsx").contents, /<ProductionHomepage \/>/);
  assert.match(output.files.find((file) => file.path === "src\/index.css").contents, /@import "tailwindcss"/);
  assert.match(output.files.find((file) => file.path === "vite.config.ts").contents, /@vitejs\/plugin-react/);
  assert.match(output.files.find((file) => file.path === "tsconfig.json").contents, /"jsx": "react-jsx"/);
  assert.match(output.files.find((file) => file.path === "src/ProductionHomepage.tsx").contents, /export function ProductionHomepage/);
  assert.match(output.files.find((file) => file.path === "layerdoc.json").contents, /"schema": "layerdoc"/);
  assert.equal(JSON.parse(output.files.find((file) => file.path === "layerdoc.schema.json").contents).properties.schema.const, "layerdoc");
  assert.match(output.files.find((file) => file.path === "layerdoc-audit.json").contents, /"assetCompliance"/);
  assert.match(output.files.find((file) => file.path === "verification-report.json").contents, /"structureScore": 100/);
  assert.match(output.files.find((file) => file.path === "verification-report.json").contents, /"evidence"/);
  assert.match(output.files.find((file) => file.path === "quality-gates.json").contents, /"visualSimilarity": 85/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-gates.mjs").contents, /verification-report\.json/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-layerdoc.mjs").contents, /layerdoc\.json/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-preview.mjs").contents, /preview\.html/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-preview.mjs").contents, /verification-report\.json/);
  assert.match(output.files.find((file) => file.path === "preview.html").contents, /data-layerdoc="0.1.0"/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm install/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run dev/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run verify:gates/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run verify:layerdoc/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run verify:preview -- --reference/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /layerdoc\.schema\.json/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /visual_evidence:/);
});

test("writeProjectExportPackage writes every package file under the target directory", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-export-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });

  const written = writeProjectExportPackage(output, directory);

  assert.equal(written.files.length, 19);
  assert.equal(existsSync(join(directory, "src", "ProductionHomepage.tsx")), true);
  assert.equal(existsSync(join(directory, "layerdoc-audit.json")), true);
  assert.equal(existsSync(join(directory, "layerdoc.schema.json")), true);
  assert.equal(existsSync(join(directory, "src", "main.tsx")), true);
  assert.equal(existsSync(join(directory, "package.json")), true);
  assert.equal(existsSync(join(directory, "vite.config.ts")), true);
  assert.equal(existsSync(join(directory, "scripts", "verify-gates.mjs")), true);
  assert.equal(existsSync(join(directory, "scripts", "verify-layerdoc.mjs")), true);
  assert.equal(existsSync(join(directory, "scripts", "verify-preview.mjs")), true);
  assert.equal(existsSync(join(directory, "verification-report.json")), true);
  assert.equal(existsSync(join(directory, "quality-gates.json")), true);
  assert.equal(existsSync(join(directory, "manifest.json")), true);
  assert.match(readFileSync(join(directory, "src", "ProductionHomepage.tsx"), "utf8"), /LayerDoc first/);
  assert.match(readFileSync(join(directory, "src", "App.tsx"), "utf8"), /ProductionHomepage/);
  assert.deepEqual(
    written.files.map((file) => file.relativePath).sort(),
    output.files.map((file) => file.path).sort()
  );
});

test("exported LayerDoc verifier script validates the editable source graph", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-source-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const passed = spawnSync(process.execPath, ["scripts/verify-layerdoc.mjs"], { cwd: directory, encoding: "utf8" });
  assert.equal(passed.status, 0, passed.stderr);
  assert.match(passed.stdout, /"passed": true/);

  const layerDocPath = join(directory, "layerdoc.json");
  const brokenLayerDoc = JSON.parse(readFileSync(layerDocPath, "utf8"));
  brokenLayerDoc.components[0].layerIds.push("missing-layer");
  writeFileSync(layerDocPath, `${JSON.stringify(brokenLayerDoc, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-layerdoc.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /components\[0\]\.layerIds/);
  assert.match(failed.stdout, /missing-layer/);
});

test("exported preview verifier script updates the handoff report from candidate screenshots", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-preview-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const referencePath = join(directory, "reference.png");
  const candidatePath = join(directory, "candidate.png");
  writeSolidPng(referencePath, 2, 1, [255, 255, 255, 255]);
  writeSolidPng(candidatePath, 2, 1, [255, 255, 255, 255], [{ x: 1, y: 0, color: [15, 23, 42, 255] }]);

  const result = spawnSync(
    process.execPath,
    ["scripts/verify-preview.mjs", "--reference", referencePath, "--candidate", candidatePath, "--out", "verification-artifacts", "--threshold", "0"],
    { cwd: directory, encoding: "utf8", env: { ...process.env, NODE_PATH: join(process.cwd(), "node_modules") } }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"visualSimilarity": 50/);
  assert.equal(existsSync(join(directory, "verification-artifacts", "diff.png")), true);
  const report = JSON.parse(readFileSync(join(directory, "verification-report.json"), "utf8"));
  assert.equal(report.visualSimilarity, 50);
  assert.equal(report.evidence.visual.kind, "html-screenshot");
  assert.equal(report.visualDiff.diffPath, "verification-artifacts/diff.png");
  assert.deepEqual(report.visualDiff.problemAreas, [{ x: 1, y: 0, width: 1, height: 1 }]);
});

test("exported quality gate script passes and fails from project files", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-gates-"));
  const doc = createExportDoc();
  const passingReport = {
    ...createVerificationReport(doc, { visualSimilarity: 96 }),
    projectFitScore: 90
  };
  const output = createProjectExportPackage(doc, {
    componentName: "ProductionHomepage",
    report: passingReport
  });
  writeProjectExportPackage(output, directory);

  const passed = spawnSync(process.execPath, ["scripts/verify-gates.mjs"], { cwd: directory, encoding: "utf8" });
  assert.equal(passed.status, 0, passed.stderr);
  assert.match(passed.stdout, /"passed": true/);

  const reportPath = join(directory, "verification-report.json");
  const failingReport = JSON.parse(readFileSync(reportPath, "utf8"));
  failingReport.visualSimilarity = 74;
  writeFileSync(reportPath, `${JSON.stringify(failingReport, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-gates.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /visual_similarity 74 is below 85/);
});
