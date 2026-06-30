import assert from "node:assert/strict";
import test from "node:test";

import {
  createAnalysisPlanDownload,
  createLayerDocDownload,
  createProjectPackageDownload,
  createProjectPackageZipDownload,
  createReactExportDownload,
  createVerificationReportDownload,
  createWorkspaceFromLayerDocJson
} from "../dist/app/layerDocFile.js";
import { applyWorkspaceVisualDiff } from "../dist/app/editorWorkspace.js";
import { createSampleHomepageLayerDoc } from "../dist/app/sampleDocument.js";
import { createHomepageAnalysisPlan } from "../dist/index.js";

function readUInt16LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUInt32LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function zipCentralDirectoryNames(bytes) {
  const decoder = new TextDecoder();
  let eocdOffset = -1;
  for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
    if (readUInt32LE(bytes, offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  assert.notEqual(eocdOffset, -1, "ZIP end-of-central-directory record was not found.");

  const entryCount = readUInt16LE(bytes, eocdOffset + 10);
  let offset = readUInt32LE(bytes, eocdOffset + 16);
  const names = [];

  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(readUInt32LE(bytes, offset), 0x02014b50);
    const fileNameLength = readUInt16LE(bytes, offset + 28);
    const extraLength = readUInt16LE(bytes, offset + 30);
    const commentLength = readUInt16LE(bytes, offset + 32);
    const nameStart = offset + 46;
    names.push(decoder.decode(bytes.slice(nameStart, nameStart + fileNameLength)));
    offset = nameStart + fileNameLength + extraLength + commentLength;
  }

  return names;
}

test("createWorkspaceFromLayerDocJson imports a valid LayerDoc into the editor workspace", () => {
  const doc = createSampleHomepageLayerDoc();
  const workspace = createWorkspaceFromLayerDocJson(JSON.stringify(doc));

  assert.equal(workspace.doc.metadata.name, doc.metadata.name);
  assert.equal(workspace.doc.layers.length, doc.layers.length);
  assert.equal(workspace.selectedLayerId, "hero-title");
  assert.match(workspace.previewHtml, /data-layer-id="hero-title"/);
  assert.match(workspace.reactExport.code, /export function ProductionHomepage/);
});

test("createWorkspaceFromLayerDocJson normalizes older LayerDoc JSON without generation state", () => {
  const doc = createSampleHomepageLayerDoc();
  delete doc.generation;

  const workspace = createWorkspaceFromLayerDocJson(JSON.stringify(doc));

  assert.deepEqual(workspace.doc.generation.sectionRequests, []);
});

test("createWorkspaceFromLayerDocJson rejects malformed or invalid LayerDoc JSON", () => {
  assert.throws(() => createWorkspaceFromLayerDocJson("{bad json"), /LayerDoc JSON could not be parsed/);
  assert.throws(() => createWorkspaceFromLayerDocJson(JSON.stringify({ schema: "html" })), /Input file is not a LayerDoc 0.1.0 document/);

  const invalid = createSampleHomepageLayerDoc();
  invalid.layers[0] = {
    ...invalid.layers[0],
    bounds: { ...invalid.layers[0].bounds, width: -1 }
  };
  assert.throws(() => createWorkspaceFromLayerDocJson(JSON.stringify(invalid)), /LayerDoc validation failed/);
});

test("createLayerDocDownload serializes the current editable LayerDoc as a stable JSON artifact", () => {
  const doc = createSampleHomepageLayerDoc();
  const artifact = createLayerDocDownload(doc);
  const parsed = JSON.parse(artifact.contents);

  assert.equal(artifact.fileName, "layerdoc.json");
  assert.equal(artifact.mimeType, "application/json");
  assert.equal(parsed.schema, "layerdoc");
  assert.equal(parsed.layers.length, doc.layers.length);
  assert.match(artifact.contents, /"schema": "layerdoc"/);
  assert.equal(artifact.contents.endsWith("\n"), true);
});

test("createLayerDocDownload serializes verifier scores stored on the current LayerDoc", () => {
  const workspace = createWorkspaceFromLayerDocJson(JSON.stringify(createSampleHomepageLayerDoc()));
  const verified = applyWorkspaceVisualDiff(workspace, {
    visualSimilarity: 88.25,
    mismatchedPixels: 47,
    comparedPixels: 1000,
    dimensions: { width: 1440, height: 1760 },
    mismatchBounds: { x: 20, y: 30, width: 12, height: 18 },
    problemAreas: [{ x: 20, y: 30, width: 12, height: 18 }],
    diffPath: "verification-artifacts/diff.png",
    threshold: 0.1
  });

  const artifact = createLayerDocDownload(verified.doc);
  const parsed = JSON.parse(artifact.contents);

  assert.equal(parsed.verification.scores.visualSimilarity, 88.25);
  assert.equal(parsed.verification.scores.structureScore, verified.report.structureScore);
  assert.deepEqual(parsed.verification.issues, verified.report.issues);
});

test("createAnalysisPlanDownload serializes the current structured intake plan", () => {
  const plan = createHomepageAnalysisPlan({
    name: "Marked homepage",
    canvas: { width: 640, height: 960 }
  });

  const artifact = createAnalysisPlanDownload(plan);
  const parsed = JSON.parse(artifact.contents);

  assert.equal(artifact.fileName, "analysis-plan.json");
  assert.equal(artifact.mimeType, "application/json");
  assert.equal(parsed.name, "Marked homepage");
  assert.equal(parsed.canvas.width, 640);
  assert.equal(parsed.sections.length, 8);
  assert.equal(artifact.contents.endsWith("\n"), true);
});

test("createReactExportDownload serializes the current React Tailwind export as a TSX artifact", () => {
  const workspace = createWorkspaceFromLayerDocJson(JSON.stringify(createSampleHomepageLayerDoc()));
  const artifact = createReactExportDownload(workspace);

  assert.equal(artifact.fileName, "ProductionHomepage.tsx");
  assert.equal(artifact.mimeType, "text/plain;charset=utf-8");
  assert.match(artifact.contents, /export function ProductionHomepage/);
  assert.match(artifact.contents, /data-layerdoc-version/);
  assert.equal(artifact.contents.endsWith("\n"), true);
});

test("createProjectPackageDownload serializes every project package file in one handoff artifact", () => {
  const workspace = createWorkspaceFromLayerDocJson(JSON.stringify(createSampleHomepageLayerDoc()));
  const artifact = createProjectPackageDownload(workspace);
  const payload = JSON.parse(artifact.contents);

  assert.equal(artifact.fileName, "project-package.json");
  assert.equal(artifact.mimeType, "application/json");
  assert.equal(payload.manifest.source, "layerdoc");
  assert.deepEqual(
    payload.files.map((file) => file.path).sort(),
    [
      "README.md",
      "handoff-summary.json",
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
    ].sort()
  );
  assert.match(
    payload.files.find((file) => file.path === "handoff-summary.json").contents,
    /"source": "layerdoc"/
  );
  assert.equal(payload.manifest.integrationContract, "integration-contract.json");
  assert.match(payload.files.find((file) => file.path === "integration-contract.json").contents, /"rootSelector": "\[data-layerdoc-version=/);
  assert.match(payload.files.find((file) => file.path === "package.json").contents, /"dev": "vite"/);
  assert.match(payload.files.find((file) => file.path === "package.json").contents, /"verify:contract"/);
  assert.match(payload.files.find((file) => file.path === "package.json").contents, /"verify:preview"/);
  assert.match(payload.files.find((file) => file.path === "package.json").contents, /"verify:gates"/);
  assert.match(payload.files.find((file) => file.path === "layerdoc-audit.json").contents, /"assetCompliance"/);
  assert.match(payload.files.find((file) => file.path === "src/main.tsx").contents, /createRoot/);
  assert.match(payload.files.find((file) => file.path === "src/App.tsx").contents, /ProductionHomepage/);
  assert.match(payload.files.find((file) => file.path === "verification-report.json").contents, /"structureScore": 100/);
  assert.match(payload.files.find((file) => file.path === "scripts/verify-contract.mjs").contents, /integration-contract\.json/);
  assert.match(payload.files.find((file) => file.path === "scripts/verify-gates.mjs").contents, /quality-gates\.json/);
  assert.match(payload.files.find((file) => file.path === "scripts/verify-preview.mjs").contents, /preview\.html/);
  assert.match(payload.files.find((file) => file.path === "src/ProductionHomepage.tsx").contents, /export function ProductionHomepage/);
  assert.match(payload.files.find((file) => file.path === "preview.html").contents, /data-layerdoc/);
  assert.match(payload.files.find((file) => file.path === "layerdoc.json").contents, /"schema": "layerdoc"/);
  assert.equal(artifact.contents.endsWith("\n"), true);
});

test("createProjectPackageZipDownload serializes the project package as a real ZIP archive", () => {
  const workspace = createWorkspaceFromLayerDocJson(JSON.stringify(createSampleHomepageLayerDoc()));
  const artifact = createProjectPackageZipDownload(workspace);

  assert.equal(artifact.fileName, "production-homepage.zip");
  assert.equal(artifact.mimeType, "application/zip");
  assert.equal(artifact.contents instanceof Uint8Array, true);
  assert.equal(artifact.contents[0], 0x50);
  assert.equal(artifact.contents[1], 0x4b);
  assert.equal(artifact.contents[2], 0x03);
  assert.equal(artifact.contents[3], 0x04);
  assert.deepEqual(zipCentralDirectoryNames(artifact.contents).sort(), workspace.projectExport.files.map((file) => file.path).sort());
  assert.equal(zipCentralDirectoryNames(artifact.contents).includes("layerdoc-audit.json"), true);
  assert.equal(zipCentralDirectoryNames(artifact.contents).includes("integration-contract.json"), true);
  assert.equal(zipCentralDirectoryNames(artifact.contents).includes("scripts/verify-contract.mjs"), true);
  assert.equal(zipCentralDirectoryNames(artifact.contents).includes("src/ProductionHomepage.tsx"), true);
});

test("createVerificationReportDownload serializes verifier scores without inventing screenshot similarity", () => {
  const workspace = createWorkspaceFromLayerDocJson(JSON.stringify(createSampleHomepageLayerDoc()));
  const artifact = createVerificationReportDownload(workspace);
  const report = JSON.parse(artifact.contents);

  assert.equal(artifact.fileName, "verification-report.json");
  assert.equal(artifact.mimeType, "application/json");
  assert.equal(report.visualSimilarity, null);
  assert.equal(report.structureScore, 100);
  assert.equal(report.componentScore, 100);
  assert.equal(report.visualDiff, null);
  assert.equal(report.evidence.visual.kind, "none");
  assert.equal(artifact.contents.endsWith("\n"), true);
});
