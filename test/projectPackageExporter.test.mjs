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
  parseProjectExportPackageJson,
  writeProjectExportPackage
} from "../dist/index.js";

const EXPECTED_VERIFY_CHAIN =
  "npm run verify:preview && npm run verify:production-manifest && npm run verify:ci-workflow && npm run verify:handoff && npm run verify:analysis-plan && npm run verify:image-manifest && npm run verify:layerdoc && npm run verify:contract && npm run verify:gates";

test("project package exporter stays browser-compatible for Studio exports", () => {
  const source = readFileSync(join(process.cwd(), "src", "exporters", "projectPackage.ts"), "utf8");

  assert.doesNotMatch(source, /^import .*node:crypto/m);
});

function createExportAnalysisPlanAudit() {
  return {
    summary: { sections: 1, layers: 2, editableLayers: 2 },
    tracks: { component: 2, asset: 0, approximation: 0, layout: 0 },
    coverage: { sectionsWithLayers: 1, emptySectionIds: [] },
    readiness: {
      sectionRangeOk: false,
      validPlan: true,
      allSectionsHaveLayers: true,
      readyForLayerDoc: true,
      blockers: []
    },
    issues: [],
    sectionBreakdown: [
      {
        sectionId: "hero",
        name: "Hero",
        layerCount: 2,
        editableLayerCount: 2,
        tracks: { component: 2, asset: 0, approximation: 0, layout: 0 }
      }
    ]
  };
}

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
    analysisPlanAudit: createExportAnalysisPlanAudit(),
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

function createPreviewAttributionDoc() {
  return createLayerDoc({
    name: "Preview Attribution",
    canvas: { width: 20, height: 20, background: "#ffffff" },
    sections: [{ id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 20, height: 20 }, layerIds: ["headline"] }],
    components: [{ id: "HeroSection", layerIds: ["headline"], exportable: true }],
    layers: [
      {
        id: "headline",
        sectionId: "hero",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 1, y: 0, width: 12, height: 8 },
        content: { text: "LayerDoc first" }
      }
    ]
  });
}

function expectedVerificationAttributesFor(report) {
  return {
    "data-verification-visual-similarity": report.visualSimilarity === null ? "n/a" : String(report.visualSimilarity),
    "data-verification-structure-score": String(report.structureScore),
    "data-verification-component-score": String(report.componentScore),
    "data-verification-project-fit-score": String(report.projectFitScore),
    "data-verification-issues": String(report.issues.length)
  };
}

function createExportImageManifest() {
  return {
    name: "Production Homepage",
    sourceImage: { uri: "/references/production-homepage.png", width: 1440, height: 900 },
    canvas: { width: 1440, height: 900, background: "#ffffff" },
    sections: [
      {
        id: "hero",
        name: "Hero",
        bounds: { x: 0, y: 0, width: 1440, height: 900 },
        layers: [
          {
            id: "headline",
            kind: "text",
            bounds: { x: 120, y: 120, width: 620, height: 96 },
            text: "LayerDoc first"
          },
          {
            id: "cta",
            kind: "button",
            bounds: { x: 120, y: 260, width: 180, height: 48 },
            text: "Export React"
          }
        ]
      }
    ]
  };
}

function createRegenerationExportDoc() {
  const doc = createExportDoc();
  doc.generation.sectionRequests.push({
    id: "regen-hero-1",
    sectionId: "hero",
    prompt: "Regenerate the hero section with stronger enterprise positioning.",
    status: "requested",
    requestedAt: "2026-06-30T10:05:00.000Z"
  });
  return doc;
}

