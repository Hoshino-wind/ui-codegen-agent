import assert from "node:assert/strict";
import test from "node:test";

import {
  addManualAnalysisLayer,
  addHeroAnnotationSet,
  buildWorkspaceFromIntake,
  createIntakeWorkspace,
  createIntakeWorkspaceFromAnalysisPlanJson,
  materializeReferenceCropAssets,
  selectIntakeLayer,
  selectIntakeSection,
  seedHomepageAnnotations,
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
  assert.equal(intake.audit.readiness.readyForLayerDoc, false);
  assert.deepEqual(intake.audit.coverage.emptySectionIds, [
    "hero",
    "proof",
    "workflow",
    "features",
    "editor",
    "export",
    "verifier",
    "final-cta"
  ]);
});

test("createIntakeWorkspaceFromAnalysisPlanJson imports a saved plan for the current PNG", () => {
  const sourceImage = {
    uri: "/uploads/homepage.png",
    width: 1440,
    height: 1760
  };
  const original = addManualAnalysisLayer(createIntakeWorkspace(sourceImage), { kind: "text" });

  const imported = createIntakeWorkspaceFromAnalysisPlanJson(sourceImage, JSON.stringify(original.analysisPlan));

  assert.equal(imported.analysisPlan.name, original.analysisPlan.name);
  assert.equal(imported.layerCount, 1);
  assert.equal(imported.ready, true);
  assert.equal(imported.selectedSectionId, "hero");
  assert.equal(imported.selectedLayerId, "hero-text-1");
  assert.equal(imported.audit.summary.layers, 1);
  assert.equal(imported.audit.tracks.component, 1);
});

test("createIntakeWorkspaceFromAnalysisPlanJson rejects plans for a different PNG canvas", () => {
  const sourceImage = {
    uri: "/uploads/homepage.png",
    width: 1440,
    height: 1760
  };
  const original = createIntakeWorkspace(sourceImage);
  const mismatchedPlan = {
    ...original.analysisPlan,
    canvas: { ...original.analysisPlan.canvas, width: 1200 }
  };

  assert.throws(
    () => createIntakeWorkspaceFromAnalysisPlanJson(sourceImage, JSON.stringify(mismatchedPlan)),
    /Analysis Plan canvas 1200x1760 must match source image 1440x1760/
  );
});

