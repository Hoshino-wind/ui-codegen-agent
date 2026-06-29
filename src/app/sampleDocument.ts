import { createLayerDoc } from "../layerdoc/factory.js";
import type { LayerDoc, LayerNode, SectionNode } from "../layerdoc/types.js";

const sectionHeight = 220;

function section(id: string, name: string, index: number, layerIds: string[]): SectionNode {
  return {
    id,
    name,
    bounds: { x: 0, y: index * sectionHeight, width: 1440, height: sectionHeight },
    layerIds
  };
}

function textLayer(id: string, sectionId: string, text: string, x: number, y: number, width = 520): LayerNode {
  return {
    id,
    sectionId,
    kind: "text",
    track: "component",
    editable: true,
    bounds: { x, y, width, height: 48 },
    style: { textColor: "#111827" },
    content: { text }
  };
}

/**
 * Seed document for the MVP editor console.
 * It intentionally has eight real sections so ingestion, editing, preview,
 * export, and verification all exercise the homepage target shape.
 */
export function createSampleHomepageLayerDoc(): LayerDoc {
  return createLayerDoc({
    name: "Production Homepage",
    canvas: { width: 1440, height: sectionHeight * 8, background: "#f8fafc" },
    tokens: {
      colors: {
        canvas: "#f8fafc",
        text: "#111827",
        accent: "#14b8a6"
      }
    },
    assets: [
      {
        id: "asset-hero",
        type: "image",
        source: "reference-crop",
        uri: "/assets/hero-reference.svg",
        bounds: { x: 860, y: 48, width: 420, height: 150 }
      }
    ],
    sections: [
      section("hero", "Hero", 0, ["hero-title", "hero-copy", "hero-cta", "hero-image"]),
      section("proof", "Proof", 1, ["proof-title", "proof-stat"]),
      section("workflow", "Workflow", 2, ["workflow-title", "workflow-card"]),
      section("layers", "LayerDoc", 3, ["layers-title", "layers-card"]),
      section("editor", "Editor", 4, ["editor-title", "editor-card"]),
      section("export", "Export", 5, ["export-title", "export-card"]),
      section("verifier", "Verifier", 6, ["verifier-title", "verifier-card"]),
      section("final-cta", "Final CTA", 7, ["final-title", "final-button"])
    ],
    layers: [
      {
        id: "hero-title",
        sectionId: "hero",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 96, y: 48, width: 620, height: 72 },
        style: { textColor: "#0f172a" },
        content: { text: "Turn AI visuals into production UI" }
      },
      textLayer("hero-copy", "hero", "LayerDoc keeps pixels, structure, edits, export, and verification in one chain.", 96, 128, 660),
      {
        id: "hero-cta",
        sectionId: "hero",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 96, y: 172, width: 176, height: 44 },
        style: { backgroundColor: "#14b8a6", textColor: "#ffffff", borderRadius: 14, padding: { x: 20, y: 10 } },
        content: { text: "Run verifier" }
      },
      {
        id: "hero-image",
        sectionId: "hero",
        kind: "image",
        track: "asset",
        editable: true,
        bounds: { x: 860, y: 44, width: 420, height: 154 },
        assetId: "asset-hero",
        content: { alt: "Reference homepage crop" }
      },
      textLayer("proof-title", "proof", "Structure score is separated from visual similarity.", 96, 260),
      textLayer("proof-stat", "proof", "100 structure / 100 component / tracked assets", 96, 322),
      textLayer("workflow-title", "workflow", "Image analysis becomes an editable LayerDoc.", 96, 480),
      textLayer("workflow-card", "workflow", "8 sections, 19 layers, one source of truth.", 96, 542),
      textLayer("layers-title", "layers", "Layer classification happens before code generation.", 96, 700),
      textLayer("layers-card", "layers", "component / asset / approximation / layout", 96, 762),
      textLayer("editor-title", "editor", "Operators edit copy, color, assets, geometry, and section order.", 96, 920),
      textLayer("editor-card", "editor", "No freeform vector surface. Every control writes LayerDoc.", 96, 982),
      textLayer("export-title", "export", "React + Tailwind export preserves traceability.", 96, 1140),
      textLayer("export-card", "export", "data-layer-id and data-section-id survive export.", 96, 1202),
      textLayer("verifier-title", "verifier", "PNG diff joins structural validation.", 96, 1360),
      textLayer("verifier-card", "verifier", "Visual, structure, component, and project-fit scores stay separate.", 96, 1422),
      textLayer("final-title", "final-cta", "Ship the UI as an engineering asset.", 96, 1580),
      {
        id: "final-button",
        sectionId: "final-cta",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 96, y: 1640, width: 184, height: 44 },
        style: { backgroundColor: "#0f172a", textColor: "#ffffff", borderRadius: 14, padding: { x: 20, y: 10 } },
        content: { text: "Export React" }
      }
    ],
    components: [
      { id: "HeroSection", layerIds: ["hero-title", "hero-copy", "hero-cta"], exportable: true },
      { id: "ProofSection", layerIds: ["proof-title", "proof-stat"], exportable: true },
      { id: "WorkflowSection", layerIds: ["workflow-title", "workflow-card"], exportable: true },
      { id: "LayerDocSection", layerIds: ["layers-title", "layers-card"], exportable: true },
      { id: "EditorSection", layerIds: ["editor-title", "editor-card"], exportable: true },
      { id: "ExportSection", layerIds: ["export-title", "export-card"], exportable: true },
      { id: "VerifierSection", layerIds: ["verifier-title", "verifier-card"], exportable: true },
      { id: "FinalCtaSection", layerIds: ["final-title", "final-button"], exportable: true }
    ]
  });
}