function createHeroSectionCandidate() {
  return {
    requestId: "regen-hero-1",
    section: {
      id: "hero",
      name: "Hero",
      bounds: { x: 0, y: 0, width: 1440, height: 860 },
      layerIds: ["hero-title", "hero-cta"]
    },
    layers: [
      {
        id: "hero-title",
        sectionId: "hero",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 120, y: 120, width: 720, height: 96 },
        content: { text: "Reviewed production hero" }
      },
      {
        id: "hero-cta",
        sectionId: "hero",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 120, y: 260, width: 180, height: 48 },
        content: { text: "Apply candidate" }
      }
    ],
    components: [
      { id: "RegeneratedHero", layerIds: ["hero-title", "hero-cta"], exportable: true },
      { id: "RegeneratedHeroActions", layerIds: ["hero-cta"], exportable: true }
    ]
  };
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
  assert.equal(output.manifest.backtestRunbook, "backtest-runbook.json");
  assert.equal(output.manifest.ciWorkflow, "ci-workflow.json");
  assert.equal(output.manifest.productionManifest, "production-manifest.json");
  assert.equal(output.manifest.productionManifestSchema, "production-manifest.schema.json");
  assert.equal(output.manifest.sectionCandidateSchema, "section-candidate.schema.json");
  assert.equal(output.manifest.assetIndex, "asset-index.json");
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
  assert.equal(output.manifest.analysisTaskFile, "analysis-task.json");
  assert.deepEqual(output.manifest.analysisPlanAudit, createExportAnalysisPlanAudit());
  assert.equal(output.manifest.analysisPlanSchema, "analysis-plan.schema.json");
  assert.equal(output.manifest.analysisPlanAuditFile, "analysis-plan-audit.json");
  assert.deepEqual(paths, [
    "README.md",
    "analysis-task.json",
    "analysis-plan-audit.json",
    "analysis-plan.schema.json",
    "asset-index.json",
    "backtest-runbook.json",
    "ci-workflow.json",
    "handoff-summary.json",
    "index.html",
    "integration-contract.json",
    "layerdoc-audit.json",
    "layerdoc.schema.json",
    "layerdoc.json",
    "manifest.json",
    "package.json",
    "preview.html",
    "production-manifest.json",
    "production-manifest.schema.json",
    "quality-gates.json",
    "section-candidate.schema.json",
    "scripts/verify-analysis-plan.mjs",
    "scripts/apply-section-candidate.mjs",
    "scripts/verify-ci-workflow.mjs",
    "scripts/verify-contract.mjs",
    "scripts/verify-gates.mjs",
    "scripts/verify-handoff.mjs",
    "scripts/verify-image-manifest.mjs",
    "scripts/verify-layerdoc.mjs",
    "scripts/verify-preview.mjs",
    "scripts/verify-production-manifest.mjs",
    "scripts/verify-section-application.mjs",
    "scripts/verify-section-candidate.mjs",
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
  const packageJson = JSON.parse(output.files.find((file) => file.path === "package.json").contents);
  assert.equal(packageJson.scripts.verify, EXPECTED_VERIFY_CHAIN);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"verify:handoff": "node scripts\/verify-handoff\.mjs"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"ci": "npm run verify && npm run build"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"verify:ci-workflow": "node scripts\/verify-ci-workflow\.mjs"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"verify:analysis-plan": "node scripts\/verify-analysis-plan\.mjs"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"verify:image-manifest": "node scripts\/verify-image-manifest\.mjs"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"verify:preview": "node scripts\/verify-preview\.mjs"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"verify:production-manifest": "node scripts\/verify-production-manifest\.mjs"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"verify:gates": "node scripts\/verify-gates\.mjs"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"apply:section-candidate": "node scripts\/apply-section-candidate\.mjs"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"verify:section-application": "node scripts\/verify-section-application\.mjs"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"verify:layerdoc": "node scripts\/verify-layerdoc\.mjs"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"verify:contract": "node scripts\/verify-contract\.mjs"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"verify:section-candidate": "node scripts\/verify-section-candidate\.mjs"/);
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
  const productionManifest = JSON.parse(output.files.find((file) => file.path === "production-manifest.json").contents);
  const productionManifestSchema = JSON.parse(output.files.find((file) => file.path === "production-manifest.schema.json").contents);
  const analysisTask = JSON.parse(output.files.find((file) => file.path === "analysis-task.json").contents);
  const backtestRunbook = JSON.parse(output.files.find((file) => file.path === "backtest-runbook.json").contents);
  const ciWorkflow = JSON.parse(output.files.find((file) => file.path === "ci-workflow.json").contents);
  const assetIndex = JSON.parse(output.files.find((file) => file.path === "asset-index.json").contents);
  const exportedLayerDoc = JSON.parse(output.files.find((file) => file.path === "layerdoc.json").contents);
  assert.deepEqual(manifest.referenceVisual, output.manifest.referenceVisual);
  assert.equal(manifest.analysisTaskFile, output.manifest.analysisTaskFile);
  assert.deepEqual(manifest.analysisPlan, output.manifest.analysisPlan);
  assert.deepEqual(manifest.analysisPlanAudit, output.manifest.analysisPlanAudit);
  assert.equal(manifest.productionManifest, output.manifest.productionManifest);
  assert.equal(manifest.productionManifestSchema, output.manifest.productionManifestSchema);
  assert.equal(manifest.backtestRunbook, output.manifest.backtestRunbook);
  assert.equal(manifest.ciWorkflow, output.manifest.ciWorkflow);
  assert.equal(manifest.assetIndex, output.manifest.assetIndex);
  assert.equal(productionManifestSchema.title, "ProjectProductionManifest 0.1.0");
  assert.deepEqual(productionManifestSchema.required, [
    "version",
    "system",
    "role",
    "sourceOfTruth",
    "generated",
    "quality",
    "regeneration",
    "runbooks",
    "integrationSteps"
  ]);
  assert.equal(productionManifestSchema.properties.role.const, "project_integration_manifest");
  assert.deepEqual(productionManifestSchema.properties.sourceOfTruth.required, ["type", "file", "schemaFile", "hash", "editable"]);
  assert.deepEqual(productionManifestSchema.properties.generated.required, ["react", "preview", "contract", "assets"]);
  assert.equal(productionManifestSchema.properties.quality.properties.scores.required.includes("visual_similarity"), true);
  assert.deepEqual(productionManifestSchema.properties.runbooks.required, ["backtest", "ci"]);
  assert.equal(productionManifestSchema.properties.integrationSteps.items.required.includes("command"), true);
  assert.equal(productionManifest.role, "project_integration_manifest");
  assert.deepEqual(productionManifest.sourceOfTruth, {
    type: "LayerDoc",
    file: "layerdoc.json",
    schemaFile: "layerdoc.schema.json",
    hash: output.manifest.layerDocHash,
    editable: true
  });
  assert.equal(productionManifest.intake.analysisTaskFile, "analysis-task.json");
  assert.equal(analysisTask.kind, "homepage-png-analysis");
  assert.equal(analysisTask.name, "Production Homepage");
  assert.deepEqual(analysisTask.sourceImage, {
    uri: "/references/production-homepage.png",
    width: 1440,
    height: 900
  });
  assert.equal(analysisTask.outputContract.schemaFile, "analysis-plan.schema.json");
  assert.equal(analysisTask.outputContract.minSections, 8);
  assert.equal(analysisTask.outputContract.maxSections, 15);
  assert.equal(analysisTask.constraints.some((constraint) => /full PNG/.test(constraint)), true);
  assert.match(analysisTask.operatorPrompt, /Image -> HomepageAnalysisPlan -> LayerDoc/);
  assert.deepEqual(productionManifest.generated.react, {
    component: "ProductionHomepage",
    file: "src/ProductionHomepage.tsx",
    rootSelector: '[data-layerdoc-version="0.1.0"]',
    styling: "tailwind"
  });
  assert.deepEqual(productionManifest.generated.contract, {
    file: "integration-contract.json",
    verifierCommand: "npm run verify:contract",
    sections: 1,
    layers: 2,
    components: 1,
    assets: 0,
    interactions: 0,
    responsiveRules: 1
  });
  assert.deepEqual(productionManifest.generated.assets, {
    file: "asset-index.json",
    total: 0,
    used: 0,
    visibleInProject: 0,
    bySource: {},
    byType: {}
  });
  assert.deepEqual(productionManifest.quality.scores, {
    visual_similarity: output.manifest.scores.visualSimilarity,
    structure_score: output.manifest.scores.structureScore,
    component_score: output.manifest.scores.componentScore,
    project_fit_score: output.manifest.scores.projectFitScore
  });
  assert.deepEqual(productionManifest.runbooks.backtest, {
    file: "backtest-runbook.json",
    kind: "studio_backtest_runbook"
  });
  assert.deepEqual(productionManifest.runbooks.ci, {
    file: "ci-workflow.json",
    kind: "project_ci_workflow",
    command: "npm run ci"
  });
  assert.equal(ciWorkflow.version, "0.1.0");
  assert.equal(ciWorkflow.kind, "project_ci_workflow");
  assert.equal(ciWorkflow.packageName, output.manifest.packageName);
  assert.equal(ciWorkflow.componentName, output.manifest.componentName);
  assert.deepEqual(ciWorkflow.sourceOfTruth, {
    file: "layerdoc.json",
    schemaFile: "layerdoc.schema.json",
    hash: output.manifest.layerDocHash
  });
  assert.deepEqual(ciWorkflow.entrypoint, {
    productionManifest: "production-manifest.json",
    handoffSummary: "handoff-summary.json",
    integrationContract: "integration-contract.json",
    verificationReport: "verification-report.json",
    qualityGates: "quality-gates.json"
  });
  assert.equal(ciWorkflow.requiredCommands.includes("npm run verify:preview"), true);
  assert.equal(ciWorkflow.requiredCommands.includes("npm run verify:production-manifest"), true);
  assert.equal(ciWorkflow.requiredCommands.includes("npm run verify:ci-workflow"), true);
  assert.equal(ciWorkflow.requiredCommands.includes("npm run verify:gates"), true);
  assert.deepEqual(ciWorkflow.phases.map((phase) => phase.id), ["install", "verify-preview", "verify-structure", "verify-gates", "build"]);
  assert.match(ciWorkflow.phases.find((phase) => phase.id === "verify-structure").command, /npm run verify:handoff/);
  assert.doesNotMatch(ciWorkflow.phases.find((phase) => phase.id === "verify-structure").command, /npm run verify:preview/);
  assert.equal(ciWorkflow.phases.find((phase) => phase.id === "verify-gates").artifacts.includes("quality-gates.json"), true);
  assert.equal(backtestRunbook.version, "0.1.0");
  assert.equal(backtestRunbook.kind, "studio_backtest_runbook");
  assert.equal(backtestRunbook.packageName, output.manifest.packageName);
  assert.equal(backtestRunbook.componentName, output.manifest.componentName);
  assert.deepEqual(backtestRunbook.sourceOfTruth, {
    file: "layerdoc.json",
    schemaFile: "layerdoc.schema.json",
    hash: output.manifest.layerDocHash
  });
  assert.equal(backtestRunbook.artifacts.productionManifest, "production-manifest.json");
  assert.equal(backtestRunbook.artifacts.ciWorkflow, "ci-workflow.json");
  assert.equal(backtestRunbook.artifacts.handoffSummary, "handoff-summary.json");
  assert.equal(backtestRunbook.artifacts.projectPackage, "project-package.json");
  assert.equal(backtestRunbook.commands.some((entry) => entry.command === "npm run backtest:homepage -- --out artifacts/homepage-backtest --component ProductionHomepage"), true);
  assert.equal(backtestRunbook.commands.some((entry) => /npm run pipeline:homepage --/.test(entry.command) && /--verify-project/.test(entry.command)), true);
  assert.equal(backtestRunbook.commands.some((entry) => /npm run materialize:project --/.test(entry.command) && /--verify-preview/.test(entry.command)), true);
  assert.equal(backtestRunbook.projectVerification.commands.some((entry) => entry.command === "npm run verify:production-manifest"), true);
  assert.equal(backtestRunbook.projectVerification.commands.some((entry) => entry.command === "npm run verify:ci-workflow"), true);
  assert.equal(backtestRunbook.projectVerification.commands.some((entry) => entry.command === "npm run verify:preview"), true);
  assert.deepEqual(productionManifest.integrationSteps.map((step) => step.command), [
    "npm install",
    "npm run verify:preview",
    "npm run verify",
    "npm run build"
  ]);
  assert.deepEqual(assetIndex.summary, {
    total: 0,
    used: 0,
    visibleInProject: 0,
    bySource: {},
    byType: {}
  });
  assert.deepEqual(exportedLayerDoc.metadata.analysisPlanAudit, output.manifest.analysisPlanAudit);
  assert.equal(contract.component.name, "ProductionHomepage");
  assert.equal(contract.component.file, "src/ProductionHomepage.tsx");
  assert.deepEqual(contract.component.verificationAttributes, expectedVerificationAttributesFor(output.manifest.scores));
  assert.deepEqual(contract.preview.verificationAttributes, expectedVerificationAttributesFor(output.manifest.scores));
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
  assert.deepEqual(contract.generationRequests, []);
  assert.deepEqual(contract.generationApplications, []);
  const layerDocSchema = JSON.parse(output.files.find((file) => file.path === "layerdoc.schema.json").contents);
  assert.equal(layerDocSchema.properties.schema.const, "layerdoc");
  assert.deepEqual(layerDocSchema.properties.metadata.properties.sourceImage.required, ["uri", "width", "height"]);
  assert.deepEqual(layerDocSchema.properties.metadata.properties.analysisPlan.required, ["source", "name", "sectionCount", "layerCount"]);
  assert.deepEqual(layerDocSchema.properties.metadata.properties.analysisPlan.properties.source.enum, ["seeded", "provided", "editor", "manual", "mock-vision"]);
  assert.deepEqual(layerDocSchema.properties.metadata.properties.analysisPlanAudit.required, [
    "summary",
    "tracks",
    "coverage",
    "readiness",
    "issues",
    "sectionBreakdown"
  ]);
  assert.deepEqual(layerDocSchema.properties.metadata.properties.analysisPlanAudit.properties.tracks.required, [
    "component",
    "asset",
    "approximation",
    "layout"
  ]);
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
  assert.deepEqual(layerDocSchema.properties.verification.required, ["scores", "issues", "visualProblemAreas"]);
  const visualProblemAreaSchema = layerDocSchema.properties.verification.properties.visualProblemAreas.items;
  assert.deepEqual(visualProblemAreaSchema.required, [
    "id",
    "bounds",
    "affectedLayerId",
    "affectedLayerKind",
    "affectedLayerTrack",
    "affectedLayerEditable",
    "affectedSectionId"
  ]);
  assert.equal(visualProblemAreaSchema.additionalProperties, false);
  assert.deepEqual(visualProblemAreaSchema.properties.affectedLayerTrack.enum, [
    "component",
    "asset",
    "approximation",
    "layout",
    null
  ]);
  assert.equal(layerDocSchema.properties.responsive.properties.rules.items.required.includes("target"), true);
  assert.deepEqual(layerDocSchema.properties.responsive.properties.rules.items.properties.target.properties.type.enum, [
    "section",
    "layer",
    "component"
  ]);
  assert.match(output.files.find((file) => file.path === "layerdoc-audit.json").contents, /"assetCompliance"/);
  assert.match(output.files.find((file) => file.path === "analysis-plan.schema.json").contents, /"HomepageAnalysisPlan 0.1.0"/);
  const sectionCandidateSchema = JSON.parse(output.files.find((file) => file.path === "section-candidate.schema.json").contents);
  assert.equal(sectionCandidateSchema.title, "SectionRegenerationCandidate 0.1.0");
  assert.deepEqual(sectionCandidateSchema.required, ["section", "layers"]);
  assert.equal(sectionCandidateSchema.properties.layers.items.properties.track.enum.includes("asset"), true);
  assert.deepEqual(JSON.parse(output.files.find((file) => file.path === "analysis-plan-audit.json").contents), output.manifest.analysisPlanAudit);
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
  assert.deepEqual(handoffSummary.sourceAnalysisPlanAudit, output.manifest.analysisPlanAudit);
  assert.deepEqual(handoffSummary.sourceAnalysisPlanFiles, {
    taskFile: "analysis-task.json",
    schemaFile: "analysis-plan.schema.json",
    auditFile: "analysis-plan-audit.json"
  });
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
    responsiveRules: 1,
    generationRequests: 0,
    generationApplications: 0
  });
  assert.deepEqual(handoffSummary.assetIndex, {
    file: "asset-index.json",
    total: 0,
    used: 0,
    visibleInProject: 0,
    bySource: {},
    byType: {}
  });
  assert.deepEqual(handoffSummary.ciWorkflow, {
    file: "ci-workflow.json",
    kind: "project_ci_workflow",
    command: "npm run ci"
  });
  assert.deepEqual(handoffSummary.sectionRegeneration, {
    candidateSchemaFile: "section-candidate.schema.json",
    requestCount: 0,
    applicationCount: 0
  });
  assert.deepEqual(handoffSummary.quality.scores, {
    visual_similarity: output.manifest.scores.visualSimilarity,
    structure_score: output.manifest.scores.structureScore,
    component_score: output.manifest.scores.componentScore,
    project_fit_score: output.manifest.scores.projectFitScore
  });
  assert.equal(handoffSummary.quality.visualEvidence.kind, "none");
  assert.deepEqual(handoffSummary.quality.visualProblems, {
    total: 0,
    affectedLayerIds: [],
    unmapped: 0,
    areas: []
  });
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
      "npm run ci",
      "npm run verify",
      "npm run verify:preview",
      "npm run verify:production-manifest",
      "npm run verify:ci-workflow",
      "npm run verify:handoff",
      "npm run verify:analysis-plan",
      "npm run verify:image-manifest",
      "npm run verify:layerdoc",
      "npm run verify:contract",
      "npm run apply:section-candidate",
      "npm run verify:section-candidate",
      "npm run verify:section-application",
      "npm run verify:gates"
    ]
  );
  assert.match(output.files.find((file) => file.path === "scripts/verify-gates.mjs").contents, /verification-report\.json/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-ci-workflow.mjs").contents, /ci-workflow\.json/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-handoff.mjs").contents, /handoff-summary\.json/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-handoff.mjs").contents, /backtest-runbook\.json/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-handoff.mjs").contents, /ci-workflow\.json/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-handoff.mjs").contents, /asset-index\.json/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-handoff.mjs").contents, /package\.json/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-analysis-plan.mjs").contents, /analysis-plan-audit\.json/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-analysis-plan.mjs").contents, /analysis-task\.json/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-analysis-plan.mjs").contents, /analysis-plan\.schema\.json/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-image-manifest.mjs").contents, /image-manifest\.json/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-image-manifest.mjs").contents, /manifest\.json/);
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
  assert.match(output.files.find((file) => file.path === "scripts/apply-section-candidate.mjs").contents, /apply:section-candidate/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-preview.mjs").contents, /preview\.html/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-preview.mjs").contents, /verification-report\.json/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-production-manifest.mjs").contents, /production-manifest\.json/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-section-application.mjs").contents, /verify:section-application/);
  assert.match(output.files.find((file) => file.path === "scripts/verify-section-candidate.mjs").contents, /section-candidate\.schema\.json/);
  assert.match(output.files.find((file) => file.path === "preview.html").contents, /data-layerdoc="0.1.0"/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm install/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run dev/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run verify/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run verify:handoff/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run verify:analysis-plan/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /analysis-task\.json/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run verify:image-manifest/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run verify:gates/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run verify:contract/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run verify:layerdoc/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run verify:preview/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run verify:production-manifest/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run verify:ci-workflow/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /ci-workflow\.json/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run verify:section-candidate/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run verify:section-application/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /manifest reference visual/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /production-manifest\.json/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /production-manifest\.schema\.json/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /recommended integration entrypoint/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /handoff-summary\.json/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /backtest-runbook\.json/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /asset-index\.json/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /integration-contract\.json/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /layerdoc\.schema\.json/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /section-candidate\.schema\.json/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /visual_evidence:/);
});

