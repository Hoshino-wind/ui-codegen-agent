import assert from "node:assert/strict";
import test from "node:test";

import {
  applyWorkspaceVisualDiff,
  applyWorkspaceSectionRegenerationCandidate,
  createEditorWorkspace,
  moveWorkspaceSection,
  requestWorkspaceSectionRegeneration,
  selectWorkspaceLayer,
  updateSelectedButtonAction,
  updateWorkspaceSectionVisibility,
  updateSelectedBounds,
  updateSelectedImageAlt,
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
  assert.equal(workspace.projectExport.files.length, 28);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "handoff-summary.json"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "layerdoc.json"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "integration-contract.json"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "layerdoc.schema.json"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "section-candidate.schema.json"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "layerdoc-audit.json"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "package.json"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "src/main.tsx"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "verification-report.json"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "scripts/verify-handoff.mjs"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "scripts/verify-analysis-plan.mjs"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "scripts/verify-image-manifest.mjs"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "scripts/verify-contract.mjs"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "scripts/verify-gates.mjs"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "scripts/verify-layerdoc.mjs"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "scripts/verify-preview.mjs"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "scripts/apply-section-candidate.mjs"), true);
  assert.equal(workspace.projectExport.files.some((file) => file.path === "scripts/verify-section-candidate.mjs"), true);
  assert.equal(workspace.report.visualSimilarity, null);
  assert.deepEqual(workspace.doc.verification.scores, {
    visualSimilarity: null,
    structureScore: 100,
    componentScore: 100,
    projectFitScore: workspace.report.projectFitScore
  });
  assert.deepEqual(workspace.doc.verification.issues, []);
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
  const exportedLayerDoc = JSON.parse(next.projectExport.files.find((file) => file.path === "layerdoc.json").contents);

  assert.equal(workspace.report.visualSimilarity, null);
  assert.equal(workspace.doc.verification.scores.visualSimilarity, null);
  assert.notEqual(next.doc, workspace.doc);
  assert.notEqual(next.previewHtml, workspace.previewHtml);
  assert.equal(next.report.visualSimilarity, 97.5);
  assert.equal(next.doc.verification.scores.visualSimilarity, 97.5);
  assert.equal(next.doc.verification.scores.structureScore, next.report.structureScore);
  assert.deepEqual(next.doc.verification.issues, next.report.issues);
  assert.match(next.previewHtml, /data-verification-visual-similarity="97.5"/);
  assert.match(next.reactExport.code, /data-verification-visual-similarity="97.5"/);
  assert.equal(exportedLayerDoc.verification.scores.visualSimilarity, 97.5);
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

