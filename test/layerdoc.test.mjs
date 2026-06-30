import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyLayer,
  createLayerDoc,
  scoreProjectFit,
  validateLayerDoc
} from "../dist/index.js";

test("createLayerDoc returns a complete editable production asset shell", () => {
  const doc = createLayerDoc({
    name: "Landing page concept",
    canvas: { width: 1440, height: 1200 }
  });

  assert.equal(doc.schema, "layerdoc");
  assert.equal(doc.version, "0.1.0");
  assert.deepEqual(Object.keys(doc).sort(), [
    "assets",
    "canvas",
    "components",
    "generation",
    "interactions",
    "layers",
    "metadata",
    "responsive",
    "schema",
    "sections",
    "tokens",
    "verification",
    "version"
  ]);
  assert.equal(doc.metadata.name, "Landing page concept");
  assert.deepEqual(doc.generation.sectionRequests, []);
  assert.equal(doc.verification.scores.visualSimilarity, null);
});

test("classifyLayer maps production layer kinds to controlled tracks", () => {
  assert.equal(classifyLayer({ kind: "text" }), "component");
  assert.equal(classifyLayer({ kind: "button" }), "component");
  assert.equal(classifyLayer({ kind: "image" }), "asset");
  assert.equal(classifyLayer({ kind: "chart" }), "approximation");
  assert.equal(classifyLayer({ kind: "section" }), "layout");
});

test("validateLayerDoc rejects missing references and out-of-canvas geometry", () => {
  const doc = createLayerDoc({
    name: "Broken doc",
    canvas: { width: 320, height: 240 },
    sections: [
      { id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 320, height: 240 }, layerIds: ["headline", "cover"] }
    ],
    layers: [
      {
        id: "headline",
        sectionId: "hero",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 20, y: 20, width: 800, height: 32 },
        content: { text: "Hello" }
      },
      {
        id: "cover",
        sectionId: "hero",
        kind: "image",
        track: "asset",
        editable: true,
        bounds: { x: 20, y: 80, width: 120, height: 120 },
        assetId: "missing-asset"
      }
    ]
  });

  const result = validateLayerDoc(doc);

  assert.equal(result.valid, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.code).sort(),
    ["asset_missing", "bounds_outside_canvas"]
  );
});

test("validateLayerDoc rejects visible sections without editable layers", () => {
  const doc = createLayerDoc({
    name: "Empty visible section",
    canvas: { width: 320, height: 240 },
    sections: [{ id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 320, height: 240 }, layerIds: [] }]
  });

  const result = validateLayerDoc(doc);

  assert.equal(result.valid, false);
  assert.deepEqual(result.issues[0], {
    code: "section_empty",
    path: "sections[0].layerIds",
    message: 'Visible section "hero" must contain at least one layer.'
  });
});

test("validateLayerDoc rejects mismatched section layer membership", () => {
  const doc = createLayerDoc({
    name: "Membership mismatch",
    canvas: { width: 320, height: 240 },
    sections: [
      { id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 320, height: 120 }, layerIds: ["headline", "cta"] },
      { id: "proof", name: "Proof", bounds: { x: 0, y: 120, width: 320, height: 120 }, layerIds: ["quote"] }
    ],
    layers: [
      {
        id: "headline",
        sectionId: "hero",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 20, y: 20, width: 180, height: 32 },
        content: { text: "Hello" }
      },
      {
        id: "cta",
        sectionId: "proof",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 20, y: 72, width: 120, height: 32 },
        content: { text: "Start" }
      },
      {
        id: "quote",
        sectionId: "hero",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 20, y: 148, width: 220, height: 32 },
        content: { text: "Trusted" }
      }
    ]
  });

  const result = validateLayerDoc(doc);

  assert.equal(result.valid, false);
  assert.deepEqual(
    result.issues.map((issue) => [issue.code, issue.path]),
    [
      ["layer_section_mismatch", "sections[0].layerIds"],
      ["layer_section_mismatch", "sections[1].layerIds"],
      ["layer_section_mismatch", "layers[1].sectionId"],
      ["layer_section_mismatch", "layers[2].sectionId"]
    ]
  );
});

