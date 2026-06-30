import assert from "node:assert/strict";
import test from "node:test";

import {
  applyWorkspaceVisualDiff,
  createEditorWorkspace,
  moveWorkspaceSection,
  requestWorkspaceSectionRegeneration,
  selectWorkspaceLayer,
  updateWorkspaceSectionVisibility,
  updateSelectedBounds,
  updateSelectedImageAsset,
  updateSelectedLayerStyle,
  updateSelectedText
} from "../dist/app/editorWorkspace.js";
import { createSampleHomepageLayerDoc } from "../dist/app/sampleDocument.js";

test("createEditorWorkspace derives preview, export, and verifier output from one LayerDoc", () => {
  const workspace = createEditorWorkspace(createSampleHomepageLayerDoc());

  assert.equal(workspace.doc.sections.length, 8);
  assert.equal(workspace.selectedLayerId, "hero-title");
  assert.match(workspace.previewHtml, /data-layer-id="hero-title"/);
  assert.match(workspace.reactExport.code, /export function ProductionHomepage/);
  assert.equal(workspace.projectExport.manifest.componentName, "ProductionHomepage");
  assert.equal(workspace.projectExport.files.length, 21);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "layerdoc.json"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "integration-contract.json"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "layerdoc.schema.json"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "layerdoc-audit.json"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "package.json"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "src/main.tsx"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "verification-report.json"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "scripts/verify-contract.mjs"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "scripts/verify-gates.mjs"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "scripts/verify-layerdoc.mjs"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "scripts/verify-preview.mjs"), true);
  assert.equal(workspace.report.visualSimilarity, null);
  assert.equal(workspace.projectExport.manifest.scores.visualSimilarity, null);
  assert.equal(workspace.audit.summary.sections, 8);
  assert.equal(workspace.audit.assetCompliance.passed, true);
  assert.equal(workspace.report.structureScore, 100);
  assert.equal(workspace.report.componentScore, 100);
});

test("applyWorkspaceVisualDiff updates verifier scores without mutating the LayerDoc", () => {
  const workspace = createEditorWorkspace(createSampleHomepageLayerDoc());
  const next = applyWorkspaceVisualDiff(workspace, {
    visualSimilarity: 97.5,
    mismatchedPixels: 25,
    comparedPixels: 1000,
    dimensions: { width: 1440, height: 1760 },
    mismatchBounds: { x: 20, y: 30, width: 40, height: 50 },
    problemAreas: [{ x: 20, y: 30, width: 40, height: 50 }],
    diffPath: null,
    threshold: 0.1
  });

  assert.equal(workspace.report.visualSimilarity, null);
  assert.equal(next.doc, workspace.doc);
  assert.equal(next.previewHtml, workspace.previewHtml);
  assert.equal(next.report.visualSimilarity, 97.5);
  assert.equal(next.report.visualDiff.mismatchedPixels, 25);
  assert.equal(next.projectExport.manifest.scores.visualSimilarity, 97.5);
});

test("updateSelectedText changes selected editable copy and refreshes preview output", () => {
  const workspace = createEditorWorkspace(createSampleHomepageLayerDoc());
  const next = updateSelectedText(workspace, "Make AI visuals shippable");

  assert.equal(workspace.doc.layers.find((layer) => layer.id === "hero-title").content.text, "Turn AI visuals into production UI");
  assert.equal(next.doc.layers.find((layer) => layer.id === "hero-title").content.text, "Make AI visuals shippable");
  assert.match(next.previewHtml, /Make AI visuals shippable/);
});

test("updateSelectedText can edit selected button copy", () => {
  const workspace = selectWorkspaceLayer(createEditorWorkspace(createSampleHomepageLayerDoc()), "hero-cta");
  const next = updateSelectedText(workspace, "Export now");

  assert.equal(next.doc.layers.find((layer) => layer.id === "hero-cta").content.text, "Export now");
  assert.match(next.previewHtml, /Export now/);
});

test("updateSelectedLayerStyle patches selected layer style for inspector controls", () => {
  const workspace = selectWorkspaceLayer(createEditorWorkspace(createSampleHomepageLayerDoc()), "hero-cta");
  const next = updateSelectedLayerStyle(workspace, {
    backgroundColor: "#0f172a",
    textColor: "#ffffff",
    borderRadius: 18
  });

  const layer = next.doc.layers.find((candidate) => candidate.id === "hero-cta");
  assert.equal(layer.style.backgroundColor, "#0f172a");
  assert.equal(layer.style.textColor, "#ffffff");
  assert.equal(layer.style.borderRadius, 18);
  assert.match(next.reactExport.code, /backgroundColor: "#0f172a"/);
});

