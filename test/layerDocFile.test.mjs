import assert from "node:assert/strict";
import test from "node:test";

import {
  createLayerDocDownload,
  createProjectPackageDownload,
  createReactExportDownload,
  createVerificationReportDownload,
  createWorkspaceFromLayerDocJson
} from "../dist/app/layerDocFile.js";
import { createSampleHomepageLayerDoc } from "../dist/app/sampleDocument.js";

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
      "index.html",
      "layerdoc-audit.json",
      "layerdoc.json",
      "manifest.json",
      "package.json",
      "preview.html",
      "quality-gates.json",
      "scripts/verify-gates.mjs",
      "src/App.tsx",
      "src/index.css",
      "src/main.tsx",
      "src/ProductionHomepage.tsx",
      "tsconfig.json",
      "verification-report.json",
      "vite.config.ts"
    ].sort()
  );
  assert.match(payload.files.find((file) => file.path === "package.json").contents, /"dev": "vite"/);
  assert.match(payload.files.find((file) => file.path === "package.json").contents, /"verify:gates"/);
  assert.match(payload.files.find((file) => file.path === "layerdoc-audit.json").contents, /"assetCompliance"/);
  assert.match(payload.files.find((file) => file.path === "src/main.tsx").contents, /createRoot/);
  assert.match(payload.files.find((file) => file.path === "src/App.tsx").contents, /ProductionHomepage/);
  assert.match(payload.files.find((file) => file.path === "verification-report.json").contents, /"structureScore": 100/);
  assert.match(payload.files.find((file) => file.path === "scripts/verify-gates.mjs").contents, /quality-gates\.json/);
  assert.match(payload.files.find((file) => file.path === "src/ProductionHomepage.tsx").contents, /export function ProductionHomepage/);
  assert.match(payload.files.find((file) => file.path === "preview.html").contents, /data-layerdoc/);
  assert.match(payload.files.find((file) => file.path === "layerdoc.json").contents, /"schema": "layerdoc"/);
  assert.equal(artifact.contents.endsWith("\n"), true);
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
  assert.equal(artifact.contents.endsWith("\n"), true);
});
