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

test("app shell exposes undo and redo for controlled editor history", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /undoWorkspace/);
  assert.match(source, /redoWorkspace/);
  assert.match(source, /workspace\.history\.past\.length/);
  assert.match(source, /workspace\.history\.future\.length/);
  assert.match(source, /aria-label="Undo editor change"/);
  assert.match(source, /aria-label="Redo editor change"/);
});

test("app shell exposes Analysis Plan save action", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /Save Analysis Plan/);
  assert.match(source, /createAnalysisPlanDownload/);
});

test("app shell exposes Analysis Plan load action", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /Load Analysis Plan/);
  assert.match(source, /createIntakeWorkspaceFromAnalysisPlanJson/);
  assert.match(source, /createIntakeWorkspaceFromAnalysisPlanJson\(intake\.sourceImage, await file\.text\(\), file\.name\)/);
});

test("app shell exposes an Analysis Task handoff before Analysis Plan editing", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /Analysis Task/);
  assert.match(source, /Save Analysis Task/);
  assert.match(source, /createAnalysisTaskPackageDownload/);
  assert.match(source, /dataUri: intake\.sourceImage\.dataUri/);
  assert.match(source, /analysis-task-download/);
  assert.match(source, /Image -> Analysis Task -> Analysis Plan -> LayerDoc/);
});

test("app shell exposes mock vision decomposition before LayerDoc build", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /Mock Vision/);
  assert.match(source, /runMockVisionDecomposition/);
  assert.match(source, /Build LayerDoc/);
});

test("app shell exposes Analysis Plan provenance in the intake console", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /analysisPlanSource/);
  assert.match(source, /analysisPlanUri/);
  assert.match(source, /Source/);
});

test("app shell exposes Analysis Plan audit readiness and track counts", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /analysis-audit/);
  assert.match(source, /intake\.audit\.readiness\.readyForLayerDoc/);
  assert.match(source, /intake\.audit\.tracks\.component/);
  assert.match(source, /emptySectionIds/);
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

test("app shell exposes project backtest handoff commands", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /Backtest Handoff/);
  assert.match(source, /Save Backtest/);
  assert.match(source, /createBacktestHandoffDownload/);
  assert.match(source, /saveBacktestHandoffFile/);
  assert.match(source, /npm run pipeline:homepage --/);
  assert.match(source, /--verify-project/);
  assert.match(source, /npm run materialize:project --/);
  assert.match(source, /--verify-preview/);
  assert.match(source, /project\.verification/);
});

test("app shell exposes reviewed section candidate import for regeneration results", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /Apply Section Candidate/);
  assert.match(source, /applyWorkspaceSectionRegenerationCandidate/);
  assert.match(source, /parseSectionRegenerationCandidateJson/);
  assert.match(source, /accept="application\/json,\.json"/);
});

test("app shell exposes section regeneration rollback for applied candidates", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /revertWorkspaceSectionRegenerationApplication/);
  assert.match(source, /section-revert/);
  assert.match(source, /Revert latest/);
  assert.match(source, /sectionApplications/);
});

test("app shell exposes verifier problem areas in the editor surface", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /createProblemAreaAnnotations/);
  assert.match(source, /problem-area-overlay/);
  assert.match(source, /Problem areas/);
});

test("app shell can focus the affected LayerDoc layer from a verifier problem area", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /affectedLayerId/);
  assert.match(source, /onFocusProblemArea/);
});

test("app shell links verifier problem rows to affected LayerDoc layers", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /problemAreaAnnotations/);
  assert.match(source, /problem-area-layer/);
  assert.match(source, /Focus layer/);
});

test("app shell uses report visual problem areas as the verifier source of truth", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /workspace\.report\.visualProblemAreas/);
  assert.doesNotMatch(source, /createProblemAreaAnnotations\(workspace\.report\.visualDiff\?\.problemAreas/);
});

test("app shell exposes quality gate status in the verifier surface", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /evaluateVerificationGates/);
  assert.match(source, /assetCompliance: workspace\.audit\.assetCompliance/);
  assert.match(source, /editableCoverage: workspace\.audit\.editableCoverage/);
  assert.match(source, /quality-gate-summary/);
  assert.match(source, /Quality gate/);
});

test("app shell exposes structural verifier issues in the verifier surface", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /Structure issues/);
  assert.match(source, /workspace\.report\.issues/);
  assert.match(source, /issue\.code/);
  assert.match(source, /issue\.path/);
  assert.match(source, /verifier-issue-list/);
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

test("app shell exposes direct HTML preview export", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /Save HTML/);
  assert.match(source, /createHtmlPreviewDownload/);
  assert.match(source, /saveHtmlPreviewFile/);
});

test("app shell exposes a PNG reference overlay for pixel alignment", () => {
  const appSource = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");
  const cssSource = readFileSync(join(rootDir, "src", "app", "styles.css"), "utf8");

  assert.match(appSource, /referenceOverlayEnabled/);
  assert.match(appSource, /referenceOverlayOpacity/);
  assert.match(appSource, /createReferenceOverlayDataUrl/);
  assert.match(appSource, /reference-overlay-image/);
  assert.match(appSource, /Reference overlay/);
  assert.match(cssSource, /\.reference-overlay-image/);
});

test("app shell reuses the LayerDoc source PNG as the verifier reference", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /readBrowserPngBytesSnapshot/);
  assert.match(source, /workspace\.referencePng/);
  assert.match(source, /verifierReference \?\?/);
  assert.match(source, /LayerDoc source PNG/);
  assert.match(source, /referenceName=\{verifierReference\?\.fileName \?\? \(workspace\.referencePng \? "LayerDoc source PNG" : null\)\}/);
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
  assert.match(source, /intake\.audit\.readiness\.readyForLayerDoc/);
  assert.match(source, /Add layers to:/);
});
