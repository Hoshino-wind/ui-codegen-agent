import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const rootDir = process.cwd();

test("index.html references an existing favicon asset", () => {
  const html = readFileSync(join(rootDir, "index.html"), "utf8");

  assert.match(html, /rel="icon"/);
  assert.match(html, /href="\/favicon\.svg"/);
  assert.equal(existsSync(join(rootDir, "public", "favicon.svg")), true);
});

test("app shell exposes LayerDoc load and save actions", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /Load LayerDoc/);
  assert.match(source, /Save LayerDoc/);
  assert.match(source, /accept="application\/json,\.json"/);
});

test("app shell exposes a project package export action", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /Export Project/);
  assert.match(source, /createProjectPackageDownload/);
});

test("app shell exposes a project ZIP export action", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /Export ZIP/);
  assert.match(source, /createProjectPackageZipDownload/);
});

test("app shell exposes verifier problem areas in the editor surface", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /createProblemAreaAnnotations/);
  assert.match(source, /problem-area-overlay/);
  assert.match(source, /Problem areas/);
});

test("app shell exposes quality gate status in the verifier surface", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /evaluateVerificationGates/);
  assert.match(source, /assetCompliance: workspace\.audit\.assetCompliance/);
  assert.match(source, /editableCoverage: workspace\.audit\.editableCoverage/);
  assert.match(source, /quality-gate-summary/);
  assert.match(source, /Quality gate/);
});

test("app shell exposes verifier evidence provenance with HTML screenshot attempt and raster fallback", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /workspace\.report\.evidence\.visual/);
  assert.match(source, /verifier-evidence/);
  assert.match(source, /HTML preview screenshot/);
  assert.match(source, /renderHtmlPreviewSnapshot/);
  assert.match(source, /verificationVisualEvidence\.htmlScreenshot/);
  assert.match(source, /HTML screenshot unavailable/);
  assert.match(source, /LayerDoc raster fallback/);
  assert.match(source, /renderLayerDocSnapshot/);
});

test("app shell exposes LayerDoc audit status in the project surface", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /LayerDoc Audit/);
  assert.match(source, /workspace\.audit/);
  assert.match(source, /assetCompliance/);
});

test("app shell exposes the generated HTML preview as a real iframe surface", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /previewSurface/);
  assert.match(source, /HTML Preview/);
  assert.match(source, /srcDoc=\{workspace\.previewHtml\}/);
  assert.match(source, /html-preview-frame/);
});

test("app shell exposes controlled button action editing", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /updateSelectedButtonAction/);
  assert.match(source, /Button action/);
  assert.match(source, /data-interaction-actions/);
});

test("app shell exposes controlled image alt editing", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /updateSelectedImageAlt/);
  assert.match(source, /readOnly=\{layer\.kind !== "image"\}/);
});

test("app shell exposes controlled spacing style editing", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /Padding X/);
  assert.match(source, /Padding Y/);
  assert.match(source, /Gap/);
  assert.match(source, /padding: \{ x:/);
  assert.match(source, /padding: \{ y:/);
});

test("app shell exposes controlled typography style editing", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /Font family/);
  assert.match(source, /Font size/);
  assert.match(source, /Font weight/);
  assert.match(source, /Line height/);
  assert.match(source, /Letter spacing/);
  assert.match(source, /fontFamily: event\.target\.value/);
  assert.match(source, /fontSize: numberFromInput/);
  assert.match(source, /fontWeight: numberFromInput/);
  assert.match(source, /lineHeight: numberFromDecimalInput/);
  assert.match(source, /letterSpacing: numberFromDecimalInput/);
});

test("app shell exposes controlled border and opacity style editing", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /Border color/);
  assert.match(source, /Opacity/);
  assert.match(source, /borderColor: layer\.style\?\.borderColor/);
  assert.match(source, /opacity: layer\.style\?\.opacity/);
  assert.match(source, /borderColor: event\.target\.value/);
  assert.match(source, /opacity: numberFromDecimalInput/);
});

test("app shell materializes uploaded PNG reference crops before building LayerDoc", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /materializeReferenceCropAssets/);
  assert.match(source, /cropBrowserReferenceAsset/);
});

test("app shell blocks LayerDoc build until analysis layers exist", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /canBuildLayerDoc/);
  assert.match(source, /disabled=\{!canBuildLayerDoc\}/);
  assert.match(source, /Add layers before building/);
});

test("app shell blocks LayerDoc build until every homepage section has a layer", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /emptyAnalysisSectionNames/);
  assert.match(source, /emptyAnalysisSectionNames\.length === 0/);
  assert.match(source, /Add layers to:/);
});
