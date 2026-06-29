import assert from "node:assert/strict";
import test from "node:test";

import {
  addManualAnalysisLayer,
  addHeroAnnotationSet,
  buildWorkspaceFromIntake,
  createIntakeWorkspace,
  selectIntakeLayer,
  selectIntakeSection,
  updateManualAnalysisLayer
} from "../dist/app/intakeWorkspace.js";

test("createIntakeWorkspace creates an eight-section analysis plan from source image metadata", () => {
  const intake = createIntakeWorkspace({
    uri: "/uploads/homepage.png",
    width: 1440,
    height: 1760
  });

  assert.equal(intake.analysisPlan.sections.length, 8);
  assert.equal(intake.selectedSectionId, "hero");
  assert.equal(intake.layerCount, 0);
  assert.equal(intake.ready, true);
  assert.deepEqual(intake.issues, []);
});

test("addHeroAnnotationSet adds editable hero layers without mutating the original intake workspace", () => {
  const intake = createIntakeWorkspace({
    uri: "/uploads/homepage.png",
    width: 1440,
    height: 1760
  });

  const next = addHeroAnnotationSet(intake);

  assert.equal(intake.layerCount, 0);
  assert.equal(next.layerCount, 4);
  assert.deepEqual(next.analysisPlan.sections[0].layers.map((layer) => layer.id), ["hero-title", "hero-copy", "hero-cta", "hero-image"]);
  assert.equal(next.ready, true);
});

test("selectIntakeSection changes the selected analysis section", () => {
  const intake = createIntakeWorkspace({
    uri: "/uploads/homepage.png",
    width: 1440,
    height: 1760
  });

  const next = selectIntakeSection(intake, "verifier");

  assert.equal(next.selectedSectionId, "verifier");
  assert.equal(intake.selectedSectionId, "hero");
});

test("buildWorkspaceFromIntake converts annotations into the editable LayerDoc workspace", () => {
  const intake = addHeroAnnotationSet(
    createIntakeWorkspace({
      uri: "/uploads/homepage.png",
      width: 1440,
      height: 1760
    })
  );

  const workspace = buildWorkspaceFromIntake(intake);

  assert.equal(workspace.doc.sections.length, 8);
  assert.equal(workspace.selectedLayerId, "hero-title");
  assert.equal(workspace.doc.layers.some((layer) => layer.id === "hero-image" && layer.track === "asset"), true);
  assert.match(workspace.previewHtml, /Imported hero headline/);
  assert.equal(workspace.report.structureScore, 100);
});

test("addHeroAnnotationSet keeps generated bounds inside narrower uploaded PNG canvases", () => {
  const intake = addHeroAnnotationSet(
    createIntakeWorkspace({
      uri: "/uploads/narrow-homepage.png",
      width: 640,
      height: 960
    })
  );
  const heroImage = intake.analysisPlan.sections[0].layers.find((layer) => layer.id === "hero-image");
  const workspace = buildWorkspaceFromIntake(intake);

  assert.equal(intake.ready, true);
  assert.equal(heroImage.bounds.x + heroImage.bounds.width <= intake.sourceImage.width, true);
  assert.equal(heroImage.asset.cropBounds.x + heroImage.asset.cropBounds.width <= intake.sourceImage.width, true);
  assert.match(workspace.previewHtml, /Imported hero headline/);
});

