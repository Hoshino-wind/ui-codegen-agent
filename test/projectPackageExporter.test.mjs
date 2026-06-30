import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { PNG } from "pngjs";

import {
  createLayerDoc,
  createProjectExportPackage,
  createVerificationReport,
  writeProjectExportPackage
} from "../dist/index.js";

test("project package exporter stays browser-compatible for Studio exports", () => {
  const source = readFileSync(join(process.cwd(), "src", "exporters", "projectPackage.ts"), "utf8");

  assert.doesNotMatch(source, /^import .*node:crypto/m);
});

function createExportDoc() {
  return createLayerDoc({
    name: "Production Homepage",
    canvas: { width: 1440, height: 900, background: "#ffffff" },
    sourceImage: { uri: "/references/production-homepage.png", width: 1440, height: 900 },
    analysisPlan: {
      source: "provided",
      name: "Production homepage plan",
      sectionCount: 1,
      layerCount: 2,
      uri: "/references/analysis-plan.json"
    },
    sections: [{ id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 1440, height: 900 }, layerIds: ["headline", "cta"] }],
    components: [{ id: "HeroSection", layerIds: ["headline", "cta"], exportable: true }],
    responsive: {
      rules: [
        {
          id: "mobile-cta",
          query: "(max-width: 640px)",
          target: { type: "layer", id: "cta" },
          changes: { bounds: { x: 24, y: 340, width: 280, height: 52 } }
        }
      ]
    },
    layers: [
      {
        id: "headline",
        sectionId: "hero",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 120, y: 120, width: 620, height: 96 },
        content: { text: "LayerDoc first" }
      },
      {
        id: "cta",
        sectionId: "hero",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 120, y: 260, width: 180, height: 48 },
        content: { text: "Export React" }
      }
    ]
  });
}

function createInteractiveExportDoc() {
  return createLayerDoc({
    name: "Interactive Homepage",
    canvas: { width: 1440, height: 900, background: "#ffffff" },
    sections: [{ id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 1440, height: 900 }, layerIds: ["cta"] }],
    components: [{ id: "HeroSection", layerIds: ["cta"], exportable: true }],
    layers: [
      {
        id: "cta",
        sectionId: "hero",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 120, y: 260, width: 180, height: 48 },
        content: { text: "Start checkout" }
      }
    ],
    interactions: [{ id: "hero-cta-click", layerId: "cta", event: "click", action: "open-checkout" }]
  });
}

function createStyledExportDoc() {
  return createLayerDoc({
    name: "Styled Homepage",
    canvas: { width: 1440, height: 900, background: "#ffffff" },
    sections: [{ id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 1440, height: 900 }, layerIds: ["cta"] }],
    components: [{ id: "HeroSection", layerIds: ["cta"], exportable: true }],
    layers: [
      {
        id: "cta",
        sectionId: "hero",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 120, y: 260, width: 180, height: 48 },
        style: {
          backgroundColor: "#111827",
          textColor: "#ffffff",
          borderRadius: 16,
          padding: { x: 20, y: 10 },
          fontFamily: "Inter, sans-serif",
          lineHeight: 26,
          letterSpacing: 0.2
        },
        content: { text: "Export React" }
      }
    ]
  });
}

function createSectionOrderExportDoc() {
  return createLayerDoc({
    name: "Ordered Homepage",
    canvas: { width: 1440, height: 900, background: "#ffffff" },
    sections: [
      { id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 1440, height: 480 }, layerIds: ["headline"] },
      { id: "proof", name: "Proof", bounds: { x: 0, y: 480, width: 1440, height: 420 }, layerIds: ["quote"] }
    ],
    layers: [
      {
        id: "headline",
        sectionId: "hero",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 120, y: 120, width: 620, height: 96 },
        content: { text: "LayerDoc first" }
      },
      {
        id: "quote",
        sectionId: "proof",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 120, y: 560, width: 620, height: 72 },
        content: { text: "Proof section" }
      }
    ]
  });
}

function createHiddenSectionExportDoc() {
  return createLayerDoc({
    name: "Visibility Homepage",
    canvas: { width: 1440, height: 900, background: "#ffffff" },
    responsive: {
      rules: [
        {
          id: "hero-mobile",
          query: "(max-width: 640px)",
          target: { type: "layer", id: "headline" },
          changes: { bounds: { x: 24, y: 80, width: 280, height: 72 } }
        },
        {
          id: "pricing-mobile",
          query: "(max-width: 640px)",
          target: { type: "layer", id: "price-card" },
          changes: { bounds: { x: 24, y: 520, width: 280, height: 160 } }
        }
      ]
    },
    sections: [
      { id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 1440, height: 480 }, layerIds: ["headline"] },
      { id: "pricing", name: "Pricing", visible: false, bounds: { x: 0, y: 480, width: 1440, height: 420 }, layerIds: ["price-card"] }
    ],
    components: [{ id: "HeroComposite", layerIds: ["headline", "price-card"], exportable: true }],
    layers: [
      {
        id: "headline",
        sectionId: "hero",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 120, y: 120, width: 620, height: 96 },
        content: { text: "Visible hero" }
      },
      {
        id: "price-card",
        sectionId: "pricing",
        kind: "card",
        track: "component",
        editable: true,
        bounds: { x: 120, y: 560, width: 360, height: 180 },
        content: { text: "Hidden pricing" }
      }
    ]
  });
}