test("updateSelectedButtonAction refreshes preview, React export, and project contract metadata", () => {
  const workspace = selectWorkspaceLayer(createEditorWorkspace(createSampleHomepageLayerDoc()), "hero-cta");
  const next = updateSelectedButtonAction(workspace, "open-enterprise-demo");
  const contract = JSON.parse(next.projectExport.files.find((file) => file.path === "integration-contract.json").contents);

  assert.equal(next.doc.interactions.find((interaction) => interaction.layerId === "hero-cta").action, "open-enterprise-demo");
  assert.match(next.previewHtml, /data-interaction-actions="open-enterprise-demo"/);
  assert.match(next.reactExport.code, /data-interaction-actions="open-enterprise-demo"/);
  assert.deepEqual(contract.interactions, [
    {
      id: "hero-cta-click",
      layerId: "hero-cta",
      event: "click",
      action: "open-enterprise-demo",
      selector: '[data-layer-id="hero-cta"]'
    }
  ]);
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

test("updateSelectedLayerStyle patches spacing controls through preview and export outputs", () => {
  const workspace = selectWorkspaceLayer(createEditorWorkspace(createSampleHomepageLayerDoc()), "hero-cta");
  const next = updateSelectedLayerStyle(workspace, {
    padding: { x: 28, y: 14 },
    gap: 12
  });
  const layer = next.doc.layers.find((candidate) => candidate.id === "hero-cta");
  const projectComponent = next.projectExport.files.find((file) => file.path === "src/ProductionHomepage.tsx").contents;

  assert.deepEqual(layer.style.padding, { x: 28, y: 14 });
  assert.equal(layer.style.gap, 12);
  assert.match(next.previewHtml, /data-layer-id="hero-cta"[\s\S]+padding:14px 28px/);
  assert.match(next.previewHtml, /data-layer-id="hero-cta"[\s\S]+gap:12px/);
  assert.match(next.reactExport.code, /data-layer-id="hero-cta"[\s\S]+padding: "14px 28px"/);
  assert.match(next.reactExport.code, /data-layer-id="hero-cta"[\s\S]+gap: 12/);
  assert.match(projectComponent, /data-layer-id="hero-cta"[\s\S]+padding: "14px 28px"/);
});

test("updateSelectedLayerStyle patches typography controls through preview and export outputs", () => {
  const workspace = selectWorkspaceLayer(createEditorWorkspace(createSampleHomepageLayerDoc()), "hero-title");
  const next = updateSelectedLayerStyle(workspace, {
    fontFamily: "Inter, sans-serif",
    fontSize: 54,
    fontWeight: 860,
    lineHeight: 62,
    letterSpacing: 0.4
  });
  const layer = next.doc.layers.find((candidate) => candidate.id === "hero-title");
  const projectComponent = next.projectExport.files.find((file) => file.path === "src/ProductionHomepage.tsx").contents;

  assert.equal(layer.style.fontFamily, "Inter, sans-serif");
  assert.equal(layer.style.fontSize, 54);
  assert.equal(layer.style.fontWeight, 860);
  assert.equal(layer.style.lineHeight, 62);
  assert.equal(layer.style.letterSpacing, 0.4);
  assert.match(next.previewHtml, /data-layer-id="hero-title"[\s\S]+font-family:Inter, sans-serif/);
  assert.match(next.previewHtml, /data-layer-id="hero-title"[\s\S]+font-size:54px/);
  assert.match(next.previewHtml, /data-layer-id="hero-title"[\s\S]+font-weight:860/);
  assert.match(next.previewHtml, /data-layer-id="hero-title"[\s\S]+line-height:62px/);
  assert.match(next.previewHtml, /data-layer-id="hero-title"[\s\S]+letter-spacing:0.4px/);
  assert.match(next.reactExport.code, /data-layer-id="hero-title"[\s\S]+fontFamily: "Inter, sans-serif"/);
  assert.match(next.reactExport.code, /data-layer-id="hero-title"[\s\S]+fontSize: 54/);
  assert.match(next.reactExport.code, /data-layer-id="hero-title"[\s\S]+fontWeight: 860/);
  assert.match(next.reactExport.code, /data-layer-id="hero-title"[\s\S]+lineHeight: "62px"/);
  assert.match(next.reactExport.code, /data-layer-id="hero-title"[\s\S]+letterSpacing: "0.4px"/);
  assert.match(projectComponent, /data-layer-id="hero-title"[\s\S]+fontSize: 54/);
  assert.match(projectComponent, /data-layer-id="hero-title"[\s\S]+lineHeight: "62px"/);
});

test("updateSelectedLayerStyle patches border and opacity controls through preview and export outputs", () => {
  const workspace = selectWorkspaceLayer(createEditorWorkspace(createSampleHomepageLayerDoc()), "hero-cta");
  const next = updateSelectedLayerStyle(workspace, {
    borderColor: "#0f766e",
    opacity: 0.82
  });
  const layer = next.doc.layers.find((candidate) => candidate.id === "hero-cta");
  const projectComponent = next.projectExport.files.find((file) => file.path === "src/ProductionHomepage.tsx").contents;

  assert.equal(layer.style.borderColor, "#0f766e");
  assert.equal(layer.style.opacity, 0.82);
  assert.match(next.previewHtml, /data-layer-id="hero-cta"[\s\S]+border-color:#0f766e/);
  assert.match(next.previewHtml, /data-layer-id="hero-cta"[\s\S]+opacity:0.82/);
  assert.match(next.reactExport.code, /data-layer-id="hero-cta"[\s\S]+borderColor: "#0f766e"/);
  assert.match(next.reactExport.code, /data-layer-id="hero-cta"[\s\S]+opacity: 0.82/);
  assert.match(projectComponent, /data-layer-id="hero-cta"[\s\S]+borderColor: "#0f766e"/);
});

test("updateSelectedImageAsset replaces the selected image source", () => {
  const workspace = selectWorkspaceLayer(createEditorWorkspace(createSampleHomepageLayerDoc()), "hero-image");
  const next = updateSelectedImageAsset(workspace, { uri: "/assets/hero-upload.png", source: "uploaded" });
  const asset = next.doc.assets.find((candidate) => candidate.id === "asset-hero");

  assert.equal(asset.uri, "/assets/hero-upload.png");
  assert.equal(asset.source, "uploaded");
  assert.match(next.previewHtml, /src="\/assets\/hero-upload\.png"/);
});

test("updateSelectedImageAlt refreshes preview, React export, and project package image metadata", () => {
  const workspace = selectWorkspaceLayer(createEditorWorkspace(createSampleHomepageLayerDoc()), "hero-image");
  const next = updateSelectedImageAlt(workspace, "Generated homepage reference crop");
  const projectComponent = next.projectExport.files.find((file) => file.path === "src/ProductionHomepage.tsx").contents;

  assert.equal(workspace.doc.layers.find((layer) => layer.id === "hero-image").content.alt, "Reference homepage crop");
  assert.equal(next.doc.layers.find((layer) => layer.id === "hero-image").content.alt, "Generated homepage reference crop");
  assert.match(next.previewHtml, /alt="Generated homepage reference crop"/);
  assert.match(next.reactExport.code, /alt="Generated homepage reference crop"/);
  assert.match(projectComponent, /alt="Generated homepage reference crop"/);
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
  const contract = JSON.parse(next.projectExport.files.find((file) => file.path === "integration-contract.json").contents);
  const handoffSummary = JSON.parse(next.projectExport.files.find((file) => file.path === "handoff-summary.json").contents);

  assert.equal(next.doc.generation.sectionRequests.length, 1);
  assert.equal(next.doc.generation.sectionRequests[0].sectionId, "hero");
  assert.match(layerDocFile.contents, /"sectionId": "hero"/);
  assert.match(layerDocFile.contents, /Regenerate the hero/);
  assert.deepEqual(contract.generationRequests, [
    {
      id: "regen-hero-1",
      sectionId: "hero",
      prompt: "Regenerate the hero with a stronger SaaS product story.",
      status: "requested",
      requestedAt: "2026-06-30T10:05:00.000Z",
      selector: '[data-section-id="hero"]',
      sectionVisible: true
    }
  ]);
  assert.equal(handoffSummary.contract.generationRequests, 1);
  assert.equal(next.previewHtml, workspace.previewHtml);
  assert.equal(next.reactExport.code, workspace.reactExport.code);
});

test("applyWorkspaceSectionRegenerationCandidate refreshes preview, export, and project package from a reviewed section", () => {
  const requested = requestWorkspaceSectionRegeneration(createEditorWorkspace(createSampleHomepageLayerDoc()), "hero", "Regenerate the hero.");
  const next = applyWorkspaceSectionRegenerationCandidate(requested, "hero", {
    requestId: "regen-hero-1",
    section: {
      id: "hero",
      name: "Hero",
      bounds: { x: 0, y: 0, width: 1440, height: 340 },
      layerIds: ["hero-regenerated-title", "hero-regenerated-cta"]
    },
    layers: [
      {
        id: "hero-regenerated-title",
        sectionId: "hero",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 96, y: 72, width: 680, height: 80 },
        content: { text: "Reviewed AI hero section" },
        style: { fontSize: 58, fontWeight: 860, lineHeight: 64, textColor: "#0f172a" }
      },
      {
        id: "hero-regenerated-cta",
        sectionId: "hero",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 96, y: 184, width: 180, height: 52 },
        content: { text: "Export build" },
        style: { backgroundColor: "#0f766e", textColor: "#ffffff", borderRadius: 16 }
      }
    ],
    components: [{ id: "RegeneratedHero", layerIds: ["hero-regenerated-title", "hero-regenerated-cta"], exportable: true }],
    interactions: [{ id: "hero-regenerated-cta-click", layerId: "hero-regenerated-cta", event: "click", action: "export-project" }]
  });
  const layerDocFile = JSON.parse(next.projectExport.files.find((file) => file.path === "layerdoc.json").contents);
  const contract = JSON.parse(next.projectExport.files.find((file) => file.path === "integration-contract.json").contents);
  const projectComponent = next.projectExport.files.find((file) => file.path === "src/ProductionHomepage.tsx").contents;

  assert.equal(next.selectedLayerId, "hero-regenerated-title");
  assert.equal(next.doc.layers.some((layer) => layer.id === "hero-title"), false);
  assert.equal(next.doc.generation.sectionRequests[0].status, "applied");
  assert.match(next.previewHtml, /Reviewed AI hero section/);
  assert.match(next.reactExport.code, /hero-regenerated-title/);
  assert.match(projectComponent, /data-layer-id="hero-regenerated-cta"/);
  assert.equal(layerDocFile.sections.find((section) => section.id === "hero").bounds.height, 340);
  assert.equal(layerDocFile.generation.sectionRequests[0].status, "applied");
  assert.equal(contract.generationRequests[0].status, "applied");
  assert.equal(contract.layers.some((layer) => layer.id === "hero-title"), false);
  assert.equal(contract.layers.some((layer) => layer.id === "hero-regenerated-title"), true);
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