test("createIntakeWorkspaceFromAnalysisPlanJson rejects malformed plan sections", () => {
  const sourceImage = {
    uri: "/uploads/homepage.png",
    width: 1440,
    height: 1760
  };
  const original = createIntakeWorkspace(sourceImage);
  const malformedPlan = {
    ...original.analysisPlan,
    sections: [{ id: "hero", name: "Hero" }]
  };

  assert.throws(
    () => createIntakeWorkspaceFromAnalysisPlanJson(sourceImage, JSON.stringify(malformedPlan)),
    /Input file is not a Homepage Analysis Plan/
  );
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
  const intake = seedHomepageAnnotations(
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
  assert.deepEqual(workspace.doc.metadata.analysisPlan, {
    source: "editor",
    name: "Imported Homepage",
    sectionCount: 8,
    layerCount: 18
  });
  assert.deepEqual(workspace.doc.metadata.analysisPlanAudit, intake.audit);
  assert.match(workspace.previewHtml, /Imported hero headline/);
  assert.equal(workspace.report.structureScore, 100);
});

test("buildWorkspaceFromIntake rejects an empty analysis scaffold before creating LayerDoc", () => {
  const intake = createIntakeWorkspace({
    uri: "/uploads/homepage.png",
    width: 1440,
    height: 1760
  });

  assert.throws(
    () => buildWorkspaceFromIntake(intake),
    /Cannot build LayerDoc from empty analysis plan: add at least one layer before building/
  );
});

test("buildWorkspaceFromIntake rejects homepage analysis plans with empty sections", () => {
  const intake = addHeroAnnotationSet(
    createIntakeWorkspace({
      uri: "/uploads/homepage.png",
      width: 1440,
      height: 1760
    })
  );

  assert.throws(
    () => buildWorkspaceFromIntake(intake),
    /Cannot build LayerDoc from incomplete analysis plan: add at least one layer to Proof, Workflow, Features, Editor, Export, Verifier, Final CTA/
  );
});

test("materializeReferenceCropAssets turns uploaded PNG crop plans into data URI LayerDoc assets", async () => {
  const intake = seedHomepageAnnotations(
    createIntakeWorkspace({
      uri: "uploaded-homepage.png",
      dataUri: "data:image/png;base64,c291cmNl",
      width: 1440,
      height: 1760
    })
  );
  const originalAsset = intake.analysisPlan.sections[0].layers.find((layer) => layer.id === "hero-image").asset;
  const cropCalls = [];

  const cropped = await materializeReferenceCropAssets(intake, async (input) => {
    cropCalls.push({
      sourceDataUri: input.sourceImage.dataUri,
      layerId: input.layer.id,
      assetId: input.layer.asset.id,
      cropBounds: input.cropBounds
    });
    return "data:image/png;base64,Y3JvcA==";
  });
  const workspace = buildWorkspaceFromIntake(cropped);
  const asset = workspace.doc.assets.find((candidate) => candidate.id === "hero-crop");

  assert.equal(originalAsset.uri, "/assets/hero-reference.svg");
  assert.equal(cropCalls.length, 1);
  assert.equal(cropCalls[0].sourceDataUri, "data:image/png;base64,c291cmNl");
  assert.equal(cropCalls[0].layerId, "hero-image");
  assert.equal(cropCalls[0].assetId, "hero-crop");
  assert.deepEqual(cropCalls[0].cropBounds, originalAsset.cropBounds);
  assert.equal(asset.uri, "data:image/png;base64,Y3JvcA==");
  assert.equal(asset.source, "reference-crop");
  assert.match(workspace.previewHtml, /data:image\/png;base64,Y3JvcA==/);
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

  assert.equal(intake.ready, true);
  assert.equal(heroImage.bounds.x + heroImage.bounds.width <= intake.sourceImage.width, true);
  assert.equal(heroImage.asset.cropBounds.x + heroImage.asset.cropBounds.width <= intake.sourceImage.width, true);
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
        seedHomepageAnnotations(
          createIntakeWorkspace({
            uri: "/uploads/homepage.png",
            width: 1440,
            height: 1760
          })
        ),
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

test("seedHomepageAnnotations adds editable layers across every homepage section without mutating the prior workspace", () => {
  const intake = createIntakeWorkspace({
    uri: "/uploads/homepage.png",
    width: 1440,
    height: 1760
  });

  const seeded = seedHomepageAnnotations(intake);

  assert.equal(intake.layerCount, 0);
  assert.equal(seeded.layerCount, 18);
  assert.equal(seeded.ready, true);
  assert.deepEqual(seeded.analysisPlan.sections.map((section) => section.layers.length), [4, 2, 2, 2, 2, 2, 2, 2]);
  assert.equal(seeded.selectedSectionId, "hero");
  assert.equal(seeded.selectedLayerId, "hero-title");
});

test("seedHomepageAnnotations is idempotent and keeps seeded bounds inside narrow PNG canvases", () => {
  const once = seedHomepageAnnotations(
    createIntakeWorkspace({
      uri: "/uploads/narrow-homepage.png",
      width: 640,
      height: 960
    })
  );
  const twice = seedHomepageAnnotations(once);

  assert.equal(twice.layerCount, 18);
  for (const section of twice.analysisPlan.sections) {
    for (const layer of section.layers) {
      assert.equal(layer.bounds.x >= 0, true);
      assert.equal(layer.bounds.y >= 0, true);
      assert.equal(layer.bounds.x + layer.bounds.width <= twice.sourceImage.width, true);
      assert.equal(layer.bounds.y + layer.bounds.height <= twice.sourceImage.height, true);
    }
  }
});

test("seedHomepageAnnotations builds into a LayerDoc with component and asset tracks", () => {
  const intake = seedHomepageAnnotations(
    createIntakeWorkspace({
      uri: "/uploads/homepage.png",
      width: 1440,
      height: 1760
    })
  );

  const workspace = buildWorkspaceFromIntake(intake);

  assert.equal(workspace.doc.layers.length, 18);
  assert.equal(workspace.doc.layers.filter((layer) => layer.track === "component").length, 17);
  assert.equal(workspace.doc.layers.filter((layer) => layer.track === "asset").length, 1);
  assert.match(workspace.previewHtml, /LayerDoc source of truth/);
  assert.match(workspace.reactExport.code, /Screenshot diff joins structural validation/);
});