function createAssetExportDoc() {
  return createLayerDoc({
    name: "Asset Homepage",
    canvas: { width: 1440, height: 900, background: "#ffffff" },
    sections: [{ id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 1440, height: 900 }, layerIds: ["hero-image"] }],
    components: [{ id: "HeroSection", layerIds: ["hero-image"], exportable: true }],
    assets: [{ id: "hero-crop", type: "image", source: "reference-crop", uri: "/assets/hero-crop.png" }],
    layers: [
      {
        id: "hero-image",
        sectionId: "hero",
        kind: "image",
        track: "asset",
        editable: true,
        bounds: { x: 120, y: 120, width: 480, height: 320 },
        assetId: "hero-crop",
        content: { alt: "Hero crop" }
      }
    ]
  });
}

function writeSolidPng(filePath, width, height, color, edits = []) {
  const png = new PNG({ width, height });

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (width * y + x) << 2;
      png.data[index] = color[0];
      png.data[index + 1] = color[1];
      png.data[index + 2] = color[2];
      png.data[index + 3] = color[3];
    }
  }

  for (const edit of edits) {
    const index = (width * edit.y + edit.x) << 2;
    png.data[index] = edit.color[0];
    png.data[index + 1] = edit.color[1];
    png.data[index + 2] = edit.color[2];
    png.data[index + 3] = edit.color[3];
  }

  writeFileSync(filePath, PNG.sync.write(png));
}

