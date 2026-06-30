import assert from "node:assert/strict";
import test from "node:test";

import { createLayerDocFromImageManifest, validateLayerDoc } from "../dist/index.js";

function makeSection(index) {
  return {
    id: `section-${index}`,
    name: `Section ${index}`,
    bounds: { x: 0, y: index * 120, width: 1440, height: 120 },
    layers: [
      {
        id: `section-${index}-title`,
        kind: "text",
        bounds: { x: 80, y: index * 120 + 24, width: 420, height: 40 },
        text: `Title ${index}`
      }
    ]
  };
}

test("createLayerDocFromImageManifest converts image analysis sections into a valid LayerDoc", () => {
  const manifest = {
    name: "AI homepage",
    sourceImage: { uri: "/references/home.png", width: 1440, height: 1200 },
    canvas: { width: 1440, height: 1200, background: "#f8fafc" },
    sections: [
      {
        id: "hero",
        name: "Hero",
        bounds: { x: 0, y: 0, width: 1440, height: 300 },
        layers: [
          {
            id: "hero-title",
            kind: "text",
            bounds: { x: 120, y: 80, width: 620, height: 72 },
            text: "Launch beautiful UI",
            style: {
              textColor: "#0f172a",
              fontSize: 56,
              fontWeight: 860,
              opacity: 0.96
            }
          },
          {
            id: "hero-cta",
            kind: "button",
            bounds: { x: 120, y: 180, width: 160, height: 48 },
            text: "Generate"
          },
          {
            id: "hero-image",
            kind: "image",
            bounds: { x: 820, y: 40, width: 420, height: 220 },
            asset: { id: "hero-crop", uri: "/assets/hero-crop.png", source: "reference-crop" },
            alt: "Hero product preview"
          }
        ]
      },
      ...Array.from({ length: 7 }, (_, index) => makeSection(index + 1))
    ]
  };

  const doc = createLayerDocFromImageManifest(manifest);
  const validation = validateLayerDoc(doc);

  assert.equal(doc.metadata.name, "AI homepage");
  assert.equal(doc.sections.length, 8);
  assert.equal(doc.assets[0].id, "hero-crop");
  assert.equal(doc.layers.find((layer) => layer.id === "hero-title").track, "component");
  assert.deepEqual(doc.layers.find((layer) => layer.id === "hero-title").style, {
    textColor: "#0f172a",
    fontSize: 56,
    fontWeight: 860,
    opacity: 0.96
  });
  assert.equal(doc.layers.find((layer) => layer.id === "hero-image").track, "asset");
  assert.equal(doc.components.some((component) => component.id === "HeroSection"), true);
  assert.equal(validation.valid, true);
});

test("createLayerDocFromImageManifest enforces the homepage MVP section range", () => {
  const manifest = {
    name: "Too small",
    sourceImage: { uri: "/references/small.png", width: 1440, height: 800 },
    canvas: { width: 1440, height: 800 },
    sections: [makeSection(1), makeSection(2)]
  };

  assert.throws(
    () => createLayerDocFromImageManifest(manifest, { enforceHomepageRange: true }),
    /Homepage MVP expects 8-15 sections/
  );
});

test("createLayerDocFromImageManifest rejects homepage sections without layers", () => {
  const manifest = {
    name: "Incomplete homepage",
    sourceImage: { uri: "/references/incomplete.png", width: 1440, height: 960 },
    canvas: { width: 1440, height: 960 },
    sections: [
      makeSection(0),
      makeSection(1),
      { ...makeSection(2), layers: [] },
      ...Array.from({ length: 5 }, (_, index) => makeSection(index + 3))
    ]
  };

  assert.throws(
    () => createLayerDocFromImageManifest(manifest),
    /Homepage MVP section "Section 2" must contain at least one layer/
  );
});
