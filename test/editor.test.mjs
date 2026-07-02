import assert from "node:assert/strict";
import test from "node:test";

import {
  applySectionRegenerationCandidate,
  createLayerDoc,
  moveSection,
  requestSectionRegeneration,
  revertSectionRegenerationApplication,
  setSectionVisibility,
  updateButtonAction,
  updateImageLayerAsset,
  updateImageLayerAlt,
  updateLayerBounds,
  updateLayerStyle,
  updateTextLayer
} from "../dist/index.js";

test("updateTextLayer changes copy without mutating the original LayerDoc", () => {
  const doc = createLayerDoc({
    name: "Editable page",
    canvas: { width: 800, height: 600 },
    layers: [
      {
        id: "headline",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 40, y: 40, width: 320, height: 48 },
        content: { text: "Old headline" }
      }
    ]
  });

  const next = updateTextLayer(doc, "headline", "New headline");

  assert.equal(doc.layers[0].content.text, "Old headline");
  assert.equal(next.layers[0].content.text, "New headline");
});

test("moveSection reorders sections while keeping layer membership intact", () => {
  const doc = createLayerDoc({
    name: "Section order",
    canvas: { width: 800, height: 1200 },
    sections: [
      { id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 800, height: 400 }, layerIds: ["headline"] },
      { id: "proof", name: "Proof", bounds: { x: 0, y: 400, width: 800, height: 400 }, layerIds: ["metric"] },
      { id: "cta", name: "CTA", bounds: { x: 0, y: 800, width: 800, height: 400 }, layerIds: ["button"] }
    ],
    layers: [
      {
        id: "headline",
        sectionId: "hero",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 40, y: 48, width: 320, height: 48 },
        content: { text: "Hero" }
      },
      {
        id: "metric",
        sectionId: "proof",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 40, y: 448, width: 320, height: 48 },
        content: { text: "Proof" }
      },
      {
        id: "button",
        sectionId: "cta",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 40, y: 836, width: 160, height: 44 },
        content: { text: "Start" }
      }
    ]
  });

  const next = moveSection(doc, "cta", 0);

  assert.deepEqual(next.sections.map((section) => section.id), ["cta", "hero", "proof"]);
  assert.deepEqual(next.sections[0].layerIds, ["button"]);
  assert.deepEqual(next.sections.map((section) => [section.id, section.bounds.y]), [
    ["cta", 0],
    ["hero", 400],
    ["proof", 800]
  ]);
  assert.equal(next.layers.find((layer) => layer.id === "button").bounds.y, 36);
  assert.equal(next.layers.find((layer) => layer.id === "headline").bounds.y, 448);
  assert.equal(next.layers.find((layer) => layer.id === "metric").bounds.y, 848);
  assert.equal(doc.layers.find((layer) => layer.id === "button").bounds.y, 836);
});

test("setSectionVisibility hides a module without removing its editable layers", () => {
  const doc = createLayerDoc({
    name: "Visibility controls",
    canvas: { width: 800, height: 1200 },
    sections: [
      { id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 800, height: 400 }, layerIds: ["headline"] },
      { id: "proof", name: "Proof", bounds: { x: 0, y: 400, width: 800, height: 400 }, layerIds: ["metric"] }
    ],
    layers: [
      {
        id: "metric",
        sectionId: "proof",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 48, y: 460, width: 320, height: 40 },
        content: { text: "Trusted by product teams" }
      }
    ]
  });

  const next = setSectionVisibility(doc, "proof", false);

  assert.equal(doc.sections.find((section) => section.id === "proof").visible, undefined);
  assert.equal(next.sections.find((section) => section.id === "proof").visible, false);
  assert.equal(next.layers.find((layer) => layer.id === "metric").content.text, "Trusted by product teams");
});

test("requestSectionRegeneration queues an operator request without mutating the original LayerDoc", () => {
  const doc = createLayerDoc({
    name: "Regeneration controls",
    canvas: { width: 800, height: 1200 },
    sections: [
      { id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 800, height: 400 }, layerIds: ["headline"] }
    ]
  });

  const next = requestSectionRegeneration(doc, "hero", {
    prompt: "Make the hero feel more enterprise-grade while preserving layout.",
    requestedAt: "2026-06-30T10:00:00.000Z"
  });

  assert.equal(doc.generation.sectionRequests.length, 0);
  assert.deepEqual(next.generation.sectionRequests, [
    {
      id: "regen-hero-1",
      sectionId: "hero",
      prompt: "Make the hero feel more enterprise-grade while preserving layout.",
      status: "requested",
      requestedAt: "2026-06-30T10:00:00.000Z"
    }
  ]);
});