test("createProjectExportPackage returns project-ready files derived from one LayerDoc", () => {
  const doc = createExportDoc();
  const output = createProjectExportPackage(doc, { componentName: "ProductionHomepage" });
  const paths = output.files.map((file) => file.path).sort();

  assert.equal(output.manifest.packageName, "production-homepage");
  assert.equal(output.manifest.componentName, "ProductionHomepage");
  assert.match(output.manifest.layerDocHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(output.manifest.integrationContract, "integration-contract.json");
  assert.equal(output.manifest.handoffSummary, "handoff-summary.json");
  assert.deepEqual(output.manifest.referenceVisual, {
    file: "reference.png",
    role: "visual_verification_reference",
    sourceUri: "/references/production-homepage.png"
  });
  assert.deepEqual(output.manifest.analysisPlan, {
    source: "provided",
    name: "Production homepage plan",
    sectionCount: 1,
    layerCount: 2,
    uri: "/references/analysis-plan.json"
  });
  assert.deepEqual(paths, [
    "README.md",
    "handoff-summary.json",
    "index.html",
    "integration-contract.json",
    "layerdoc-audit.json",
    "layerdoc.schema.json",
    "layerdoc.json",
    "manifest.json",
    "package.json",
    "preview.html",
    "quality-gates.json",
    "scripts/verify-contract.mjs",
    "scripts/verify-gates.mjs",
    "scripts/verify-layerdoc.mjs",
    "scripts/verify-preview.mjs",
    "src/App.tsx",
    "src/index.css",
    "src/main.tsx",
    "src/ProductionHomepage.tsx",
    "tsconfig.json",
    "verification-report.json",
    "vite.config.ts"
  ].sort());
  assert.deepEqual(output.manifest.files.sort(), paths);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"scripts"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"dev": "vite"/);
  assert.match(
    output.files.find((file) => file.path === "package.json").contents,
    /"verify": "npm run verify:layerdoc && npm run verify:contract && npm run verify:preview && npm run verify:gates"/
  );
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"verify:preview": "node scripts\/verify-preview\.mjs"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"verify:gates": "node scripts\/verify-gates\.mjs"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"verify:layerdoc": "node scripts\/verify-layerdoc\.mjs"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"verify:contract": "node scripts\/verify-contract\.mjs"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"playwright"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"pixelmatch"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"pngjs"/);
  assert.match(output.files.find((file) => file.path === "src\/main.tsx").contents, /createRoot/);
  assert.match(output.files.find((file) => file.path === "src\/App.tsx").contents, /<ProductionHomepage \/>/);
  assert.match(output.files.find((file) => file.path === "src\/index.css").contents, /@import "tailwindcss"/);
  assert.match(output.files.find((file) => file.path === "vite.config.ts").contents, /@vitejs\/plugin-react/);
  assert.match(output.files.find((file) => file.path === "tsconfig.json").contents, /"jsx": "react-jsx"/);
  assert.match(output.files.find((file) => file.path === "src/ProductionHomepage.tsx").contents, /export function ProductionHomepage/);
  assert.match(output.files.find((file) => file.path === "layerdoc.json").contents, /"schema": "layerdoc"/);
  const contract = JSON.parse(output.files.find((file) => file.path === "integration-contract.json").contents);
  const manifest = JSON.parse(output.files.find((file) => file.path === "manifest.json").contents);
  assert.deepEqual(manifest.referenceVisual, output.manifest.referenceVisual);
  assert.deepEqual(manifest.analysisPlan, output.manifest.analysisPlan);
  assert.equal(contract.component.name, "ProductionHomepage");
  assert.equal(contract.component.file, "src/ProductionHomepage.tsx");
  assert.equal(contract.layerDoc.file, "layerdoc.json");
  assert.equal(contract.layerDoc.hash, output.manifest.layerDocHash);
  assert.deepEqual(contract.sections[0], {
    id: "hero",
    name: "Hero",
    selector: '[data-section-id="hero"]',
    layerIds: ["headline", "cta"]
  });
  assert.deepEqual(contract.layers.find((layer) => layer.id === "headline"), {
    id: "headline",
    kind: "text",
    track: "component",
    editable: true,
    sectionId: "hero",
    componentIds: ["HeroSection"],
    assetId: null,
    selector: '[data-layer-id="headline"]',
    interactionIds: []
  });
  assert.deepEqual(contract.components[0], {
    id: "HeroSection",
    exportable: true,
    selector: '[data-component-id="HeroSection"]',
    layerIds: ["headline", "cta"]
  });
  assert.deepEqual(contract.responsiveRules[0], {
    id: "mobile-cta",
    query: "(max-width: 640px)",
    target: { type: "layer", id: "cta" },
    selector: '[data-layer-id="cta"]',
    changes: { bounds: { x: 24, y: 340, width: 280, height: 52 } }
  });
  const layerDocSchema = JSON.parse(output.files.find((file) => file.path === "layerdoc.schema.json").contents);
  assert.equal(layerDocSchema.properties.schema.const, "layerdoc");
  assert.deepEqual(layerDocSchema.properties.metadata.properties.sourceImage.required, ["uri", "width", "height"]);
  assert.deepEqual(layerDocSchema.properties.metadata.properties.analysisPlan.required, ["source", "name", "sectionCount", "layerCount"]);
  assert.deepEqual(layerDocSchema.properties.metadata.properties.analysisPlan.properties.source.enum, ["seeded", "provided", "editor", "manual"]);
  assert.equal(
    layerDocSchema.properties.verification.properties.issues.items.properties.code.enum.includes("section_empty"),
    true
  );
  assert.equal(
    layerDocSchema.properties.verification.properties.issues.items.properties.code.enum.includes("layer_section_mismatch"),
    true
  );
  assert.equal(
    layerDocSchema.properties.verification.properties.issues.items.properties.code.enum.includes("responsive_target_missing"),
    true
  );
  assert.equal(
    layerDocSchema.properties.verification.properties.issues.items.properties.code.enum.includes("metadata_invalid"),
    true
  );
  assert.equal(layerDocSchema.properties.responsive.properties.rules.items.required.includes("target"), true);
  assert.deepEqual(layerDocSchema.properties.responsive.properties.rules.items.properties.target.properties.type.enum, [
    "section",
    "layer",
    "component"
  ]);
  assert.match(output.files.find((file) => file.path === "layerdoc-audit.json").contents, /"assetCompliance"/);
  assert.match(output.files.find((file) => file.path === "verification-report.json").contents, /"structureScore": 100/);
  assert.match(output.files.find((file) => file.path === "verification-report.json").contents, /"evidence"/);
  assert.match(output.files.find((file) => file.path === "quality-gates.json").contents, /"visualSimilarity": 85/);
  const handoffSummary = JSON.parse(output.files.find((file) => file.path === "handoff-summary.json").contents);
  assert.equal(handoffSummary.version, "0.1.0");
  assert.equal(handoffSummary.positioning, "AI UI Production System");
  assert.deepEqual(handoffSummary.sourceOfTruth, {
    file: "layerdoc.json",
    schemaFile: "layerdoc.schema.json",
    hash: output.manifest.layerDocHash
  });
  assert.deepEqual(handoffSummary.sourceVisual, {
    uri: "/references/production-homepage.png",
    width: 1440,
    height: 900
  });
  assert.deepEqual(handoffSummary.sourceAnalysisPlan, output.manifest.analysisPlan);
  assert.deepEqual(handoffSummary.entrypoint, {
    component: "ProductionHomepage",
    file: "src/ProductionHomepage.tsx",
    rootSelector: '[data-layerdoc-version="0.1.0"]'
  });
  assert.deepEqual(handoffSummary.contract, {
    file: "integration-contract.json",
    sections: 1,
    layers: 2,
    components: 1,
    assets: 0,
    interactions: 0,
    responsiveRules: 1
  });
  assert.deepEqual(handoffSummary.quality.scores, {
    visual_similarity: output.manifest.scores.visualSimilarity,
    structure_score: output.manifest.scores.structureScore,
    component_score: output.manifest.scores.componentScore,
    project_fit_score: output.manifest.scores.projectFitScore
  });
  assert.equal(handoffSummary.quality.visualEvidence.kind, "none");
  assert.deepEqual(handoffSummary.quality.referenceVisual, output.manifest.referenceVisual);
  assert.equal(handoffSummary.audit.file, "layerdoc-audit.json");
  assert.equal(handoffSummary.audit.assetCompliancePassed, true);
  assert.deepEqual(handoffSummary.audit.editableCoverage, {
    visibleSections: 1,
    sectionsWithEditableLayers: 1,
    editableSectionRatio: 1,
    editableLayerRatio: 1,
    sectionsWithoutEditableLayers: []
  });
  assert.deepEqual(
    handoffSummary.commands.map((command) => command.command),
    [
      "npm install",
      "npm run dev",
      "npm run build",
      "npm run verify",
      "npm run verify:layerdoc",
      "npm run verify:contract",
      "npm run verify:preview",
      "npm run verify:gates"
    ]
  );
  assert.match(output.files.find((file) => file.path === "scripts/verify-gates.mjs").contents, /verification-report\.json/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-gates.mjs").contents, /layerdoc-audit\.json/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-contract.mjs").contents, /integration-contract\.json/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-contract.mjs").contents, /project_interaction_metadata_missing/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-contract.mjs").contents, /project_responsive_css_missing/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-contract.mjs").contents, /project_asset_uri_missing/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-contract.mjs").contents, /project_layer_copy_missing/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-contract.mjs").contents, /project_layer_bounds_missing/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-contract.mjs").contents, /project_layer_style_missing/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-contract.mjs").contents, /project_section_order_mismatch/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-layerdoc.mjs").contents, /layerdoc\.json/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-preview.mjs").contents, /preview\.html/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-preview.mjs").contents, /verification-report\.json/);
  assert.match(output.files.find((file) => file.path === "preview.html").contents, /data-layerdoc="0.1.0"/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm install/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run dev/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run verify/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run verify:gates/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run verify:contract/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run verify:layerdoc/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run verify:preview/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /manifest reference visual/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /handoff-summary\.json/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /integration-contract\.json/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /layerdoc\.schema\.json/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /visual_evidence:/);
});