test("addManualAnalysisLayer adds a selected text layer to the active section without mutating the prior workspace", () => {
  const intake = selectIntakeSection(
    createIntakeWorkspace({
      uri: "/uploads/homepage.png",
      width: 1440,
      height: 1760
    }),
    "workflow"
  );

  const next = addManualAnalysisLayer(intake, { kind: "text" });
  const workflow = next.analysisPlan.sections.find((section) => section.id === "workflow");
  const layer = workflow.layers.find((candidate) => candidate.id === "workflow-text-1");

  assert.equal(intake.layerCount, 0);
  assert.equal(next.layerCount, 1);
  assert.equal(next.selectedSectionId, "workflow");
  assert.equal(next.selectedLayerId, "workflow-text-1");
  assert.equal(layer.kind, "text");
  assert.equal(layer.text, "Workflow text");
  assert.equal(layer.bounds.x >= workflow.bounds.x, true);
  assert.equal(layer.bounds.y >= workflow.bounds.y, true);
  assert.equal(layer.bounds.x + layer.bounds.width <= workflow.bounds.x + workflow.bounds.width, true);
  assert.equal(layer.bounds.y + layer.bounds.height <= workflow.bounds.y + workflow.bounds.height, true);
});

test("addManualAnalysisLayer creates deterministic ids for repeated button layers", () => {
  const intake = selectIntakeSection(
    createIntakeWorkspace({
      uri: "/uploads/homepage.png",
      width: 1440,
      height: 1760
    }),
    "proof"
  );

  const once = addManualAnalysisLayer(intake, { kind: "button" });
  const twice = addManualAnalysisLayer(once, { kind: "button" });

  assert.deepEqual(
    twice.analysisPlan.sections.find((section) => section.id === "proof").layers.map((layer) => layer.id),
    ["proof-button-1", "proof-button-2"]
  );
  assert.equal(twice.selectedLayerId, "proof-button-2");
});

test("updateManualAnalysisLayer updates text, bounds, and image crop metadata", () => {
  const intake = addManualAnalysisLayer(
    selectIntakeSection(
      createIntakeWorkspace({
        uri: "/uploads/homepage.png",
        width: 1440,
        height: 1760
      }),
      "editor"
    ),
    { kind: "image" }
  );
  const cropBounds = { x: 830, y: 920, width: 280, height: 150 };

  const next = updateManualAnalysisLayer(intake, "editor-image-1", {
    bounds: { x: 820, y: 910, width: 300, height: 170 },
    alt: "Refined editor crop",
    asset: {
      id: "editor-image-1-asset",
      uri: "/assets/editor-crop.png",
      source: "reference-crop",
      cropBounds
    }
  });
  const layer = next.analysisPlan.sections.find((section) => section.id === "editor").layers[0];

  assert.deepEqual(layer.bounds, { x: 820, y: 910, width: 300, height: 170 });
  assert.equal(layer.alt, "Refined editor crop");
  assert.deepEqual(layer.asset.cropBounds, cropBounds);
  assert.equal(next.selectedLayerId, "editor-image-1");
  assert.equal(next.ready, true);
});

test("selectIntakeLayer changes the selected analysis layer", () => {
  const intake = addManualAnalysisLayer(
    addManualAnalysisLayer(
      createIntakeWorkspace({
        uri: "/uploads/homepage.png",
        width: 1440,
        height: 1760
      }),
      { kind: "text" }
    ),
    { kind: "button" }
  );

  const next = selectIntakeLayer(intake, "hero-text-1");

  assert.equal(next.selectedLayerId, "hero-text-1");
  assert.equal(intake.selectedLayerId, "hero-button-1");
});

test("manual analysis layers build into the editable LayerDoc workspace", () => {
  const intake = updateManualAnalysisLayer(
    addManualAnalysisLayer(
      selectIntakeSection(
        createIntakeWorkspace({
          uri: "/uploads/homepage.png",
          width: 1440,
          height: 1760
        }),
        "export"
      ),
      { kind: "button" }
    ),
    "export-button-1",
    { text: "Ship React component" }
  );

  const workspace = buildWorkspaceFromIntake(intake);

  assert.equal(workspace.doc.layers.some((layer) => layer.id === "export-button-1"), true);
  assert.equal(workspace.selectedLayerId, "export-button-1");
  assert.match(workspace.previewHtml, /Ship React component/);
  assert.match(workspace.reactExport.code, /Ship React component/);
});