test("validateLayerDoc rejects responsive rules that target missing objects", () => {
  const doc = createLayerDoc({
    name: "Responsive target mismatch",
    canvas: { width: 320, height: 240 },
    sections: [{ id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 320, height: 240 }, layerIds: ["headline"] }],
    layers: [
      {
        id: "headline",
        sectionId: "hero",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 20, y: 20, width: 180, height: 32 },
        content: { text: "Hello" }
      }
    ],
    responsive: {
      rules: [
        {
          id: "mobile-cta",
          query: "(max-width: 640px)",
          target: { type: "layer", id: "cta" },
          changes: { bounds: { width: 280 } }
        },
        {
          id: "mobile-pricing",
          query: "(max-width: 640px)",
          target: { type: "component", id: "PricingSection" },
          changes: { visible: false }
        }
      ]
    }
  });

  const result = validateLayerDoc(doc);

  assert.equal(result.valid, false);
  assert.deepEqual(
    result.issues.map((issue) => [issue.code, issue.path]),
    [
      ["responsive_target_missing", "responsive.rules[0].target.id"],
      ["responsive_target_missing", "responsive.rules[1].target.id"]
    ]
  );
});

test("validateLayerDoc rejects regeneration requests for missing sections", () => {
  const doc = createLayerDoc({
    name: "Broken regeneration",
    canvas: { width: 320, height: 240 },
    generation: {
      sectionRequests: [
        {
          id: "regen-pricing-1",
          sectionId: "pricing",
          prompt: "Regenerate pricing",
          status: "requested",
          requestedAt: "2026-06-30T10:00:00.000Z"
        }
      ]
    }
  });

  const result = validateLayerDoc(doc);

  assert.equal(result.valid, false);
  assert.equal(result.issues[0].code, "section_missing");
  assert.equal(result.issues[0].path, "generation.sectionRequests[0].sectionId");
});

test("validateLayerDoc rejects component and interaction references to missing layers", () => {
  const doc = createLayerDoc({
    name: "Broken graph references",
    canvas: { width: 320, height: 240 },
    components: [{ id: "HeroSection", layerIds: ["missing-headline"], exportable: true }],
    interactions: [{ id: "hero-click", layerId: "missing-cta", event: "click", action: "open-checkout" }]
  });

  const result = validateLayerDoc(doc);

  assert.equal(result.valid, false);
  assert.deepEqual(
    result.issues.map((issue) => [issue.code, issue.path]),
    [
      ["layer_missing", "components[0].layerIds"],
      ["layer_missing", "interactions[0].layerId"]
    ]
  );
});

test("validateLayerDoc rejects duplicate regeneration request ids", () => {
  const doc = createLayerDoc({
    name: "Duplicate regeneration",
    canvas: { width: 320, height: 240 },
    sections: [{ id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 320, height: 240 }, layerIds: [] }],
    generation: {
      sectionRequests: [
        {
          id: "regen-hero-1",
          sectionId: "hero",
          prompt: "First",
          status: "requested",
          requestedAt: "2026-06-30T10:00:00.000Z"
        },
        {
          id: "regen-hero-1",
          sectionId: "hero",
          prompt: "Second",
          status: "requested",
          requestedAt: "2026-06-30T10:01:00.000Z"
        }
      ]
    }
  });

  const result = validateLayerDoc(doc);

  assert.equal(result.valid, false);
  assert.equal(result.issues[0].code, "duplicate_id");
  assert.equal(result.issues[0].path, "regen-hero-1");
});

test("validateLayerDoc rejects duplicate interaction ids in the LayerDoc graph", () => {
  const doc = createLayerDoc({
    name: "Duplicate interactions",
    canvas: { width: 320, height: 240 },
    layers: [
      {
        id: "cta",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 24, y: 24, width: 120, height: 44 },
        content: { text: "Start" }
      }
    ],
    interactions: [
      { id: "cta-click", layerId: "cta", event: "click", action: "open-modal" },
      { id: "cta-click", layerId: "cta", event: "hover", action: "preview-modal" }
    ]
  });

  const result = validateLayerDoc(doc);

  assert.equal(result.valid, false);
  assert.equal(result.issues[0].code, "duplicate_id");
  assert.equal(result.issues[0].path, "cta-click");
});

test("scoreProjectFit rewards reusable components and penalizes full-page bitmap output", () => {
  const doc = createLayerDoc({
    name: "Project fit",
    canvas: { width: 1000, height: 1000 },
    assets: [{ id: "hero-art", type: "image", source: "generated", bounds: { x: 100, y: 100, width: 200, height: 200 } }],
    components: [
      { id: "HeroSection", layerIds: ["headline"], exportable: true },
      { id: "CTAButton", layerIds: ["cta"], exportable: true }
    ],
    layers: [
      {
        id: "headline",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 120, y: 120, width: 300, height: 48 },
        content: { text: "Ship UI" }
      },
      {
        id: "cta",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 120, y: 190, width: 140, height: 44 },
        content: { text: "Start" }
      }
    ]
  });

  const score = scoreProjectFit(doc);

  assert.equal(score.projectFitScore, 90);
  assert.equal(score.assetCoverageRatio, 0.04);
  assert.equal(score.fullPageBitmapRisk, false);
});