test("createProjectExportPackage stores verifier scores on the exported LayerDoc source", () => {
  const doc = createExportDoc();
  const report = {
    ...createVerificationReport(doc, { visualSimilarity: 93.5 }),
    projectFitScore: 94
  };

  const output = createProjectExportPackage(doc, { componentName: "ProductionHomepage", report });
  const layerDoc = JSON.parse(output.files.find((file) => file.path === "layerdoc.json").contents);
  const contract = JSON.parse(output.files.find((file) => file.path === "integration-contract.json").contents);
  const manifest = JSON.parse(output.files.find((file) => file.path === "manifest.json").contents);

  assert.equal(doc.verification.scores.visualSimilarity, null);
  assert.deepEqual(layerDoc.verification.scores, {
    visualSimilarity: 93.5,
    structureScore: report.structureScore,
    componentScore: report.componentScore,
    projectFitScore: 94
  });
  assert.deepEqual(layerDoc.verification.issues, report.issues);
  assert.equal(manifest.layerDocHash, output.manifest.layerDocHash);
  assert.equal(contract.layerDoc.hash, output.manifest.layerDocHash);
});

test("writeProjectExportPackage writes every package file under the target directory", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-export-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });

  const written = writeProjectExportPackage(output, directory);

  assert.equal(written.files.length, 22);
  assert.equal(existsSync(join(directory, "src", "ProductionHomepage.tsx")), true);
  assert.equal(existsSync(join(directory, "integration-contract.json")), true);
  assert.equal(existsSync(join(directory, "handoff-summary.json")), true);
  assert.equal(existsSync(join(directory, "layerdoc-audit.json")), true);
  assert.equal(existsSync(join(directory, "layerdoc.schema.json")), true);
  assert.equal(existsSync(join(directory, "src", "main.tsx")), true);
  assert.equal(existsSync(join(directory, "package.json")), true);
  assert.equal(existsSync(join(directory, "vite.config.ts")), true);
  assert.equal(existsSync(join(directory, "scripts", "verify-gates.mjs")), true);
  assert.equal(existsSync(join(directory, "scripts", "verify-contract.mjs")), true);
  assert.equal(existsSync(join(directory, "scripts", "verify-layerdoc.mjs")), true);
  assert.equal(existsSync(join(directory, "scripts", "verify-preview.mjs")), true);
  assert.equal(existsSync(join(directory, "verification-report.json")), true);
  assert.equal(existsSync(join(directory, "quality-gates.json")), true);
  assert.equal(existsSync(join(directory, "manifest.json")), true);
  assert.match(readFileSync(join(directory, "src", "ProductionHomepage.tsx"), "utf8"), /LayerDoc first/);
  assert.match(readFileSync(join(directory, "src", "App.tsx"), "utf8"), /ProductionHomepage/);
  assert.deepEqual(
    written.files.map((file) => file.relativePath).sort(),
    output.files.map((file) => file.path).sort()
  );
});

