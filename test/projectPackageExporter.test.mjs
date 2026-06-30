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

test("project package exporter stays browser-compatible for Studio exports", () => {
  const source = readFileSync(join(process.cwd(), "src", "exporters", "projectPackage.ts"), "utf8");

  assert.doesNotMatch(source, /^import .*node:crypto/m);
});

function createExportDoc() {
  return createLayerDoc({
    name: "Production Homepage",
    canvas: { width: 1440, height: 900, background: "#ffffff" },
    sections: [{ id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 1440, height: 900 }, layerIds: ["headline", "cta"] }],
    components: [{ id: "HeroSection", layerIds: ["headline", "cta"], exportable: true }],
    responsive: {
      rules: [
        {
          id: "mobile-cta",
          query: "(max-width: 640px)",
          target: { type: "layer", id: "cta" },
          changes: { bounds: { x: 24, y: 340, width: 280, height: 52 } }
        }
      ]
    },
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
  assert.match(output.manifest.layerDocHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(output.manifest.integrationContract, "integration-contract.json");
  assert.deepEqual(paths, [
    "README.md",
    "index.html",
    "integration-contract.json",
    "layerdoc-audit.json",
    "layerdoc.schema.json",
    "layerdoc.json",
    "manifest.json",
    "package.json",
    "preview.html",
    "quality-gates.json",
    "scripts/verify-contract.mjs",
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
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"verify:contract": "node scripts\/verify-contract\.mjs"/);
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
  const contract = JSON.parse(output.files.find((file) => file.path === "integration-contract.json").contents);
  assert.equal(contract.component.name, "ProductionHomepage");
  assert.equal(contract.component.file, "src/ProductionHomepage.tsx");
  assert.equal(contract.layerDoc.file, "layerdoc.json");
  assert.equal(contract.layerDoc.hash, output.manifest.layerDocHash);
  assert.deepEqual(contract.sections[0], {
    id: "hero",
    name: "Hero",
    selector: '[data-section-id="hero"]',
    layerIds: ["headline", "cta"]
  });
  assert.deepEqual(contract.layers.find((layer) => layer.id === "headline"), {
    id: "headline",
    kind: "text",
    track: "component",
    editable: true,
    sectionId: "hero",
    componentIds: ["HeroSection"],
    assetId: null,
    selector: '[data-layer-id="headline"]',
    interactionIds: []
  });
  assert.deepEqual(contract.components[0], {
    id: "HeroSection",
    exportable: true,
    selector: '[data-component-id="HeroSection"]',
    layerIds: ["headline", "cta"]
  });
  assert.deepEqual(contract.responsiveRules[0], {
    id: "mobile-cta",
    query: "(max-width: 640px)",
    target: { type: "layer", id: "cta" },
    selector: '[data-layer-id="cta"]',
    changes: { bounds: { x: 24, y: 340, width: 280, height: 52 } }
  });
  const layerDocSchema = JSON.parse(output.files.find((file) => file.path === "layerdoc.schema.json").contents);
  assert.equal(layerDocSchema.properties.schema.const, "layerdoc");
  assert.equal(
    layerDocSchema.properties.verification.properties.issues.items.properties.code.enum.includes("section_empty"),
    true
  );
  assert.equal(
    layerDocSchema.properties.verification.properties.issues.items.properties.code.enum.includes("layer_section_mismatch"),
    true
  );
  assert.equal(
    layerDocSchema.properties.verification.properties.issues.items.properties.code.enum.includes("responsive_target_missing"),
    true
  );
  assert.equal(layerDocSchema.properties.responsive.properties.rules.items.required.includes("target"), true);
  assert.deepEqual(layerDocSchema.properties.responsive.properties.rules.items.properties.target.properties.type.enum, [
    "section",
    "layer",
    "component"
  ]);
  assert.match(output.files.find((file) => file.path === "layerdoc-audit.json").contents, /"assetCompliance"/);
  assert.match(output.files.find((file) => file.path === "verification-report.json").contents, /"structureScore": 100/);
  assert.match(output.files.find((file) => file.path === "verification-report.json").contents, /"evidence"/);
  assert.match(output.files.find((file) => file.path === "quality-gates.json").contents, /"visualSimilarity": 85/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-gates.mjs").contents, /verification-report\.json/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-contract.mjs").contents, /integration-contract\.json/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-layerdoc.mjs").contents, /layerdoc\.json/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-preview.mjs").contents, /preview\.html/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-preview.mjs").contents, /verification-report\.json/);
  assert.match(output.files.find((file) => file.path === "preview.html").contents, /data-layerdoc="0.1.0"/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm install/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run dev/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run verify:gates/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run verify:contract/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run verify:layerdoc/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run verify:preview -- --reference/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /integration-contract\.json/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /layerdoc\.schema\.json/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /visual_evidence:/);
});

test("writeProjectExportPackage writes every package file under the target directory", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-export-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });

  const written = writeProjectExportPackage(output, directory);

  assert.equal(written.files.length, 21);
  assert.equal(existsSync(join(directory, "src", "ProductionHomepage.tsx")), true);
  assert.equal(existsSync(join(directory, "integration-contract.json")), true);
  assert.equal(existsSync(join(directory, "layerdoc-audit.json")), true);
  assert.equal(existsSync(join(directory, "layerdoc.schema.json")), true);
  assert.equal(existsSync(join(directory, "src", "main.tsx")), true);
  assert.equal(existsSync(join(directory, "package.json")), true);
  assert.equal(existsSync(join(directory, "vite.config.ts")), true);
  assert.equal(existsSync(join(directory, "scripts", "verify-gates.mjs")), true);
  assert.equal(existsSync(join(directory, "scripts", "verify-contract.mjs")), true);
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