test("createProjectExportPackage exports a LayerDoc asset index for downstream integration", () => {
  const output = createProjectExportPackage(createAssetExportDoc(), { componentName: "AssetHomepage" });
  const assetIndex = JSON.parse(output.files.find((file) => file.path === "asset-index.json").contents);

  assert.equal(assetIndex.version, "0.1.0");
  assert.equal(assetIndex.source, "layerdoc");
  assert.deepEqual(assetIndex.layerDoc, {
    file: "layerdoc.json",
    hash: output.manifest.layerDocHash
  });
  assert.deepEqual(assetIndex.summary, {
    total: 1,
    used: 1,
    visibleInProject: 1,
    bySource: { "reference-crop": 1 },
    byType: { image: 1 }
  });
  assert.deepEqual(assetIndex.assets, [
    {
      id: "hero-crop",
      type: "image",
      source: "reference-crop",
      uri: "/assets/hero-crop.png",
      bounds: null,
      usedByLayerIds: ["hero-image"],
      visibleUsedByLayerIds: ["hero-image"],
      sectionIds: ["hero"],
      visibleSectionIds: ["hero"],
      componentIds: ["HeroSection"],
      visibleInProject: true,
      layerSelectors: ['[data-layer-id="hero-image"]']
    }
  ]);
});

