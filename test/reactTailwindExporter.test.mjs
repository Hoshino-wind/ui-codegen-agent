import assert from "node:assert/strict";
import test from "node:test";

import { createLayerDoc, exportReactTailwind } from "../dist/index.js";

test("exportReactTailwind turns LayerDoc sections into a React component with Tailwind classes", () => {
  const doc = createLayerDoc({
    name: "Marketing home",
    canvas: { width: 1440, height: 1200, background: "#f8fafc" },
    sections: [
      { id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 1440, height: 640 }, layerIds: ["headline", "cta", "cover"] }
    ],
    assets: [{ id: "cover-image", type: "image", source: "reference-crop", uri: "/assets/cover.png" }],
    layers: [
      {
        id: "headline",
        sectionId: "hero",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 120, y: 120, width: 620, height: 96 },
        content: { text: "Turn AI visuals into production UI" }
      },
      {
        id: "cta",
        sectionId: "hero",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 120, y: 260, width: 180, height: 48 },
        content: { text: "Start workflow" }
      },
      {
        id: "cover",
        sectionId: "hero",
        kind: "image",
        track: "asset",
        editable: true,
        bounds: { x: 820, y: 100, width: 420, height: 320 },
        assetId: "cover-image",
        content: { alt: "Generated landing page preview" }
      }
    ]
  });

  const output = exportReactTailwind(doc, { componentName: "MarketingHome" });

  assert.equal(output.fileName, "MarketingHome.tsx");
  assert.match(output.code, /export function MarketingHome/);
  assert.match(output.code, /data-section-id="hero"/);
  assert.match(output.code, /data-layer-id="headline"/);
  assert.match(output.code, /Turn AI visuals into production UI/);
  assert.match(output.code, /className="absolute/);
  assert.match(output.code, /src="\/assets\/cover\.png"/);
  assert.match(output.code, /alt="Generated landing page preview"/);
});

test("exportReactTailwind rejects invalid component names before writing project files", () => {
  const doc = createLayerDoc({ name: "Bad export", canvas: { width: 320, height: 240 } });

  assert.throws(
    () => exportReactTailwind(doc, { componentName: "marketing-home" }),
    /componentName must be a PascalCase identifier/
  );
});

test("exportReactTailwind preserves controlled layer styles in React style props", () => {
  const doc = createLayerDoc({
    name: "Styled export",
    canvas: { width: 640, height: 480 },
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
          borderRadius: 16,
          padding: { x: 24, y: 12 }
        },
        content: { text: "Export" }
      }
    ]
  });

  const output = exportReactTailwind(doc, { componentName: "StyledExport" });

  assert.match(output.code, /backgroundColor: "#111827"/);
  assert.match(output.code, /color: "#ffffff"/);
  assert.match(output.code, /borderRadius: 16/);
  assert.match(output.code, /padding: "12px 24px"/);
});

test("exportReactTailwind omits hidden sections while preserving them in LayerDoc", () => {
  const doc = createLayerDoc({
    name: "Hidden section export",
    canvas: { width: 960, height: 960 },
    sections: [
      { id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 960, height: 480 }, layerIds: ["headline"] },
      { id: "pricing", name: "Pricing", visible: false, bounds: { x: 0, y: 480, width: 960, height: 480 }, layerIds: ["price-card"] }
    ],
    layers: [
      {
        id: "headline",
        sectionId: "hero",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 80, y: 96, width: 520, height: 72 },
        content: { text: "Visible export" }
      },
      {
        id: "price-card",
        sectionId: "pricing",
        kind: "card",
        track: "component",
        editable: true,
        bounds: { x: 80, y: 560, width: 360, height: 180 },
        content: { text: "Hidden export" }
      }
    ]
  });

  const output = exportReactTailwind(doc, { componentName: "HiddenSectionExport" });

  assert.match(output.code, /data-section-id="hero"/);
  assert.match(output.code, /Visible export/);
  assert.doesNotMatch(output.code, /data-section-id="pricing"/);
  assert.doesNotMatch(output.code, /Hidden export/);
});