test("exported integration contract verifier validates the handoff mapping", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-contract-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const passed = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.equal(passed.status, 0, passed.stderr);
  assert.match(passed.stdout, /"passed": true/);

  const contractPath = join(directory, "integration-contract.json");
  const staleContract = JSON.parse(readFileSync(contractPath, "utf8"));
  staleContract.layers[0].selector = '[data-layer-id="stale-headline"]';
  writeFileSync(contractPath, `${JSON.stringify(staleContract, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /integration_contract_mismatch/);
  assert.match(failed.stdout, /layers/);
  assert.match(failed.stdout, /stale-headline/);
});

test("exported integration contract verifier checks project selectors", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-selector-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const componentPath = join(directory, "src", "ProductionHomepage.tsx");
  const componentSource = readFileSync(componentPath, "utf8");
  writeFileSync(componentPath, componentSource.replace('data-layer-id="headline"', 'data-layer-id="stale-headline"'));

  const failed = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /project_selector_missing/);
  assert.match(failed.stdout, /src\/ProductionHomepage\.tsx/);
  assert.match(failed.stdout, /data-layer-id=\\"headline\\"/);
});

test("exported LayerDoc verifier script validates the editable source graph", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-source-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const passed = spawnSync(process.execPath, ["scripts/verify-layerdoc.mjs"], { cwd: directory, encoding: "utf8" });
  assert.equal(passed.status, 0, passed.stderr);
  assert.match(passed.stdout, /"passed": true/);

  const layerDocPath = join(directory, "layerdoc.json");
  const editedLayerDoc = JSON.parse(readFileSync(layerDocPath, "utf8"));
  editedLayerDoc.layers[0].content.text = "Edited after export";
  writeFileSync(layerDocPath, `${JSON.stringify(editedLayerDoc, null, 2)}\n`);

  const stale = spawnSync(process.execPath, ["scripts/verify-layerdoc.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(stale.status, 0);
  assert.match(stale.stdout, /layerdoc_hash_mismatch/);
  assert.match(stale.stdout, /does not match manifest\.json/);

  const brokenLayerDoc = JSON.parse(readFileSync(layerDocPath, "utf8"));
  brokenLayerDoc.components[0].layerIds.push("missing-layer");
  writeFileSync(layerDocPath, `${JSON.stringify(brokenLayerDoc, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-layerdoc.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /components\[0\]\.layerIds/);
  assert.match(failed.stdout, /missing-layer/);
});

test("exported LayerDoc verifier script rejects visible empty sections", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-empty-section-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const layerDocPath = join(directory, "layerdoc.json");
  const layerDoc = JSON.parse(readFileSync(layerDocPath, "utf8"));
  layerDoc.sections[0].layerIds = [];
  writeFileSync(layerDocPath, `${JSON.stringify(layerDoc, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-layerdoc.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /section_empty/);
  assert.match(failed.stdout, /sections\[0\]\.layerIds/);
});

test("exported LayerDoc verifier script rejects mismatched section membership", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-membership-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const layerDocPath = join(directory, "layerdoc.json");
  const layerDoc = JSON.parse(readFileSync(layerDocPath, "utf8"));
  layerDoc.sections[0].layerIds = ["headline"];
  writeFileSync(layerDocPath, `${JSON.stringify(layerDoc, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-layerdoc.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /layer_section_mismatch/);
  assert.match(failed.stdout, /layers\[1\]\.sectionId/);
});

test("exported LayerDoc verifier script rejects missing responsive rule targets", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-responsive-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const layerDocPath = join(directory, "layerdoc.json");
  const layerDoc = JSON.parse(readFileSync(layerDocPath, "utf8"));
  layerDoc.responsive.rules = [
    {
      id: "mobile-cta",
      query: "(max-width: 640px)",
      target: { type: "layer", id: "missing-cta" },
      changes: { bounds: { width: 280 } }
    }
  ];
  writeFileSync(layerDocPath, `${JSON.stringify(layerDoc, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-layerdoc.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /responsive_target_missing/);
  assert.match(failed.stdout, /responsive\.rules\[0\]\.target\.id/);
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
