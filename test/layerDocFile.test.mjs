import assert from "node:assert/strict";
import test from "node:test";

import {
  createAnalysisTaskPackageDownload,
  createAnalysisPlanDownload,
  createBacktestHandoffDownload,
  createHtmlPreviewDownload,
  createLayerDocDownload,
  createProjectPackageDownload,
  createProjectPackageZipDownload,
  createReactExportDownload,
  createVerificationReportDownload,
  createWorkspaceFromLayerDocJson
} from "../dist/app/layerDocFile.js";
import { applyWorkspaceVisualDiff } from "../dist/app/editorWorkspace.js";
import { createSampleHomepageLayerDoc } from "../dist/app/sampleDocument.js";
import { createHomepageAnalysisPlan, createStoredZipArchive } from "../dist/index.js";

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

function zipLocalFileData(bytes, path) {
  const encoder = new TextEncoder();
  const expectedName = encoder.encode(path);
  let offset = 0;

  while (offset < bytes.length && readUInt32LE(bytes, offset) === 0x04034b50) {
    const compressedSize = readUInt32LE(bytes, offset + 18);
    const fileNameLength = readUInt16LE(bytes, offset + 26);
    const extraLength = readUInt16LE(bytes, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const name = bytes.slice(nameStart, nameStart + fileNameLength);
    if (name.length === expectedName.length && name.every((byte, index) => byte === expectedName[index])) {
      return bytes.slice(dataStart, dataStart + compressedSize);
    }
    offset = dataStart + compressedSize;
  }

  throw new Error(`ZIP entry ${path} was not found.`);
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
  assert.deepEqual(workspace.doc.generation.sectionApplications, []);
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

test("createWorkspaceFromLayerDocJson rejects invalid Analysis Plan provenance", () => {
  const invalid = createSampleHomepageLayerDoc();
  invalid.metadata.analysisPlan = {
    source: "unknown",
    name: "",
    sectionCount: -1,
    layerCount: -2,
    uri: ""
  };

  assert.throws(
    () => createWorkspaceFromLayerDocJson(JSON.stringify(invalid)),
    /LayerDoc validation failed: metadata\.analysisPlan\.source/
  );
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
  assert.deepEqual(parsed.verification.visualProblemAreas, verified.report.visualProblemAreas);
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

test("createAnalysisTaskPackageDownload serializes the model-facing PNG decomposition package", () => {
  const artifact = createAnalysisTaskPackageDownload({
    name: "Generated homepage",
    sourceImage: { uri: "references/homepage.png", width: 1536, height: 1024 }
  });

  assert.equal(artifact.fileName, "analysis-task-package.zip");
  assert.equal(artifact.mimeType, "application/zip");
  assert.deepEqual(zipCentralDirectoryNames(artifact.contents).sort(), ["analysis-plan.schema.json", "analysis-task.json"]);

  const task = JSON.parse(new TextDecoder().decode(zipLocalFileData(artifact.contents, "analysis-task.json")));
  const schema = JSON.parse(new TextDecoder().decode(zipLocalFileData(artifact.contents, "analysis-plan.schema.json")));

  assert.equal(task.kind, "homepage-png-analysis");
  assert.equal(task.name, "Generated homepage");
  assert.deepEqual(task.sourceImage, { uri: "references/homepage.png", width: 1536, height: 1024 });
  assert.equal(task.outputContract.schemaFile, "analysis-plan.schema.json");
  assert.equal(task.outputContract.minSections, 8);
  assert.equal(task.outputContract.maxSections, 15);
  assert.match(task.operatorPrompt, /Image -> HomepageAnalysisPlan -> LayerDoc -> HTML Preview -> React\/Tailwind -> Verifier/);
  assert.equal(schema.title, "HomepageAnalysisPlan 0.1.0");
});

test("createAnalysisTaskPackageDownload includes uploaded PNG bytes as the package source image", () => {
  const sourcePng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]);
  const artifact = createAnalysisTaskPackageDownload({
    name: "Uploaded homepage",
    sourceImage: {
      uri: "browser-upload.png",
      width: 1536,
      height: 1024,
      dataUri: `data:image/png;base64,${Buffer.from(sourcePng).toString("base64")}`
    }
  });

  assert.deepEqual(zipCentralDirectoryNames(artifact.contents).sort(), ["analysis-plan.schema.json", "analysis-task.json", "source.png"]);

  const task = JSON.parse(new TextDecoder().decode(zipLocalFileData(artifact.contents, "analysis-task.json")));

  assert.deepEqual(task.sourceImage, { uri: "source.png", width: 1536, height: 1024 });
  assert.deepEqual([...zipLocalFileData(artifact.contents, "source.png")], [...sourcePng]);
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

test("createHtmlPreviewDownload serializes the current LayerDoc HTML preview", () => {
  const workspace = createWorkspaceFromLayerDocJson(JSON.stringify(createSampleHomepageLayerDoc()));
  const artifact = createHtmlPreviewDownload(workspace);

  assert.equal(artifact.fileName, "preview.html");
  assert.equal(artifact.mimeType, "text/html;charset=utf-8");
  assert.match(artifact.contents, /data-layerdoc="0.1.0"/);
  assert.match(artifact.contents, /data-layer-id="hero-title"/);
  assert.match(artifact.contents, /Turn AI visuals into production UI/);
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
      "section-candidate.schema.json",
      "scripts/apply-section-candidate.mjs",
      "scripts/verify-analysis-plan.mjs",
      "scripts/verify-contract.mjs",
      "scripts/verify-gates.mjs",
      "scripts/verify-handoff.mjs",
      "scripts/verify-image-manifest.mjs",
      "scripts/verify-layerdoc.mjs",
      "scripts/verify-preview.mjs",
      "scripts/verify-section-application.mjs",
      "scripts/verify-section-candidate.mjs",
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
  assert.match(payload.files.find((file) => file.path === "package.json").contents, /"verify:handoff"/);
  assert.match(payload.files.find((file) => file.path === "package.json").contents, /"verify:analysis-plan"/);
  assert.match(payload.files.find((file) => file.path === "package.json").contents, /"verify:image-manifest"/);
  assert.match(payload.files.find((file) => file.path === "package.json").contents, /"verify:preview"/);
  assert.match(payload.files.find((file) => file.path === "package.json").contents, /"verify:gates"/);
  assert.match(payload.files.find((file) => file.path === "layerdoc-audit.json").contents, /"assetCompliance"/);
  assert.match(payload.files.find((file) => file.path === "src/main.tsx").contents, /createRoot/);
  assert.match(payload.files.find((file) => file.path === "src/App.tsx").contents, /ProductionHomepage/);
  assert.match(payload.files.find((file) => file.path === "verification-report.json").contents, /"structureScore": 100/);
  assert.match(payload.files.find((file) => file.path === "scripts/verify-contract.mjs").contents, /integration-contract\.json/);
  assert.match(payload.files.find((file) => file.path === "scripts/verify-handoff.mjs").contents, /handoff-summary\.json/);
  assert.match(payload.files.find((file) => file.path === "scripts/verify-analysis-plan.mjs").contents, /manifest\.json/);
  assert.match(payload.files.find((file) => file.path === "scripts/verify-image-manifest.mjs").contents, /image-manifest\.json/);
  assert.match(payload.files.find((file) => file.path === "scripts/verify-gates.mjs").contents, /quality-gates\.json/);
  assert.match(payload.files.find((file) => file.path === "scripts/verify-preview.mjs").contents, /preview\.html/);
  assert.match(payload.files.find((file) => file.path === "src/ProductionHomepage.tsx").contents, /export function ProductionHomepage/);
  assert.match(payload.files.find((file) => file.path === "preview.html").contents, /data-layerdoc/);
  assert.match(payload.files.find((file) => file.path === "layerdoc.json").contents, /"schema": "layerdoc"/);
  assert.equal(artifact.contents.endsWith("\n"), true);
});

test("createBacktestHandoffDownload exposes the project handoff summary as a direct Studio artifact", () => {
  const workspace = createWorkspaceFromLayerDocJson(JSON.stringify(createSampleHomepageLayerDoc()));
  const artifact = createBacktestHandoffDownload(workspace);
  const payload = JSON.parse(artifact.contents);

  assert.equal(artifact.fileName, "handoff-summary.json");
  assert.equal(artifact.mimeType, "application/json");
  assert.equal(payload.positioning, "AI UI Production System");
  assert.equal(payload.source, "layerdoc");
  assert.equal(payload.sourceOfTruth.file, "layerdoc.json");
  assert.equal(payload.quality.referenceVisual.file, "reference.png");
  assert.equal(Array.isArray(payload.commands), true);
  assert.equal(payload.commands.some((entry) => /verify:preview/.test(entry.command)), true);
  assert.equal(artifact.contents.endsWith("\n"), true);
});

test("createProjectPackageDownload encodes binary project files as base64 entries", () => {
  const workspace = createWorkspaceFromLayerDocJson(JSON.stringify(createSampleHomepageLayerDoc()));
  const referencePng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
  const projectExport = {
    ...workspace.projectExport,
    manifest: {
      ...workspace.projectExport.manifest,
      files: [...workspace.projectExport.manifest.files, "reference.png"]
    },
    files: [...workspace.projectExport.files, { path: "reference.png", contents: referencePng }]
  };

  const artifact = createProjectPackageDownload({ ...workspace, projectExport });
  const payload = JSON.parse(artifact.contents);
  const referenceFile = payload.files.find((file) => file.path === "reference.png");

  assert.equal(referenceFile.contentEncoding, "base64");
  assert.equal(referenceFile.contentsBase64, Buffer.from(referencePng).toString("base64"));
  assert.equal("contents" in referenceFile, false);
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
  assert.equal(zipCentralDirectoryNames(artifact.contents).includes("scripts/verify-handoff.mjs"), true);
  assert.equal(zipCentralDirectoryNames(artifact.contents).includes("scripts/verify-analysis-plan.mjs"), true);
  assert.equal(zipCentralDirectoryNames(artifact.contents).includes("scripts/verify-image-manifest.mjs"), true);
  assert.equal(zipCentralDirectoryNames(artifact.contents).includes("src/ProductionHomepage.tsx"), true);
});

test("createProjectPackageZipDownload preserves binary project files inside the ZIP", () => {
  const workspace = createWorkspaceFromLayerDocJson(JSON.stringify(createSampleHomepageLayerDoc()));
  const referencePng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
  const projectExport = {
    ...workspace.projectExport,
    manifest: {
      ...workspace.projectExport.manifest,
      files: [...workspace.projectExport.manifest.files, "reference.png"]
    },
    files: [...workspace.projectExport.files, { path: "reference.png", contents: referencePng }]
  };

  const artifact = createProjectPackageZipDownload({ ...workspace, projectExport });

  assert.equal(zipCentralDirectoryNames(artifact.contents).includes("reference.png"), true);
  assert.deepEqual([...zipLocalFileData(artifact.contents, "reference.png")], [...referencePng]);
});

test("createStoredZipArchive preserves binary project files", () => {
  const referencePng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);

  const archive = createStoredZipArchive([
    { path: "reference.png", contents: referencePng },
    { path: "README.md", contents: "hello\n" }
  ]);

  assert.deepEqual([...zipLocalFileData(archive, "reference.png")], [...referencePng]);
  assert.equal(new TextDecoder().decode(zipLocalFileData(archive, "README.md")), "hello\n");
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
