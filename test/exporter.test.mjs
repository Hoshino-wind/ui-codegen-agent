import assert from "node:assert/strict";
import test from "node:test";

import { createLayerDoc, renderHtmlPreview } from "../dist/index.js";

test("renderHtmlPreview emits editable DOM markers from LayerDoc layers", () => {
  const doc = createLayerDoc({
    name: "Preview",
    canvas: { width: 640, height: 480, background: "#ffffff" },
    layers: [
      {
        id: "headline",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 24, y: 32, width: 320, height: 48 },
        content: { text: "LayerDoc first" }
      },
      {
        id: "hero-art",
        kind: "image",
        track: "asset",
        editable: true,
        bounds: { x: 360, y: 32, width: 200, height: 160 },
        assetId: "asset-hero"
      }
    ],
    assets: [{ id: "asset-hero", type: "image", source: "generated", uri: "/hero.png" }]
  });

  const html = renderHtmlPreview(doc);

  assert.match(html, /data-layer-id="headline"/);
  assert.match(html, /LayerDoc first/);
  assert.match(html, /data-track="asset"/);
  assert.match(html, /src="\/hero.png"/);
  assert.match(html, /width:640px/);
});

test("renderHtmlPreview renders controlled layer styles into CSS", () => {
  const doc = createLayerDoc({
    name: "Styled preview",
    canvas: { width: 640, height: 480, background: "#ffffff" },
    layers: [
      {
        id: "cta",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 24, y: 32, width: 160, height: 48 },
        style: {
          backgroundColor: "#111827",
          textColor: "#ffffff",
          borderColor: "#22c55e",
          borderRadius: 14,
          padding: { x: 24, y: 12 },
          opacity: 0.9
        },
        content: { text: "Generate" }
      }
    ]
  });

  const html = renderHtmlPreview(doc);

  assert.match(html, /background-color:#111827/);
  assert.match(html, /color:#ffffff/);
  assert.match(html, /border-color:#22c55e/);
  assert.match(html, /border-radius:14px/);
  assert.match(html, /padding:12px 24px/);
  assert.match(html, /opacity:0.9/);
});

test("renderHtmlPreview preserves interaction metadata on rendered layers", () => {
  const doc = createLayerDoc({
    name: "Interactive preview",
    canvas: { width: 640, height: 480, background: "#ffffff" },
    layers: [
      {
        id: "hero-cta",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 24, y: 32, width: 160, height: 48 },
        content: { text: "Start" }
      }
    ],
    interactions: [{ id: "hero-cta-click", layerId: "hero-cta", event: "click", action: "open-checkout" }]
  });

  const html = renderHtmlPreview(doc);

  assert.match(html, /data-layer-id="hero-cta"/);
  assert.match(html, /data-interaction-ids="hero-cta-click"/);
  assert.match(html, /data-interaction-events="click"/);
  assert.match(html, /data-interaction-actions="open-checkout"/);
});

test("renderHtmlPreview omits layers that belong to hidden sections", () => {
  const doc = createLayerDoc({
    name: "Hidden section preview",
    canvas: { width: 640, height: 800, background: "#ffffff" },
    sections: [
      { id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 640, height: 400 }, layerIds: ["headline"] },
      { id: "pricing", name: "Pricing", visible: false, bounds: { x: 0, y: 400, width: 640, height: 400 }, layerIds: ["price-card"] }
    ],
    layers: [
      {
        id: "headline",
        sectionId: "hero",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 40, y: 40, width: 320, height: 48 },
        content: { text: "Visible headline" }
      },
      {
        id: "price-card",
        sectionId: "pricing",
        kind: "card",
        track: "component",
        editable: true,
        bounds: { x: 40, y: 460, width: 320, height: 160 },
        content: { text: "Hidden pricing" }
      }
    ]
  });

  const html = renderHtmlPreview(doc);

  assert.match(html, /Visible headline/);
  assert.doesNotMatch(html, /price-card/);
  assert.doesNotMatch(html, /Hidden pricing/);
});