test("applySectionRegenerationCandidate replaces one section with a reviewed candidate", () => {
  const requested = requestSectionRegeneration(
    createLayerDoc({
      name: "Regeneration apply",
      canvas: { width: 800, height: 900 },
      sections: [
        { id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 800, height: 400 }, layerIds: ["headline", "old-art"] },
        { id: "proof", name: "Proof", bounds: { x: 0, y: 400, width: 800, height: 300 }, layerIds: ["metric"] }
      ],
      layers: [
        {
          id: "headline",
          sectionId: "hero",
          kind: "text",
          track: "component",
          editable: true,
          bounds: { x: 40, y: 48, width: 320, height: 48 },
          content: { text: "Old hero" }
        },
        {
          id: "old-art",
          sectionId: "hero",
          kind: "image",
          track: "asset",
          editable: true,
          assetId: "old-hero-asset",
          bounds: { x: 420, y: 48, width: 240, height: 160 }
        },
        {
          id: "metric",
          sectionId: "proof",
          kind: "text",
          track: "component",
          editable: true,
          bounds: { x: 40, y: 448, width: 320, height: 48 },
          content: { text: "Proof" }
        }
      ],
      assets: [{ id: "old-hero-asset", type: "image", source: "generated", uri: "/old.png" }],
      components: [
        { id: "OldHero", layerIds: ["headline"], exportable: true },
        { id: "ProofMetric", layerIds: ["metric"], exportable: true }
      ],
      interactions: [{ id: "headline-click", layerId: "headline", event: "click", action: "old-action" }],
      responsive: {
        rules: [
          {
            id: "old-hero-mobile",
            query: "(max-width: 640px)",
            target: { type: "layer", id: "headline" },
            changes: { bounds: { x: 24, y: 40, width: 280, height: 60 } }
          },
          {
            id: "proof-mobile",
            query: "(max-width: 640px)",
            target: { type: "layer", id: "metric" },
            changes: { bounds: { x: 24, y: 420, width: 280, height: 48 } }
          }
        ]
      }
    }),
    "hero",
    {
      prompt: "Regenerate hero as a sharper production story.",
      requestedAt: "2026-07-01T08:00:00.000Z"
    }
  );

  const candidate = {
    requestId: "regen-hero-1",
    section: { id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 800, height: 360 }, layerIds: ["hero-title", "hero-cta", "hero-art"] },
    layers: [
      {
        id: "hero-title",
        sectionId: "hero",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 56, y: 32, width: 420, height: 72 },
        content: { text: "Regenerated production hero" }
      },
      {
        id: "hero-cta",
        sectionId: "hero",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 56, y: 128, width: 160, height: 48 },
        content: { text: "Ship it" }
      },
      {
        id: "hero-art",
        sectionId: "hero",
        kind: "image",
        track: "asset",
        editable: true,
        assetId: "new-hero-asset",
        bounds: { x: 480, y: 36, width: 240, height: 160 },
        content: { alt: "Reviewed hero visual" }
      }
    ],
    assets: [{ id: "new-hero-asset", type: "image", source: "generated", uri: "/new.png" }],
    components: [{ id: "RegeneratedHero", layerIds: ["hero-title", "hero-cta"], exportable: true }],
    interactions: [{ id: "hero-cta-click", layerId: "hero-cta", event: "click", action: "open-signup" }],
    responsiveRules: [
      {
        id: "new-hero-mobile",
        query: "(max-width: 640px)",
        target: { type: "layer", id: "hero-title" },
        changes: { bounds: { x: 24, y: 40, width: 280, height: 80 } }
      }
    ]
  };
  const next = applySectionRegenerationCandidate(requested, "hero", candidate, {
    appliedAt: "2026-07-01T08:05:00.000Z"
  });

  assert.equal(requested.layers.some((layer) => layer.id === "hero-title"), false);
  assert.deepEqual(next.sections.map((section) => [section.id, section.bounds.y, section.bounds.height]), [
    ["hero", 0, 360],
    ["proof", 360, 300]
  ]);
  assert.deepEqual(next.sections.find((section) => section.id === "hero").layerIds, ["hero-title", "hero-cta", "hero-art"]);
  assert.equal(next.layers.some((layer) => layer.id === "headline"), false);
  assert.equal(next.assets.some((asset) => asset.id === "old-hero-asset"), false);
  assert.equal(next.layers.find((layer) => layer.id === "hero-title").bounds.y, 32);
  assert.equal(next.layers.find((layer) => layer.id === "metric").bounds.y, 408);
  assert.equal(next.assets.find((asset) => asset.id === "new-hero-asset").uri, "/new.png");
  assert.deepEqual(next.components.map((component) => component.id), ["ProofMetric", "RegeneratedHero"]);
  assert.deepEqual(next.interactions, [{ id: "hero-cta-click", layerId: "hero-cta", event: "click", action: "open-signup" }]);
  assert.deepEqual(next.responsive.rules.map((rule) => rule.id), ["proof-mobile", "new-hero-mobile"]);
  assert.equal(next.generation.sectionRequests[0].status, "applied");
  assert.deepEqual(next.generation.sectionApplications.map((application) => ({
    id: application.id,
    sectionId: application.sectionId,
    requestId: application.requestId,
    status: application.status,
    appliedAt: application.appliedAt,
    previousLayerIds: application.previous.section.layerIds,
    appliedLayerIds: application.applied.section.layerIds
  })), [
    {
      id: "apply-regen-hero-1",
      sectionId: "hero",
      requestId: "regen-hero-1",
      status: "applied",
      appliedAt: "2026-07-01T08:05:00.000Z",
      previousLayerIds: ["headline", "old-art"],
      appliedLayerIds: ["hero-title", "hero-cta", "hero-art"]
    }
  ]);

  const reverted = revertSectionRegenerationApplication(next, "apply-regen-hero-1", {
    revertedAt: "2026-07-01T08:10:00.000Z"
  });

  assert.equal(next.generation.sectionApplications[0].status, "applied");
  assert.deepEqual(reverted.sections.map((section) => [section.id, section.bounds.y, section.bounds.height]), [
    ["hero", 0, 400],
    ["proof", 400, 300]
  ]);
  assert.deepEqual(reverted.sections.find((section) => section.id === "hero").layerIds, ["headline", "old-art"]);
  assert.equal(reverted.layers.some((layer) => layer.id === "hero-title"), false);
  assert.equal(reverted.layers.find((layer) => layer.id === "headline").content.text, "Old hero");
  assert.equal(reverted.layers.find((layer) => layer.id === "metric").bounds.y, 448);
  assert.equal(reverted.assets.some((asset) => asset.id === "new-hero-asset"), false);
  assert.equal(reverted.assets.find((asset) => asset.id === "old-hero-asset").uri, "/old.png");
  assert.deepEqual(reverted.components.map((component) => component.id), ["ProofMetric", "OldHero"]);
  assert.deepEqual(reverted.interactions, [{ id: "headline-click", layerId: "headline", event: "click", action: "old-action" }]);
  assert.deepEqual(reverted.responsive.rules.map((rule) => rule.id), ["proof-mobile", "old-hero-mobile"]);
  assert.equal(reverted.generation.sectionRequests[0].status, "reverted");
  assert.equal(reverted.generation.sectionApplications[0].status, "reverted");
  assert.equal(reverted.generation.sectionApplications[0].revertedAt, "2026-07-01T08:10:00.000Z");
});