test("updateSelectedImageAsset replaces the selected image source", () => {
  const workspace = selectWorkspaceLayer(createEditorWorkspace(createSampleHomepageLayerDoc()), "hero-image");
  const next = updateSelectedImageAsset(workspace, { uri: "/assets/hero-upload.png", source: "uploaded" });
  const asset = next.doc.assets.find((candidate) => candidate.id === "asset-hero");

  assert.equal(asset.uri, "/assets/hero-upload.png");
  assert.equal(asset.source, "uploaded");
  assert.match(next.previewHtml, /src="\/assets\/hero-upload\.png"/);
});

test("moveWorkspaceSection reorders sections without losing the current layer selection", () => {
  const workspace = selectWorkspaceLayer(createEditorWorkspace(createSampleHomepageLayerDoc()), "hero-cta");
  const next = moveWorkspaceSection(workspace, "final-cta", 0);
  const finalTitle = next.doc.layers.find((layer) => layer.id === "final-title");
  const heroCta = next.doc.layers.find((layer) => layer.id === "hero-cta");

  assert.deepEqual(next.doc.sections.slice(0, 3).map((section) => section.id), ["final-cta", "hero", "proof"]);
  assert.equal(next.selectedLayerId, "hero-cta");
  assert.equal(next.doc.sections[0].bounds.y, 0);
  assert.equal(next.doc.sections[1].bounds.y, 220);
  assert.equal(finalTitle.bounds.y, 40);
  assert.equal(heroCta.bounds.y, 392);
  assert.match(next.previewHtml, /data-layer-id="final-title"[^>]+top:40px/);
  assert.match(next.reactExport.code, /data-layer-id="final-title"[\s\S]+top: 40/);
  assert.match(next.projectExport.files.find((file) => file.path === "layerdoc.json").contents, /"id": "final-title"[\s\S]+"y": 40/);
});

test("updateWorkspaceSectionVisibility refreshes preview and export from the LayerDoc state", () => {
  const workspace = createEditorWorkspace(createSampleHomepageLayerDoc());
  const next = updateWorkspaceSectionVisibility(workspace, "proof", false);
  const proof = next.doc.sections.find((section) => section.id === "proof");

  assert.equal(proof.visible, false);
  assert.doesNotMatch(next.previewHtml, /proof-title/);
  assert.doesNotMatch(next.reactExport.code, /data-section-id="proof"/);
  assert.match(next.projectExport.files.find((file) => file.path === "layerdoc.json").contents, /"visible": false/);
});

test("requestWorkspaceSectionRegeneration refreshes the project package with a queued section task", () => {
  const workspace = createEditorWorkspace(createSampleHomepageLayerDoc());
  const next = requestWorkspaceSectionRegeneration(workspace, "hero", "Regenerate the hero with a stronger SaaS product story.", {
    requestedAt: "2026-06-30T10:05:00.000Z"
  });
  const layerDocFile = next.projectExport.files.find((file) => file.path === "layerdoc.json");

  assert.equal(next.doc.generation.sectionRequests.length, 1);
  assert.equal(next.doc.generation.sectionRequests[0].sectionId, "hero");
  assert.match(layerDocFile.contents, /"sectionId": "hero"/);
  assert.match(layerDocFile.contents, /Regenerate the hero/);
  assert.equal(next.previewHtml, workspace.previewHtml);
  assert.equal(next.reactExport.code, workspace.reactExport.code);
});

test("updateSelectedBounds patches selected layer geometry and refreshes preview output", () => {
  const workspace = selectWorkspaceLayer(createEditorWorkspace(createSampleHomepageLayerDoc()), "hero-cta");
  const next = updateSelectedBounds(workspace, { x: 128, width: 210 });
  const layer = next.doc.layers.find((candidate) => candidate.id === "hero-cta");

  assert.equal(layer.bounds.x, 128);
  assert.equal(layer.bounds.y, 172);
  assert.equal(layer.bounds.width, 210);
  assert.match(next.previewHtml, /left:128px/);
  assert.match(next.reactExport.code, /left: 128/);
});