test("createProjectExportPackage can carry a controlled editor edit audit", () => {
  const output = createProjectExportPackage(createExportDoc(), {
    componentName: "ProductionHomepage",
    editAudit: {
      kind: "controlled_editor_edit_audit",
      source: "editor-workspace",
      entries: [
        {
          id: "edit-1",
          operation: "update-text",
          label: "Update headline text",
          selectedLayerIdBefore: "headline",
          selectedLayerIdAfter: "headline",
          affectedLayerIds: ["headline"],
          affectedSectionIds: ["hero"]
        },
        {
          id: "edit-2",
          operation: "move-section",
          label: "Move hero section",
          selectedLayerIdBefore: "headline",
          selectedLayerIdAfter: "headline",
          affectedLayerIds: [],
          affectedSectionIds: ["hero"]
        }
      ],
      undoneEntries: []
    }
  });
  const manifest = JSON.parse(output.files.find((file) => file.path === "manifest.json").contents);
  const handoffSummary = JSON.parse(output.files.find((file) => file.path === "handoff-summary.json").contents);
  const editAuditFile = output.files.find((file) => file.path === "edit-audit.json");

  assert.equal(output.manifest.editAuditFile, "edit-audit.json");
  assert.equal(Boolean(editAuditFile), true);
  const editAudit = JSON.parse(editAuditFile.contents);
  assert.equal(manifest.editAuditFile, "edit-audit.json");
  assert.equal(output.manifest.files.includes("edit-audit.json"), true);
  assert.equal(editAudit.kind, "controlled_editor_edit_audit");
  assert.equal(editAudit.layerDoc.hash, output.manifest.layerDocHash);
  assert.deepEqual(editAudit.summary, {
    appliedEdits: 2,
    undoneEdits: 0,
    operations: { "update-text": 1, "move-section": 1 },
    affectedLayerIds: ["headline"],
    affectedSectionIds: ["hero"]
  });
  assert.deepEqual(editAudit.entries.map((entry) => entry.operation), ["update-text", "move-section"]);
  assert.deepEqual(handoffSummary.editAudit, {
    file: "edit-audit.json",
    kind: "controlled_editor_edit_audit",
    appliedEdits: 2,
    undoneEdits: 0,
    operations: { "update-text": 1, "move-section": 1 },
    affectedLayerIds: ["headline"],
    affectedSectionIds: ["hero"]
  });

  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-edit-audit-"));
  writeProjectExportPackage(output, directory);
  const passed = spawnSync(process.execPath, ["scripts/verify-handoff.mjs"], { cwd: directory, encoding: "utf8" });
  assert.equal(passed.status, 0, passed.stderr || passed.stdout);

  const auditPath = join(directory, "edit-audit.json");
  const staleAudit = JSON.parse(readFileSync(auditPath, "utf8"));
  staleAudit.summary.appliedEdits = 99;
  writeFileSync(auditPath, `${JSON.stringify(staleAudit, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-handoff.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /edit_audit_mismatch/);
  assert.match(failed.stdout, /edit-audit\.json/);
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
  assert.deepEqual(layerDoc.verification.visualProblemAreas, report.visualProblemAreas);
  assert.equal(manifest.layerDocHash, output.manifest.layerDocHash);
  assert.equal(contract.layerDoc.hash, output.manifest.layerDocHash);
});

test("writeProjectExportPackage writes every package file under the target directory", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-export-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });

  const written = writeProjectExportPackage(output, directory);

  assert.equal(written.files.length, output.files.length);
  assert.equal(existsSync(join(directory, "src", "ProductionHomepage.tsx")), true);
  assert.equal(existsSync(join(directory, "integration-contract.json")), true);
  assert.equal(existsSync(join(directory, "asset-index.json")), true);
  assert.equal(existsSync(join(directory, "production-manifest.json")), true);
  assert.equal(existsSync(join(directory, "production-manifest.schema.json")), true);
  assert.equal(existsSync(join(directory, "handoff-summary.json")), true);
  assert.equal(existsSync(join(directory, "analysis-plan.schema.json")), true);
  assert.equal(existsSync(join(directory, "analysis-plan-audit.json")), true);
  assert.equal(existsSync(join(directory, "layerdoc-audit.json")), true);
  assert.equal(existsSync(join(directory, "layerdoc.schema.json")), true);
  assert.equal(existsSync(join(directory, "src", "main.tsx")), true);
  assert.equal(existsSync(join(directory, "package.json")), true);
  assert.equal(existsSync(join(directory, "vite.config.ts")), true);
  assert.equal(existsSync(join(directory, "scripts", "verify-gates.mjs")), true);
  assert.equal(existsSync(join(directory, "scripts", "verify-contract.mjs")), true);
  assert.equal(existsSync(join(directory, "scripts", "verify-layerdoc.mjs")), true);
  assert.equal(existsSync(join(directory, "scripts", "verify-preview.mjs")), true);
  assert.equal(existsSync(join(directory, "scripts", "verify-production-manifest.mjs")), true);
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

test("exported handoff verifier checks the asset index against LayerDoc and contract assets", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-asset-index-verifier-"));
  const output = createProjectExportPackage(createAssetExportDoc(), { componentName: "AssetHomepage" });
  writeProjectExportPackage(output, directory);

  const assetIndexPath = join(directory, "asset-index.json");
  const assetIndex = JSON.parse(readFileSync(assetIndexPath, "utf8"));
  assetIndex.assets[0].uri = "/assets/stale-hero.png";
  writeFileSync(assetIndexPath, `${JSON.stringify(assetIndex, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-handoff.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /asset_index_mismatch/);
  assert.match(failed.stdout, /asset-index\.json/);
  assert.match(failed.stdout, /hero-crop/);
});

test("exported handoff verifier checks the production manifest against project handoff files", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-production-manifest-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const productionManifestPath = join(directory, "production-manifest.json");
  const productionManifest = JSON.parse(readFileSync(productionManifestPath, "utf8"));
  productionManifest.generated.react.file = "src/StaleHomepage.tsx";
  writeFileSync(productionManifestPath, `${JSON.stringify(productionManifest, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-handoff.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /production_manifest_mismatch/);
  assert.match(failed.stdout, /production-manifest\.json/);
  assert.match(failed.stdout, /src\/ProductionHomepage\.tsx/);
});

test("exported handoff verifier checks the production manifest schema contract", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-production-manifest-schema-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const schemaPath = join(directory, "production-manifest.schema.json");
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  schema.properties.role.const = "stale_manifest_role";
  writeFileSync(schemaPath, `${JSON.stringify(schema, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-handoff.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /production_manifest_schema_mismatch/);
  assert.match(failed.stdout, /production-manifest\.schema\.json/);
  assert.match(failed.stdout, /project_integration_manifest/);
});

test("exported production manifest verifier validates the integration entrypoint independently", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-production-manifest-standalone-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const passed = spawnSync(process.execPath, ["scripts/verify-production-manifest.mjs"], { cwd: directory, encoding: "utf8" });
  assert.equal(passed.status, 0, passed.stderr || passed.stdout);
  assert.match(passed.stdout, /"passed": true/);
  assert.match(passed.stdout, /"productionManifestPath": "production-manifest\.json"/);

  const productionManifestPath = join(directory, "production-manifest.json");
  const productionManifest = JSON.parse(readFileSync(productionManifestPath, "utf8"));
  productionManifest.quality.scores.project_fit_score = 12;
  writeFileSync(productionManifestPath, `${JSON.stringify(productionManifest, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-production-manifest.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /production_manifest_mismatch/);
  assert.match(failed.stdout, /project_fit_score/);
});

test("exported CI workflow verifier validates project automation handoff independently", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-ci-workflow-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const passed = spawnSync(process.execPath, ["scripts/verify-ci-workflow.mjs"], { cwd: directory, encoding: "utf8" });
  assert.equal(passed.status, 0, passed.stderr || passed.stdout);
  assert.match(passed.stdout, /"passed": true/);
  assert.match(passed.stdout, /"ciWorkflowPath": "ci-workflow\.json"/);

  const ciWorkflowPath = join(directory, "ci-workflow.json");
  const ciWorkflow = JSON.parse(readFileSync(ciWorkflowPath, "utf8"));
  ciWorkflow.phases.find((phase) => phase.id === "verify-gates").command = "npm run test";
  writeFileSync(ciWorkflowPath, `${JSON.stringify(ciWorkflow, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-ci-workflow.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /ci_workflow_mismatch/);
  assert.match(failed.stdout, /npm run verify:gates/);
});

test("createProjectExportPackage can include the visual reference PNG as a binary file", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-reference-export-"));
  const referencePng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
  const output = createProjectExportPackage(createExportDoc(), {
    componentName: "ProductionHomepage",
    referencePng
  });

  assert.equal(output.manifest.files.includes("reference.png"), true);
  const referenceFile = output.files.find((file) => file.path === "reference.png");
  assert.equal(referenceFile.contents instanceof Uint8Array, true);
  assert.deepEqual([...referenceFile.contents], [...referencePng]);

  writeProjectExportPackage(output, directory);
  assert.deepEqual([...readFileSync(join(directory, "reference.png"))], [...referencePng]);
});

test("parseProjectExportPackageJson restores base64 binary files for project writers", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-json-export-"));
  const referencePng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
  const output = createProjectExportPackage(createExportDoc(), {
    componentName: "ProductionHomepage",
    referencePng
  });
  const jsonPackage = {
    ...output,
    files: output.files.map((file) =>
      typeof file.contents === "string"
        ? file
        : {
            path: file.path,
            contentEncoding: "base64",
            contentsBase64: Buffer.from(file.contents).toString("base64")
          }
    )
  };

  const parsed = parseProjectExportPackageJson(JSON.stringify(jsonPackage));
  const referenceFile = parsed.files.find((file) => file.path === "reference.png");
  const written = writeProjectExportPackage(parsed, directory);

  assert.equal(parsed.manifest.files.includes("reference.png"), true);
  assert.equal(referenceFile.contents instanceof Uint8Array, true);
  assert.deepEqual([...referenceFile.contents], [...referencePng]);
  assert.equal(written.files.some((file) => file.relativePath === "reference.png"), true);
  assert.deepEqual([...readFileSync(join(directory, "reference.png"))], [...referencePng]);
});

test("parseProjectExportPackageJson rejects malformed binary handoff entries", () => {
  const output = createProjectExportPackage(createExportDoc(), {
    componentName: "ProductionHomepage",
    referencePng: new Uint8Array([0x89, 0x50])
  });
  const jsonPackage = {
    ...output,
    files: output.files.map((file) =>
      file.path === "reference.png" ? { path: file.path, contentEncoding: "base64", contentsBase64: "not png bytes!" } : file
    )
  };

  assert.throws(
    () => parseProjectExportPackageJson(JSON.stringify(jsonPackage)),
    /Project package file "reference\.png" has invalid base64 contents/
  );
});

test("parseProjectExportPackageJson rejects files outside the project root", () => {
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  const jsonPackage = {
    ...output,
    manifest: {
      ...output.manifest,
      files: [...output.manifest.files, "../escape.txt"]
    },
    files: [...output.files, { path: "../escape.txt", contents: "outside" }]
  };

  assert.throws(
    () => parseProjectExportPackageJson(JSON.stringify(jsonPackage)),
    /Project package file path "\.\.\/escape\.txt" must stay inside the project root/
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

test("exported integration contract verifier checks section regeneration requests", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-regeneration-contract-"));
  const output = createProjectExportPackage(createRegenerationExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const contractPath = join(directory, "integration-contract.json");
  const handoffSummary = JSON.parse(readFileSync(join(directory, "handoff-summary.json"), "utf8"));
  const contract = JSON.parse(readFileSync(contractPath, "utf8"));
  assert.deepEqual(contract.generationRequests, [
    {
      id: "regen-hero-1",
      sectionId: "hero",
      prompt: "Regenerate the hero section with stronger enterprise positioning.",
      status: "requested",
      requestedAt: "2026-06-30T10:05:00.000Z",
      selector: '[data-section-id="hero"]',
      sectionVisible: true
    }
  ]);
  assert.deepEqual(contract.generationApplications, []);
  assert.equal(handoffSummary.contract.generationRequests, 1);
  assert.equal(handoffSummary.contract.generationApplications, 0);
  assert.equal(handoffSummary.sectionRegeneration.applicationCount, 0);

  contract.generationRequests[0].status = "applied";
  writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /integration_contract_mismatch/);
  assert.match(failed.stdout, /generationRequests/);
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

test("exported integration contract verifier checks root verification attributes", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-root-verification-contract-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const componentPath = join(directory, "src", "ProductionHomepage.tsx");
  const previewPath = join(directory, "preview.html");
  const componentSource = readFileSync(componentPath, "utf8");
  const previewSource = readFileSync(previewPath, "utf8");
  writeFileSync(componentPath, componentSource.replace(' data-verification-visual-similarity="n/a"', ""));
  writeFileSync(previewPath, previewSource.replace(' data-verification-visual-similarity="n/a"', ""));

  const failed = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /project_verification_attribute_missing/);
  assert.match(failed.stdout, /preview_verification_attribute_missing/);
  assert.match(failed.stdout, /data-verification-visual-similarity/);
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

test("exported LayerDoc verifier script rejects invalid Analysis Plan audit metadata", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-plan-audit-verifier-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const layerDocPath = join(directory, "layerdoc.json");
  const layerDoc = JSON.parse(readFileSync(layerDocPath, "utf8"));
  layerDoc.metadata.analysisPlanAudit.readiness.readyForLayerDoc = "yes";
  writeFileSync(layerDocPath, `${JSON.stringify(layerDoc, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-layerdoc.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /metadata_invalid/);
  assert.match(failed.stdout, /metadata\.analysisPlanAudit\.readiness\.readyForLayerDoc/);
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
  const output = createProjectExportPackage(createPreviewAttributionDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const referencePath = join(directory, "reference.png");
  const candidatePath = join(directory, "candidate.png");
  writeSolidPng(referencePath, 20, 20, [255, 255, 255, 255]);
  writeSolidPng(candidatePath, 20, 20, [255, 255, 255, 255], [{ x: 1, y: 0, color: [15, 23, 42, 255] }]);

  const result = spawnSync(
    process.execPath,
    ["scripts/verify-preview.mjs", "--reference", referencePath, "--candidate", candidatePath, "--out", "verification-artifacts", "--threshold", "0"],
    { cwd: directory, encoding: "utf8", env: { ...process.env, NODE_PATH: join(process.cwd(), "node_modules") } }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /"visualSimilarity": 99.75/);
  assert.equal(existsSync(join(directory, "verification-artifacts", "diff.png")), true);
  const report = JSON.parse(readFileSync(join(directory, "verification-report.json"), "utf8"));
  const manifest = JSON.parse(readFileSync(join(directory, "manifest.json"), "utf8"));
  const productionManifest = JSON.parse(readFileSync(join(directory, "production-manifest.json"), "utf8"));
  const handoffSummary = JSON.parse(readFileSync(join(directory, "handoff-summary.json"), "utf8"));
  const layerDoc = JSON.parse(readFileSync(join(directory, "layerdoc.json"), "utf8"));
  const contract = JSON.parse(readFileSync(join(directory, "integration-contract.json"), "utf8"));
  const componentSource = readFileSync(join(directory, "src", "ProductionHomepage.tsx"), "utf8");
  const previewSource = readFileSync(join(directory, "preview.html"), "utf8");
  const expectedAttributes = expectedVerificationAttributesFor(report);
  assert.equal(report.visualSimilarity, 99.75);
  assert.equal(report.evidence.visual.kind, "html-screenshot");
  assert.equal(report.visualDiff.diffPath, "verification-artifacts/diff.png");
  assert.deepEqual(report.visualDiff.problemAreas, [{ x: 1, y: 0, width: 1, height: 1 }]);
  assert.deepEqual(report.visualProblemAreas, [
    {
      id: "visual-problem-1",
      bounds: { x: 1, y: 0, width: 1, height: 1 },
      affectedLayerId: "headline",
      affectedLayerKind: "text",
      affectedLayerTrack: "component",
      affectedLayerEditable: true,
      affectedSectionId: "hero"
    }
  ]);
  assert.deepEqual(manifest.scores.visualProblemAreas, report.visualProblemAreas);
  assert.equal(manifest.scores.visualSimilarity, 99.75);
  assert.equal(manifest.scores.evidence.visual.kind, "html-screenshot");
  assert.equal(productionManifest.sourceOfTruth.hash, manifest.layerDocHash);
  assert.deepEqual(productionManifest.quality.scores, {
    visual_similarity: 99.75,
    structure_score: report.structureScore,
    component_score: report.componentScore,
    project_fit_score: report.projectFitScore
  });
  assert.equal(productionManifest.quality.visualEvidence.kind, "html-screenshot");
  assert.equal(handoffSummary.quality.scores.visual_similarity, 99.75);
  assert.equal(handoffSummary.quality.visualEvidence.kind, "html-screenshot");
  assert.deepEqual(handoffSummary.quality.visualProblems, {
    total: 1,
    affectedLayerIds: ["headline"],
    unmapped: 0,
    areas: report.visualProblemAreas
  });
  assert.equal(layerDoc.verification.scores.visualSimilarity, 99.75);
  assert.deepEqual(layerDoc.verification.visualProblemAreas, report.visualProblemAreas);
  assert.deepEqual(contract.component.verificationAttributes, expectedAttributes);
  assert.deepEqual(contract.preview.verificationAttributes, expectedAttributes);
  assert.equal(contract.layerDoc.hash, manifest.layerDocHash);
  assert.equal(handoffSummary.sourceOfTruth.hash, manifest.layerDocHash);
  assert.match(componentSource, /data-verification-visual-similarity="99.75"/);
  assert.match(previewSource, /data-verification-visual-similarity="99.75"/);

  const layerDocVerification = spawnSync(process.execPath, ["scripts/verify-layerdoc.mjs"], { cwd: directory, encoding: "utf8" });
  assert.equal(layerDocVerification.status, 0, layerDocVerification.stderr);

  const contractVerification = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.equal(contractVerification.status, 0, contractVerification.stderr);

  const handoffVerification = spawnSync(process.execPath, ["scripts/verify-handoff.mjs"], { cwd: directory, encoding: "utf8" });
  assert.equal(handoffVerification.status, 0, handoffVerification.stderr);
  assert.match(handoffVerification.stdout, /"passed": true/);
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

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /"visualSimilarity": 100/);
  assert.match(result.stdout, /"referencePath":/);
  assert.match(result.stdout, /reference\.png/);
  const report = JSON.parse(readFileSync(join(directory, "verification-report.json"), "utf8"));
  assert.equal(report.visualSimilarity, 100);
});

test("exported section candidate verifier script validates reviewed regeneration output", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-section-candidate-verifier-"));
  const output = createProjectExportPackage(createRegenerationExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const candidatePath = join(directory, "hero-candidate.json");
  writeFileSync(candidatePath, `${JSON.stringify(createHeroSectionCandidate(), null, 2)}\n`);

  const passed = spawnSync(process.execPath, ["scripts/verify-section-candidate.mjs", "--input", candidatePath], {
    cwd: directory,
    encoding: "utf8"
  });
  assert.equal(passed.status, 0, passed.stderr);
  assert.match(passed.stdout, /"passed": true/);
  assert.match(passed.stdout, /"sectionId": "hero"/);
  assert.match(passed.stdout, /"layerCount": 2/);

  const brokenCandidate = JSON.parse(readFileSync(candidatePath, "utf8"));
  brokenCandidate.section.id = "missing-section";
  brokenCandidate.layers[0].sectionId = "missing-section";
  brokenCandidate.layers[1].sectionId = "missing-section";
  writeFileSync(candidatePath, `${JSON.stringify(brokenCandidate, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-section-candidate.mjs", "--input", candidatePath], {
    cwd: directory,
    encoding: "utf8"
  });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /section_candidate_section_missing/);
  assert.match(failed.stdout, /missing-section/);
});

test("exported section candidate apply script updates LayerDoc and derived handoff artifacts", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-section-candidate-apply-"));
  const output = createProjectExportPackage(createRegenerationExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const candidatePath = join(directory, "hero-candidate.json");
  writeFileSync(candidatePath, `${JSON.stringify(createHeroSectionCandidate(), null, 2)}\n`);

  const applied = spawnSync(process.execPath, ["scripts/apply-section-candidate.mjs", "--section", "hero", "--input", candidatePath], {
    cwd: directory,
    encoding: "utf8"
  });
  assert.equal(applied.status, 0, applied.stderr);
  assert.match(applied.stdout, /"applied": true/);
  assert.match(applied.stdout, /"sectionId": "hero"/);
  assert.match(applied.stdout, /"applicationId": "apply-regen-hero-1"/);

  const layerDoc = JSON.parse(readFileSync(join(directory, "layerdoc.json"), "utf8"));
  assert.deepEqual(layerDoc.sections[0].layerIds, ["hero-title", "hero-cta"]);
  assert.equal(layerDoc.layers.find((layer) => layer.id === "hero-title").content.text, "Reviewed production hero");
  assert.equal(layerDoc.generation.sectionRequests[0].status, "applied");
  assert.deepEqual(layerDoc.generation.sectionApplications.map((application) => ({
    id: application.id,
    sectionId: application.sectionId,
    requestId: application.requestId,
    status: application.status,
    previousLayerIds: application.previous.layers.map((layer) => layer.id),
    appliedLayerIds: application.applied.layers.map((layer) => layer.id)
  })), [
    {
      id: "apply-regen-hero-1",
      sectionId: "hero",
      requestId: "regen-hero-1",
      status: "applied",
      previousLayerIds: ["headline", "cta"],
      appliedLayerIds: ["hero-title", "hero-cta"]
    }
  ]);

  const contract = JSON.parse(readFileSync(join(directory, "integration-contract.json"), "utf8"));
  assert.deepEqual(contract.sections[0].layerIds, ["hero-title", "hero-cta"]);
  assert.equal(contract.generationRequests[0].status, "applied");
  assert.deepEqual(contract.generationApplications, [
    {
      id: "apply-regen-hero-1",
      sectionId: "hero",
      requestId: "regen-hero-1",
      status: "applied",
      appliedAt: layerDoc.generation.sectionApplications[0].appliedAt,
      revertedAt: null,
      selector: '[data-section-id="hero"]',
      previousLayerIds: ["headline", "cta"],
      appliedLayerIds: ["hero-title", "hero-cta"]
    }
  ]);

  const componentSource = readFileSync(join(directory, "src", "ProductionHomepage.tsx"), "utf8");
  assert.match(componentSource, /data-layer-id="hero-title"/);
  assert.match(componentSource, /Reviewed production hero/);
  const previewSource = readFileSync(join(directory, "preview.html"), "utf8");
  assert.match(previewSource, /data-layer-id="hero-title"/);
  assert.match(previewSource, /Reviewed production hero/);

  const layerDocVerification = spawnSync(process.execPath, ["scripts/verify-layerdoc.mjs"], { cwd: directory, encoding: "utf8" });
  assert.equal(layerDocVerification.status, 0, layerDocVerification.stderr);

  const contractVerification = spawnSync(process.execPath, ["scripts/verify-contract.mjs"], { cwd: directory, encoding: "utf8" });
  assert.equal(contractVerification.status, 0, contractVerification.stderr);

  const handoffVerification = spawnSync(process.execPath, ["scripts/verify-handoff.mjs"], { cwd: directory, encoding: "utf8" });
  assert.equal(handoffVerification.status, 0, handoffVerification.stderr);
});

test("exported section application verifier applies candidate, refreshes preview score, and enforces gates", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-section-application-"));
  const output = createProjectExportPackage(createRegenerationExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const candidatePath = join(directory, "hero-candidate.json");
  const referencePath = join(directory, "reference.png");
  const candidatePngPath = join(directory, "candidate.png");
  writeFileSync(candidatePath, `${JSON.stringify(createHeroSectionCandidate(), null, 2)}\n`);
  writeSolidPng(referencePath, 2, 1, [255, 255, 255, 255]);
  writeSolidPng(candidatePngPath, 2, 1, [255, 255, 255, 255]);

  const result = spawnSync(
    process.execPath,
    [
      "scripts/verify-section-application.mjs",
      "--section",
      "hero",
      "--input",
      candidatePath,
      "--reference",
      referencePath,
      "--candidate",
      candidatePngPath,
      "--out",
      "verification-artifacts"
    ],
    { cwd: directory, encoding: "utf8", env: { ...process.env, NODE_PATH: join(process.cwd(), "node_modules") } }
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /"passed": true/);
  assert.match(result.stdout, /"step": "verify:gates"/);

  const layerDoc = JSON.parse(readFileSync(join(directory, "layerdoc.json"), "utf8"));
  assert.deepEqual(layerDoc.sections[0].layerIds, ["hero-title", "hero-cta"]);
  assert.equal(layerDoc.generation.sectionRequests[0].status, "applied");
  assert.equal(layerDoc.generation.sectionApplications[0].status, "applied");
  assert.equal(layerDoc.verification.scores.visualSimilarity, 100);

  const report = JSON.parse(readFileSync(join(directory, "verification-report.json"), "utf8"));
  assert.equal(report.visualSimilarity, 100);
  assert.equal(report.evidence.visual.kind, "html-screenshot");
  const handoff = JSON.parse(readFileSync(join(directory, "handoff-summary.json"), "utf8"));
  assert.equal(handoff.quality.scores.visual_similarity, 100);
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

test("exported analysis plan verifier script validates handoff artifacts", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-analysis-plan-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const passed = spawnSync(process.execPath, ["scripts/verify-analysis-plan.mjs"], { cwd: directory, encoding: "utf8" });
  assert.equal(passed.status, 0, passed.stderr);
  assert.match(passed.stdout, /"passed": true/);

  const taskPath = join(directory, "analysis-task.json");
  const task = JSON.parse(readFileSync(taskPath, "utf8"));
  const staleTask = {
    ...task,
    sourceImage: {
      ...task.sourceImage,
      width: 1280
    }
  };
  writeFileSync(taskPath, `${JSON.stringify(staleTask, null, 2)}\n`);

  const failedTask = spawnSync(process.execPath, ["scripts/verify-analysis-plan.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failedTask.status, 0);
  assert.match(failedTask.stdout, /analysis_task_source_mismatch/);
  assert.match(failedTask.stdout, /analysis-task\.json/);
  writeFileSync(taskPath, `${JSON.stringify(task, null, 2)}\n`);

  const auditPath = join(directory, "analysis-plan-audit.json");
  const staleAudit = JSON.parse(readFileSync(auditPath, "utf8"));
  staleAudit.readiness.readyForLayerDoc = false;
  staleAudit.readiness.blockers = ["Plan needs another layer"];
  writeFileSync(auditPath, `${JSON.stringify(staleAudit, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-analysis-plan.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /analysis_plan_not_ready/);
  assert.match(failed.stdout, /manifest_analysis_plan_audit_mismatch/);
});

test("exported handoff verifier script validates project integration handoff", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-handoff-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });
  writeProjectExportPackage(output, directory);

  const passed = spawnSync(process.execPath, ["scripts/verify-handoff.mjs"], { cwd: directory, encoding: "utf8" });
  assert.equal(passed.status, 0, passed.stderr);
  assert.match(passed.stdout, /"passed": true/);

  const handoffPath = join(directory, "handoff-summary.json");
  const packagePath = join(directory, "package.json");
  const handoffSummary = JSON.parse(readFileSync(handoffPath, "utf8"));
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  handoffSummary.sourceOfTruth.hash = "sha256:stale";
  handoffSummary.quality.visualProblems.total = 99;
  delete packageJson.scripts["verify:contract"];
  writeFileSync(handoffPath, `${JSON.stringify(handoffSummary, null, 2)}\n`);
  writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-handoff.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /handoff_source_hash_mismatch/);
  assert.match(failed.stdout, /handoff_visual_problems_mismatch/);
  assert.match(failed.stdout, /handoff_command_script_missing/);
});

test("exported image manifest verifier script validates source-to-LayerDoc handoff artifacts", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-image-manifest-"));
  const output = createProjectExportPackage(createExportDoc(), {
    componentName: "ProductionHomepage",
    imageManifest: createExportImageManifest()
  });
  writeProjectExportPackage(output, directory);

  assert.equal(output.manifest.imageManifestFile, "image-manifest.json");
  assert.equal(existsSync(join(directory, "image-manifest.json")), true);
  const manifest = JSON.parse(readFileSync(join(directory, "manifest.json"), "utf8"));
  const handoffSummary = JSON.parse(readFileSync(join(directory, "handoff-summary.json"), "utf8"));
  const imageManifest = JSON.parse(readFileSync(join(directory, "image-manifest.json"), "utf8"));
  assert.equal(manifest.imageManifestFile, "image-manifest.json");
  assert.equal(handoffSummary.sourceImageManifestFile, "image-manifest.json");
  assert.match(readFileSync(join(directory, "README.md"), "utf8"), /image-manifest\.json/);
  assert.equal(imageManifest.sections.length, 1);
  assert.equal(imageManifest.sections[0].layers.length, 2);

  const passed = spawnSync(process.execPath, ["scripts/verify-image-manifest.mjs"], { cwd: directory, encoding: "utf8" });
  assert.equal(passed.status, 0, passed.stderr);
  assert.match(passed.stdout, /"passed": true/);

  imageManifest.sourceImage.width = 1280;
  writeFileSync(join(directory, "image-manifest.json"), `${JSON.stringify(imageManifest, null, 2)}\n`);

  const failed = spawnSync(process.execPath, ["scripts/verify-image-manifest.mjs"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /image_manifest_source_mismatch/);
  assert.match(failed.stdout, /image_manifest_canvas_mismatch/);
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