test("revertSectionRegenerationApplication requires reverting the latest applied section candidate first", () => {
  const doc = createLayerDoc({
    name: "Sequential regeneration",
    canvas: { width: 800, height: 400 },
    sections: [{ id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 800, height: 400 }, layerIds: ["hero-original"] }],
    layers: [
      {
        id: "hero-original",
        sectionId: "hero",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 40, y: 40, width: 300, height: 48 },
        content: { text: "Original hero" }
      }
    ]
  });
  const first = applySectionRegenerationCandidate(doc, "hero", {
    section: { id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 800, height: 400 }, layerIds: ["hero-v1"] },
    layers: [
      {
        id: "hero-v1",
        sectionId: "hero",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 40, y: 40, width: 300, height: 48 },
        content: { text: "Hero v1" }
      }
    ]
  });
  const second = applySectionRegenerationCandidate(first, "hero", {
    section: { id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 800, height: 400 }, layerIds: ["hero-v2"] },
    layers: [
      {
        id: "hero-v2",
        sectionId: "hero",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 40, y: 40, width: 300, height: 48 },
        content: { text: "Hero v2" }
      }
    ]
  });

  assert.throws(
    () => revertSectionRegenerationApplication(second, "apply-hero"),
    /cannot be reverted before newer application "apply-hero-2"/
  );

  const revertedLatest = revertSectionRegenerationApplication(second, "apply-hero-2");

  assert.equal(revertedLatest.layers.some((layer) => layer.id === "hero-v1"), true);
  assert.equal(revertedLatest.layers.some((layer) => layer.id === "hero-v2"), false);
  assert.deepEqual(revertedLatest.generation.sectionApplications.map((application) => [application.id, application.status]), [
    ["apply-hero", "applied"],
    ["apply-hero-2", "reverted"]
  ]);
});

