import assert from "node:assert/strict";
import test from "node:test";

import {
  addHeroAnnotationSet,
  buildWorkspaceFromIntake,
  createIntakeWorkspace,
  selectIntakeSection
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