test("exported integration contract verifier validates the handoff mapping", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-contract-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const passed = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.equal(passed.status, 0, passed.stderr);
  assert.match(passed.stdout, /"passed": true/);

  const contractPath = join(directory, "integration-contract.json");
  const staleContract = JSON.parse(readFileSync(contractPath, "utf8"));
  staleContract.layers[0].selector = '[data-layer-id="stale-headline"]';
  writeFileSync(contractPath, `${JSON.stringify(staleContract, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /integration_contract_mismatch/);
  assert.match(failed.stdout, /layers/);
  assert.match(failed.stdout, /stale-headline/);
});

test("exported integration contract verifier accepts hidden sections omitted from project surfaces", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-hidden-section-contract-verifier-"));
  const output = createProjectExportPackage(createHiddenSectionExportDoc(), { componentName: "VisibilityHomepage" });
  writeProjectExportPackage(output, directory);

  const componentSource = readFileSync(join(directory, "src", "VisibilityHomepage.tsx"), "utf8");
  const previewSource = readFileSync(join(directory, "preview.html"), "utf8");
  assert.match(readFileSync(join(directory, "layerdoc.json"), "utf8"), /"visible": false/);
  assert.doesNotMatch(componentSource, /Hidden pricing/);
  assert.doesNotMatch(componentSource, /data-layer-id="price-card"/);
  assert.doesNotMatch(previewSource, /Hidden pricing/);
  assert.doesNotMatch(previewSource, /data-layer-id="price-card"/);
  const contract = JSON.parse(readFileSync(join(directory, "integration-contract.json"), "utf8"));
  assert.deepEqual(contract.sections.map((section) => section.id), ["hero"]);
  assert.deepEqual(contract.layers.map((layer) => layer.id), ["headline"]);
  assert.deepEqual(contract.components.map((component) => component.layerIds), [["headline"]]);
  assert.deepEqual(contract.responsiveRules.map((rule) => rule.id), ["hero-mobile"]);

  const passed = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.equal(passed.status, 0, passed.stdout);
  assert.match(passed.stdout, /"passed": true/);
});

test("exported integration contract verifier checks project selectors", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-selector-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const componentPath = join(directory, "src", "ProductionHomepage.tsx");
  const componentSource = readFileSync(componentPath, "utf8");
  writeFileSync(componentPath, componentSource.replace('data-layer-id="headline"', 'data-layer-id="stale-headline"'));

  const failed = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /project_selector_missing/);
  assert.match(failed.stdout, /src\/ProductionHomepage\.tsx/);
  assert.match(failed.stdout, /data-layer-id=\\"headline\\"/);
});

test("exported integration contract verifier checks preview selectors", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-preview-selector-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const previewPath = join(directory, "preview.html");
  const previewSource = readFileSync(previewPath, "utf8");
  writeFileSync(previewPath, previewSource.replace('data-layer-id="headline"', 'data-layer-id="stale-headline"'));

  const failed = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /preview_selector_missing/);
  assert.match(failed.stdout, /preview\.html/);
  assert.match(failed.stdout, /data-layer-id=\\"headline\\"/);
});

test("exported integration contract verifier checks project layer bounds", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-bounds-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const componentPath = join(directory, "src", "ProductionHomepage.tsx");
  const componentSource = readFileSync(componentPath, "utf8");
  const validHeadlineStart =
    'data-layer-id="headline" data-kind="text" data-track="component" className="absolute" style={{ left: 120';
  const staleHeadlineStart =
    'data-layer-id="headline" data-kind="text" data-track="component" className="absolute" style={{ left: 121';
  writeFileSync(componentPath, componentSource.replace(validHeadlineStart, staleHeadlineStart));

  const failed = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /project_layer_bounds_missing/);
  assert.match(failed.stdout, /src\/ProductionHomepage\.tsx/);
  assert.match(failed.stdout, /data-layer-id=\\"headline\\"/);
  assert.match(failed.stdout, /left: 120/);
});

test("exported integration contract verifier checks preview layer bounds", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-preview-bounds-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const previewPath = join(directory, "preview.html");
  const previewSource = readFileSync(previewPath, "utf8");
  const validHeadlineStart =
    'data-layer-id="headline" data-kind="text" data-track="component" style="position:absolute;left:120px';
  const staleHeadlineStart =
    'data-layer-id="headline" data-kind="text" data-track="component" style="position:absolute;left:121px';
  writeFileSync(previewPath, previewSource.replace(validHeadlineStart, staleHeadlineStart));

  const failed = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /preview_layer_bounds_missing/);
  assert.match(failed.stdout, /preview\.html/);
  assert.match(failed.stdout, /data-layer-id=\\"headline\\"/);
  assert.match(failed.stdout, /left:120px/);
});

test("exported integration contract verifier checks project layer style", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-style-verifier-"));
  const output = createProjectExportPackage(createStyledExportDoc(), { componentName: "StyledHomepage" });
  writeProjectExportPackage(output, directory);

  const componentPath = join(directory, "src", "StyledHomepage.tsx");
  const componentSource = readFileSync(componentPath, "utf8");
  const previewSource = readFileSync(join(directory, "preview.html"), "utf8");
  const verifierSource = readFileSync(join(directory, "scripts", "verify-contract.mjs"), "utf8");

  assert.match(componentSource, /fontFamily: "Inter, sans-serif"/);
  assert.match(componentSource, /lineHeight: "26px"/);
  assert.match(componentSource, /letterSpacing: "0.2px"/);
  assert.match(previewSource, /font-family:Inter, sans-serif/);
  assert.match(previewSource, /line-height:26px/);
  assert.match(previewSource, /letter-spacing:0.2px/);
  assert.match(verifierSource, /lineHeight/);
  assert.match(verifierSource, /letterSpacing/);

  writeFileSync(componentPath, componentSource.replace('backgroundColor: "#111827"', 'backgroundColor: "#0f172a"'));

  const failed = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /project_layer_style_missing/);
  assert.match(failed.stdout, /src\/StyledHomepage\.tsx/);
  assert.match(failed.stdout, /data-layer-id=\\"cta\\"/);
  assert.match(failed.stdout, /backgroundColor: \\"#111827\\"/);
});

test("exported integration contract verifier checks preview layer style", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-preview-style-verifier-"));
  const output = createProjectExportPackage(createStyledExportDoc(), { componentName: "StyledHomepage" });
  writeProjectExportPackage(output, directory);

  const previewPath = join(directory, "preview.html");
  const previewSource = readFileSync(previewPath, "utf8");
  writeFileSync(previewPath, previewSource.replace("background-color:#111827", "background-color:#0f172a"));

  const failed = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /preview_layer_style_missing/);
  assert.match(failed.stdout, /preview\.html/);
  assert.match(failed.stdout, /data-layer-id=\\"cta\\"/);
  assert.match(failed.stdout, /background-color:#111827/);
});

test("exported integration contract verifier checks project section order", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-section-order-verifier-"));
  const output = createProjectExportPackage(createSectionOrderExportDoc(), { componentName: "OrderedHomepage" });
  writeProjectExportPackage(output, directory);

  const componentPath = join(directory, "src", "OrderedHomepage.tsx");
  const componentSource = readFileSync(componentPath, "utf8");
  const staleSource = componentSource
    .replace('data-section-id="hero"', 'data-section-id="__tmp__"')
    .replace('data-section-id="proof"', 'data-section-id="hero"')
    .replace('data-section-id="__tmp__"', 'data-section-id="proof"');
  writeFileSync(componentPath, staleSource);

  const failed = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /project_section_order_mismatch/);
  assert.match(failed.stdout, /src\/OrderedHomepage\.tsx/);
  assert.match(failed.stdout, /hero -> proof/);
});

test("exported integration contract verifier checks preview section order", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-preview-section-order-verifier-"));
  const output = createProjectExportPackage(createSectionOrderExportDoc(), { componentName: "OrderedHomepage" });
  writeProjectExportPackage(output, directory);

  const previewPath = join(directory, "preview.html");
  const previewSource = readFileSync(previewPath, "utf8");
  const staleSource = previewSource
    .replace('data-section-id="hero"', 'data-section-id="__tmp__"')
    .replace('data-section-id="proof"', 'data-section-id="hero"')
    .replace('data-section-id="__tmp__"', 'data-section-id="proof"');
  writeFileSync(previewPath, staleSource);

  const failed = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /preview_section_order_mismatch/);
  assert.match(failed.stdout, /preview\.html/);
  assert.match(failed.stdout, /hero -> proof/);
});

test("exported integration contract verifier checks project interaction metadata", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-interaction-verifier-"));
  const output = createProjectExportPackage(createInteractiveExportDoc(), { componentName: "InteractiveHomepage" });
  writeProjectExportPackage(output, directory);

  const componentPath = join(directory, "src", "InteractiveHomepage.tsx");
  const componentSource = readFileSync(componentPath, "utf8");
  writeFileSync(componentPath, componentSource.replace('data-interaction-ids="hero-cta-click"', 'data-interaction-ids="stale-click"'));

  const failed = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /project_interaction_metadata_missing/);
  assert.match(failed.stdout, /src\/InteractiveHomepage\.tsx/);
  assert.match(failed.stdout, /hero-cta-click/);
});

test("exported integration contract verifier checks preview interaction metadata", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-preview-interaction-verifier-"));
  const output = createProjectExportPackage(createInteractiveExportDoc(), { componentName: "InteractiveHomepage" });
  writeProjectExportPackage(output, directory);

  const previewPath = join(directory, "preview.html");
  const previewSource = readFileSync(previewPath, "utf8");
  writeFileSync(previewPath, previewSource.replace('data-interaction-actions="open-checkout"', 'data-interaction-actions="stale-action"'));

  const failed = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /preview_interaction_metadata_missing/);
  assert.match(failed.stdout, /preview\.html/);
  assert.match(failed.stdout, /open-checkout/);
});

test("exported integration contract verifier checks project responsive CSS", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-responsive-css-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const componentPath = join(directory, "src", "ProductionHomepage.tsx");
  const componentSource = readFileSync(componentPath, "utf8");
  writeFileSync(componentPath, componentSource.replace("@media (max-width: 640px)", "@media (max-width: 320px)"));

  const failed = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /project_responsive_css_missing/);
  assert.match(failed.stdout, /src\/ProductionHomepage\.tsx/);
  assert.match(failed.stdout, /max-width: 640px/);
});

test("exported integration contract verifier checks preview responsive CSS", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-preview-responsive-css-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const previewPath = join(directory, "preview.html");
  const previewSource = readFileSync(previewPath, "utf8");
  writeFileSync(previewPath, previewSource.replace("left:24px !important;", "left:12px !important;"));

  const failed = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /preview_responsive_css_missing/);
  assert.match(failed.stdout, /preview\.html/);
  assert.match(failed.stdout, /left:24px !important/);
});

test("exported integration contract verifier checks project asset URIs", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-asset-uri-verifier-"));
  const output = createProjectExportPackage(createAssetExportDoc(), { componentName: "AssetHomepage" });
  writeProjectExportPackage(output, directory);

  const componentPath = join(directory, "src", "AssetHomepage.tsx");
  const componentSource = readFileSync(componentPath, "utf8");
  writeFileSync(componentPath, componentSource.replace('src="/assets/hero-crop.png"', 'src="/assets/stale-hero.png"'));

  const failed = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /project_asset_uri_missing/);
  assert.match(failed.stdout, /src\/AssetHomepage\.tsx/);
  assert.match(failed.stdout, /\/assets\/hero-crop\.png/);
});

test("exported integration contract verifier checks preview asset URIs", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-preview-asset-uri-verifier-"));
  const output = createProjectExportPackage(createAssetExportDoc(), { componentName: "AssetHomepage" });
  writeProjectExportPackage(output, directory);

  const previewPath = join(directory, "preview.html");
  const previewSource = readFileSync(previewPath, "utf8");
  writeFileSync(previewPath, previewSource.replace('src="/assets/hero-crop.png"', 'src="/assets/stale-hero.png"'));

  const failed = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /preview_asset_uri_missing/);
  assert.match(failed.stdout, /preview\.html/);
  assert.match(failed.stdout, /\/assets\/hero-crop\.png/);
});

test("exported integration contract verifier checks project layer copy", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-copy-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const componentPath = join(directory, "src", "ProductionHomepage.tsx");
  const componentSource = readFileSync(componentPath, "utf8");
  writeFileSync(componentPath, componentSource.replace("LayerDoc first", "LayerDoc stale"));

  const failed = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /project_layer_copy_missing/);
  assert.match(failed.stdout, /src\/ProductionHomepage\.tsx/);
  assert.match(failed.stdout, /LayerDoc first/);
});

test("exported integration contract verifier checks preview layer copy", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-preview-copy-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const previewPath = join(directory, "preview.html");
  const previewSource = readFileSync(previewPath, "utf8");
  writeFileSync(previewPath, previewSource.replace("LayerDoc first", "LayerDoc stale"));

  const failed = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /preview_layer_copy_missing/);
  assert.match(failed.stdout, /preview\.html/);
  assert.match(failed.stdout, /LayerDoc first/);
});

test("exported LayerDoc verifier script validates the editable source graph", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-source-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const passed = spawnSync(process.execPath, ["scripts/verify-layerdoc.mjs"], { cwd: directory, encoding: "utf8" });
  assert.equal(passed.status, 0, passed.stderr);
  assert.match(passed.stdout, /"passed": true/);

  const layerDocPath = join(directory, "layerdoc.json");
  const editedLayerDoc = JSON.parse(readFileSync(layerDocPath, "utf8"));
  editedLayerDoc.layers[0].content.text = "Edited after export";
  writeFileSync(layerDocPath, `${JSON.stringify(editedLayerDoc, null, 2)}\n`);

  const stale = spawnSync(process.execPath, ["scripts/verify-layerdoc.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(stale.status, 0);
  assert.match(stale.stdout, /layerdoc_hash_mismatch/);
  assert.match(stale.stdout, /does not match manifest\.json/);

  const brokenLayerDoc = JSON.parse(readFileSync(layerDocPath, "utf8"));
  brokenLayerDoc.components[0].layerIds.push("missing-layer");
  writeFileSync(layerDocPath, `${JSON.stringify(brokenLayerDoc, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-layerdoc.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /components\[0\]\.layerIds/);
  assert.match(failed.stdout, /missing-layer/);
});

test("exported LayerDoc verifier script rejects visible empty sections", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-empty-section-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const layerDocPath = join(directory, "layerdoc.json");
  const layerDoc = JSON.parse(readFileSync(layerDocPath, "utf8"));
  layerDoc.sections[0].layerIds = [];
  writeFileSync(layerDocPath, `${JSON.stringify(layerDoc, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-layerdoc.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /section_empty/);
  assert.match(failed.stdout, /sections\[0\]\.layerIds/);
});

test("exported LayerDoc verifier script rejects invalid Analysis Plan provenance", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-provenance-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const layerDocPath = join(directory, "layerdoc.json");
  const layerDoc = JSON.parse(readFileSync(layerDocPath, "utf8"));
  layerDoc.metadata.analysisPlan = {
    source: "unknown",
    name: "",
    sectionCount: -1,
    layerCount: -2,
    uri: ""
  };
  writeFileSync(layerDocPath, `${JSON.stringify(layerDoc, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-layerdoc.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /metadata_invalid/);
  assert.match(failed.stdout, /metadata\.analysisPlan\.source/);
});

test("exported LayerDoc verifier script rejects mismatched section membership", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-membership-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const layerDocPath = join(directory, "layerdoc.json");
  const layerDoc = JSON.parse(readFileSync(layerDocPath, "utf8"));
  layerDoc.sections[0].layerIds = ["headline"];
  writeFileSync(layerDocPath, `${JSON.stringify(layerDoc, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-layerdoc.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /layer_section_mismatch/);
  assert.match(failed.stdout, /layers\[1\]\.sectionId/);
});

test("exported LayerDoc verifier script rejects missing responsive rule targets", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-responsive-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const layerDocPath = join(directory, "layerdoc.json");
  const layerDoc = JSON.parse(readFileSync(layerDocPath, "utf8"));
  layerDoc.responsive.rules = [
    {
      id: "mobile-cta",
      query: "(max-width: 640px)",
      target: { type: "layer", id: "missing-cta" },
      changes: { bounds: { width: 280 } }
    }
  ];
  writeFileSync(layerDocPath, `${JSON.stringify(layerDoc, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-layerdoc.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /responsive_target_missing/);
  assert.match(failed.stdout, /responsive\.rules\[0\]\.target\.id/);
});

test("exported preview verifier script updates the handoff report from candidate screenshots", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-preview-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const referencePath = join(directory, "reference.png");
  const candidatePath = join(directory, "candidate.png");
  writeSolidPng(referencePath, 2, 1, [255, 255, 255, 255]);
  writeSolidPng(candidatePath, 2, 1, [255, 255, 255, 255], [{ x: 1, y: 0, color: [15, 23, 42, 255] }]);

  const result = spawnSync(
    process.execPath,
    ["scripts/verify-preview.mjs", "--reference", referencePath, "--candidate", candidatePath, "--out", "verification-artifacts", "--threshold", "0"],
    { cwd: directory, encoding: "utf8", env: { ...process.env, NODE_PATH: join(process.cwd(), "node_modules") } }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"visualSimilarity": 50/);
  assert.equal(existsSync(join(directory, "verification-artifacts", "diff.png")), true);
  const report = JSON.parse(readFileSync(join(directory, "verification-report.json"), "utf8"));
  assert.equal(report.visualSimilarity, 50);
  assert.equal(report.evidence.visual.kind, "html-screenshot");
  assert.equal(report.visualDiff.diffPath, "verification-artifacts/diff.png");
  assert.deepEqual(report.visualDiff.problemAreas, [{ x: 1, y: 0, width: 1, height: 1 }]);
});

test("exported preview verifier script defaults to manifest reference visual", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-preview-default-reference-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const referencePath = join(directory, "reference.png");
  const candidatePath = join(directory, "candidate.png");
  writeSolidPng(referencePath, 2, 1, [255, 255, 255, 255]);
  writeSolidPng(candidatePath, 2, 1, [255, 255, 255, 255]);

  const result = spawnSync(
    process.execPath,
    ["scripts/verify-preview.mjs", "--candidate", candidatePath, "--out", "verification-artifacts"],
    { cwd: directory, encoding: "utf8", env: { ...process.env, NODE_PATH: join(process.cwd(), "node_modules") } }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"visualSimilarity": 100/);
  assert.match(result.stdout, /"referencePath":/);
  assert.match(result.stdout, /reference\.png/);
  const report = JSON.parse(readFileSync(join(directory, "verification-report.json"), "utf8"));
  assert.equal(report.visualSimilarity, 100);
});

test("exported quality gate script passes and fails from project files", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-gates-"));
  const doc = createExportDoc();
  const passingReport = {
    ...createVerificationReport(doc, { visualSimilarity: 96 }),
    projectFitScore: 90
  };
  const output = createProjectExportPackage(doc, {
    componentName: "ProductionHomepage",
    report: passingReport
  });
  writeProjectExportPackage(output, directory);

  const passed = spawnSync(process.execPath, ["scripts/verify-gates.mjs"], { cwd: directory, encoding: "utf8" });
  assert.equal(passed.status, 0, passed.stderr);
  assert.match(passed.stdout, /"passed": true/);

  const reportPath = join(directory, "verification-report.json");
  const failingReport = JSON.parse(readFileSync(reportPath, "utf8"));
  failingReport.visualSimilarity = 74;
  writeFileSync(reportPath, `${JSON.stringify(failingReport, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-gates.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /visual_similarity 74 is below 85/);
});

test("exported quality gate script rejects full-page bitmap audit failures", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-asset-gates-"));
  const doc = createLayerDoc({
    name: "Bitmap Shortcut",
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
  const perfectReport = {
    ...createVerificationReport(doc, { visualSimilarity: 100 }),
    structureScore: 100,
    componentScore: 100,
    projectFitScore: 100,
    issues: []
  };
  const output = createProjectExportPackage(doc, {
    componentName: "BitmapShortcut",
    report: perfectReport
  });
  writeProjectExportPackage(output, directory);

  const failed = spawnSync(process.execPath, ["scripts/verify-gates.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /asset_compliance failed/);
  assert.match(failed.stdout, /full-page bitmap/i);
});

test("exported quality gate script rejects section bitmap audit failures", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-section-asset-gates-"));
  const doc = createLayerDoc({
    name: "Section Bitmap Shortcut",
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
  const perfectReport = {
    ...createVerificationReport(doc, { visualSimilarity: 100 }),
    structureScore: 100,
    componentScore: 100,
    projectFitScore: 100,
    issues: []
  };
  const output = createProjectExportPackage(doc, {
    componentName: "SectionBitmapShortcut",
    report: perfectReport
  });
  writeProjectExportPackage(output, directory);

  const audit = JSON.parse(readFileSync(join(directory, "layerdoc-audit.json"), "utf8"));
  assert.equal(audit.assetCompliance.fullPageBitmapRisk, false);
  assert.deepEqual(audit.assetCompliance.riskySectionAssets, [
    { sectionId: "hero", assetId: "hero-shot-asset", coverageRatio: 1 },
    { sectionId: "proof", assetId: "proof-shot-asset", coverageRatio: 1 }
  ]);

  const failed = spawnSync(process.execPath, ["scripts/verify-gates.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /asset_compliance failed/);
  assert.match(failed.stdout, /section bitmap shortcut/i);
});

test("exported quality gate script rejects visible sections without editable layers", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-editable-coverage-gates-"));
  const doc = createLayerDoc({
    name: "Visual Only Section",
    canvas: { width: 1000, height: 900 },
    sections: [
      { id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 1000, height: 450 }, layerIds: ["headline"] },
      { id: "gallery", name: "Gallery", bounds: { x: 0, y: 450, width: 1000, height: 450 }, layerIds: ["gallery-shot"] }
    ],
    assets: [{ id: "gallery-shot-asset", type: "image", source: "uploaded", bounds: { x: 80, y: 520, width: 280, height: 160 } }],
    layers: [
      {
        id: "headline",
        sectionId: "hero",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 80, y: 120, width: 420, height: 64 },
        content: { text: "Editable hero" }
      },
      {
        id: "gallery-shot",
        sectionId: "gallery",
        kind: "image",
        track: "asset",
        editable: false,
        bounds: { x: 80, y: 520, width: 280, height: 160 },
        assetId: "gallery-shot-asset"
      }
    ]
  });
  const perfectReport = {
    ...createVerificationReport(doc, { visualSimilarity: 100 }),
    structureScore: 100,
    componentScore: 100,
    projectFitScore: 100,
    issues: []
  };
  const output = createProjectExportPackage(doc, {
    componentName: "VisualOnlySection",
    report: perfectReport
  });
  writeProjectExportPackage(output, directory);

  const audit = JSON.parse(readFileSync(join(directory, "layerdoc-audit.json"), "utf8"));
  assert.deepEqual(audit.editableCoverage.sectionsWithoutEditableLayers, ["gallery"]);
  assert.equal(audit.assetCompliance.passed, true);

  const failed = spawnSync(process.execPath, ["scripts/verify-gates.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /editable_coverage failed/);
  assert.match(failed.stdout, /gallery/);
});