test("updateLayerStyle merges controlled visual style without mutating the original LayerDoc", () => {
  const doc = createLayerDoc({
    name: "Style controls",
    canvas: { width: 800, height: 600 },
    layers: [
      {
        id: "cta",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 40, y: 40, width: 160, height: 48 },
        style: { backgroundColor: "#e2e8f0", borderRadius: 8 },
        content: { text: "Start" }
      }
    ]
  });

  const next = updateLayerStyle(doc, "cta", {
    backgroundColor: "#111827",
    textColor: "#ffffff",
    borderRadius: 16,
    padding: { x: 24, y: 12 }
  });

  assert.equal(doc.layers[0].style.backgroundColor, "#e2e8f0");
  assert.equal(doc.layers[0].style.borderRadius, 8);
  assert.deepEqual(next.layers[0].style, {
    backgroundColor: "#111827",
    borderRadius: 16,
    textColor: "#ffffff",
    padding: { x: 24, y: 12 }
  });
});

test("updateImageLayerAsset replaces an image layer asset without mutating the original LayerDoc", () => {
  const doc = createLayerDoc({
    name: "Image controls",
    canvas: { width: 800, height: 600 },
    assets: [{ id: "hero-crop", type: "image", source: "reference-crop", uri: "/old.png" }],
    layers: [
      {
        id: "hero-image",
        kind: "image",
        track: "asset",
        editable: true,
        bounds: { x: 420, y: 40, width: 280, height: 180 },
        assetId: "hero-crop"
      }
    ]
  });

  const next = updateImageLayerAsset(doc, "hero-image", {
    uri: "/new.png",
    source: "uploaded"
  });

  assert.equal(doc.assets[0].uri, "/old.png");
  assert.equal(doc.assets[0].source, "reference-crop");
  assert.equal(next.assets[0].uri, "/new.png");
  assert.equal(next.assets[0].source, "uploaded");
});

test("updateImageLayerAlt changes image alt text without mutating the original LayerDoc", () => {
  const doc = createLayerDoc({
    name: "Image alt controls",
    canvas: { width: 800, height: 600 },
    assets: [{ id: "hero-crop", type: "image", source: "reference-crop", uri: "/hero.png" }],
    layers: [
      {
        id: "hero-image",
        kind: "image",
        track: "asset",
        editable: true,
        bounds: { x: 420, y: 40, width: 280, height: 180 },
        assetId: "hero-crop",
        content: { alt: "Old hero image" }
      }
    ]
  });

  const next = updateImageLayerAlt(doc, "hero-image", "Generated dashboard preview");

  assert.equal(doc.layers[0].content.alt, "Old hero image");
  assert.equal(next.layers[0].content.alt, "Generated dashboard preview");
});

test("updateLayerBounds patches geometry for spacing controls while preserving existing dimensions", () => {
  const doc = createLayerDoc({
    name: "Bounds controls",
    canvas: { width: 800, height: 600 },
    layers: [
      {
        id: "card",
        kind: "card",
        track: "component",
        editable: true,
        bounds: { x: 40, y: 40, width: 240, height: 160 }
      }
    ]
  });

  const next = updateLayerBounds(doc, "card", { x: 72, y: 96 });

  assert.deepEqual(doc.layers[0].bounds, { x: 40, y: 40, width: 240, height: 160 });
  assert.deepEqual(next.layers[0].bounds, { x: 72, y: 96, width: 240, height: 160 });
});

test("updateButtonAction edits a button click interaction without mutating the original LayerDoc", () => {
  const doc = createLayerDoc({
    name: "Button action controls",
    canvas: { width: 800, height: 600 },
    layers: [
      {
        id: "hero-cta",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 40, y: 40, width: 180, height: 48 },
        content: { text: "Start" }
      }
    ]
  });

  const created = updateButtonAction(doc, "hero-cta", "open-checkout");
  const updated = updateButtonAction(created, "hero-cta", "open-enterprise-demo");
  const cleared = updateButtonAction(updated, "hero-cta", " ");

  assert.equal(doc.interactions.length, 0);
  assert.deepEqual(created.interactions, [
    {
      id: "hero-cta-click",
      layerId: "hero-cta",
      event: "click",
      action: "open-checkout"
    }
  ]);
  assert.deepEqual(updated.interactions, [
    {
      id: "hero-cta-click",
      layerId: "hero-cta",
      event: "click",
      action: "open-enterprise-demo"
    }
  ]);
  assert.equal(cleared.interactions.length, 0);
});
