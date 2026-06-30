import assert from "node:assert/strict";
import test from "node:test";

import { createLayerDoc, createLayerDocAudit } from "../dist/index.js";

test("createLayerDocAudit summarizes editable structure and LayerDoc tracks", () => {
  const doc = createLayerDoc({
    name: "Audited homepage",
    canvas: { width: 1000, height: 1000 },
    sections: [
      { id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 1000, height: 600 }, layerIds: ["headline", "hero-art"] },
      { id: "proof", name: "Proof", bounds: { x: 0, y: 600, width: 1000, height: 400 }, layerIds: ["cta", "metrics-chart"] }
    ],
    assets: [{ id: "hero-art-asset", type: "image", source: "generated", bounds: { x: 700, y: 120, width: 200, height: 200 } }],
    components: [{ id: "HeroSection", layerIds: ["headline", "cta"], exportable: true }],
    layers: [
      {
        id: "headline",
        sectionId: "hero",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 80, y: 80, width: 420, height: 72 },
        content: { text: "LayerDoc-first" }
      },
      {
        id: "hero-art",
        sectionId: "hero",
        kind: "image",
        track: "asset",
        editable: true,
        bounds: { x: 700, y: 120, width: 200, height: 200 },
        assetId: "hero-art-asset"
      },
      {
        id: "cta",
        sectionId: "proof",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 80, y: 680, width: 160, height: 48 },
        content: { text: "Export" }
      },
      {
        id: "metrics-chart",
        sectionId: "proof",
        kind: "chart",
        track: "approximation",
        editable: false,
        bounds: { x: 300, y: 650, width: 320, height: 180 }
      }
    ]
  });

  const audit = createLayerDocAudit(doc);

  assert.deepEqual(audit.summary, {
    sections: 2,
    layers: 4,
    editableLayers: 3,
    components: 1,
    exportableComponents: 1,
    assets: 1,
    interactions: 0,
    responsiveRules: 0
  });
  assert.deepEqual(audit.tracks, { component: 2, asset: 1, approximation: 1, layout: 0 });
  assert.equal(audit.structure.valid, true);
  assert.deepEqual(audit.structure.issues, []);
  assert.equal(audit.assetCompliance.passed, true);
  assert.equal(audit.assetCompliance.assetCoverageRatio, 0.04);
  assert.equal(audit.assetCompliance.fullPageBitmapRisk, false);
  assert.deepEqual(audit.assetCompliance.riskyAssets, []);
  assert.deepEqual(
    audit.sectionBreakdown.map((section) => [section.sectionId, section.layerCount, section.editableLayerCount, section.tracks]),
    [
      ["hero", 2, 2, { component: 1, asset: 1, approximation: 0, layout: 0 }],
      ["proof", 2, 1, { component: 1, asset: 0, approximation: 1, layout: 0 }]
    ]
  );
});

test("createLayerDocAudit flags full-page bitmap assets as non-compliant", () => {
  const doc = createLayerDoc({
    name: "Bitmap shortcut",
    canvas: { width: 1000, height: 1000 },
    sections: [{ id: "page", name: "Page", bounds: { x: 0, y: 0, width: 1000, height: 1000 }, layerIds: ["page-shot"] }],
    assets: [{ id: "page-shot-asset", type: "image", source: "uploaded", bounds: { x: 0, y: 0, width: 1000, height: 1000 } }],
    layers: [
      {
        id: "page-shot",
        sectionId: "page",
        kind: "image",
        track: "asset",
        editable: false,
        bounds: { x: 0, y: 0, width: 1000, height: 1000 },
        assetId: "page-shot-asset"
      }
    ]
  });

  const audit = createLayerDocAudit(doc);

  assert.equal(audit.assetCompliance.passed, false);
  assert.equal(audit.assetCompliance.assetCoverageRatio, 1);
  assert.equal(audit.assetCompliance.fullPageBitmapRisk, true);
  assert.deepEqual(audit.assetCompliance.riskyAssets, [{ id: "page-shot-asset", coverageRatio: 1 }]);
  assert.match(audit.assetCompliance.findings[0], /full-page bitmap/i);
});

test("createLayerDocAudit flags section-sized bitmap shortcuts as non-compliant", () => {
  const doc = createLayerDoc({
    name: "Section bitmap shortcuts",
    canvas: { width: 1000, height: 1600 },
    sections: [
      { id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 1000, height: 400 }, layerIds: ["hero-shot"] },
      { id: "proof", name: "Proof", bounds: { x: 0, y: 400, width: 1000, height: 400 }, layerIds: ["proof-shot"] },
      { id: "cta", name: "CTA", bounds: { x: 0, y: 800, width: 1000, height: 400 }, layerIds: ["cta-copy"] },
      { id: "footer", name: "Footer", bounds: { x: 0, y: 1200, width: 1000, height: 400 }, layerIds: ["footer-copy"] }
    ],
    assets: [
      { id: "hero-shot-asset", type: "image", source: "uploaded", bounds: { x: 0, y: 0, width: 1000, height: 400 } },
      { id: "proof-shot-asset", type: "image", source: "uploaded", bounds: { x: 0, y: 400, width: 1000, height: 400 } }
    ],
    layers: [
      {
        id: "hero-shot",
        sectionId: "hero",
        kind: "image",
        track: "asset",
        editable: false,
        bounds: { x: 0, y: 0, width: 1000, height: 400 },
        assetId: "hero-shot-asset"
      },
      {
        id: "proof-shot",
        sectionId: "proof",
        kind: "image",
        track: "asset",
        editable: false,
        bounds: { x: 0, y: 400, width: 1000, height: 400 },
        assetId: "proof-shot-asset"
      },
      {
        id: "cta-copy",
        sectionId: "cta",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 80, y: 920, width: 420, height: 48 },
        content: { text: "Real editable CTA" }
      },
      {
        id: "footer-copy",
        sectionId: "footer",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 80, y: 1320, width: 420, height: 48 },
        content: { text: "Real editable footer" }
      }
    ]
  });

  const audit = createLayerDocAudit(doc);

  assert.equal(audit.assetCompliance.passed, false);
  assert.equal(audit.assetCompliance.fullPageBitmapRisk, false);
  assert.deepEqual(audit.assetCompliance.riskySectionAssets, [
    { sectionId: "hero", assetId: "hero-shot-asset", coverageRatio: 1 },
    { sectionId: "proof", assetId: "proof-shot-asset", coverageRatio: 1 }
  ]);
  assert.match(audit.assetCompliance.findings.join(" "), /section bitmap shortcut/i);
});
