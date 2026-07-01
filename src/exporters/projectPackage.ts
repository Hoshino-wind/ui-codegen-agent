import type { LayerDoc } from "../layerdoc/types.js";
import { createSectionRegenerationCandidateJsonSchema } from "../editor/sectionCandidateSchema.js";
import { createHomepageAnalysisPlanJsonSchema, type HomepageAnalysisPlan } from "../importers/homepageAnalysisPlan.js";
import type { ImageAnalysisManifest } from "../importers/imageManifest.js";
import { createLayerDocAudit, type LayerDocAudit } from "../layerdoc/audit.js";
import { createLayerDocJsonSchema } from "../layerdoc/jsonSchema.js";
import { defaultVerificationGates, type VerificationGates } from "../verifier/gates.js";
import { createVerificationReport, layerDocWithVerificationReport, type VerificationReport } from "../verifier/report.js";
import { renderHtmlPreview } from "./htmlPreview.js";
import { exportReactTailwind } from "./reactTailwind.js";
import { verificationDataAttributes } from "./verificationAttributes.js";

export interface ProjectExportPackageOptions {
  componentName: string;
  packageName?: string;
  analysisPlan?: HomepageAnalysisPlan;
  imageManifest?: ImageAnalysisManifest;
  report?: VerificationReport;
  referencePng?: Uint8Array;
}

export interface ProjectExportFile {
  path: string;
  contents: string | Uint8Array;
}

export interface ProjectReferenceVisual {
  file: string;
  role: "visual_verification_reference";
  sourceUri: string | null;
}

export interface ProjectExportManifest {
  packageName: string;
  componentName: string;
  source: "layerdoc";
  layerDocHash: string;
  integrationContract: string;
  handoffSummary: string;
  sectionCandidateSchema: string;
  referenceVisual: ProjectReferenceVisual;
  analysisPlan?: NonNullable<LayerDoc["metadata"]["analysisPlan"]>;
  analysisPlanFile?: string;
  imageManifestFile?: string;
  analysisPlanAudit?: NonNullable<LayerDoc["metadata"]["analysisPlanAudit"]>;
  analysisPlanSchema?: string;
  analysisPlanAuditFile?: string;
  files: string[];
  scores: VerificationReport;
  audit: LayerDocAudit;
}

export interface ProjectHandoffCommand {
  label: string;
  command: string;
}

export interface ProjectVisualProblemSummary {
  total: number;
  affectedLayerIds: string[];
  unmapped: number;
  areas: VerificationReport["visualProblemAreas"];
}

export interface ProjectHandoffSummary {
  version: "0.1.0";
  positioning: "AI UI Production System";
  source: "layerdoc";
  sourceOfTruth: {
    file: string;
    schemaFile: string;
    hash: string;
  };
  sourceVisual?: NonNullable<LayerDoc["metadata"]["sourceImage"]>;
  sourceImageManifestFile?: string;
  sourceAnalysisPlan?: NonNullable<LayerDoc["metadata"]["analysisPlan"]>;
  sourceAnalysisPlanAudit?: NonNullable<LayerDoc["metadata"]["analysisPlanAudit"]>;
  sourceAnalysisPlanFiles?: {
    planFile?: string;
    schemaFile?: string;
    auditFile?: string;
  };
  entrypoint: {
    component: string;
    file: string;
    rootSelector: string;
  };
  contract: {
    file: string;
    sections: number;
    layers: number;
    components: number;
    assets: number;
    interactions: number;
    responsiveRules: number;
    generationRequests: number;
  };
  sectionRegeneration: {
    candidateSchemaFile: string;
    requestCount: number;
  };
  quality: {
    scores: {
      visual_similarity: number | null;
      structure_score: number;
      component_score: number;
      project_fit_score: number;
    };
    visualEvidence: VerificationReport["evidence"]["visual"];
    visualProblems: ProjectVisualProblemSummary;
    referenceVisual: ProjectReferenceVisual;
    gatesFile: string;
  };
  audit: {
    file: string;
    assetCompliancePassed: boolean;
    structureValid: boolean;
    editableCoverage: LayerDocAudit["editableCoverage"];
  };
  commands: ProjectHandoffCommand[];
}

export interface ProjectIntegrationContract {
  version: "0.1.0";
  layerDoc: {
    file: string;
    hash: string;
    schema: LayerDoc["schema"];
    version: LayerDoc["version"];
  };
  component: {
    name: string;
    file: string;
    rootSelector: string;
    verificationAttributes: Record<string, string>;
  };
  preview: {
    file: string;
    rootSelector: string;
    verificationAttributes: Record<string, string>;
  };
  sections: Array<{
    id: string;
    name: string;
    selector: string;
    layerIds: string[];
  }>;
  layers: Array<{
    id: string;
    kind: string;
    track: string;
    editable: boolean;
    sectionId: string | null;
    componentIds: string[];
    assetId: string | null;
    selector: string;
    interactionIds: string[];
  }>;
  components: Array<{
    id: string;
    exportable: boolean;
    selector: string | null;
    layerIds: string[];
  }>;
  assets: Array<{
    id: string;
    type: string;
    source: string;
    uri: string | null;
    usedByLayerIds: string[];
  }>;
  interactions: Array<{
    id: string;
    layerId: string;
    event: string;
    action: string;
    selector: string;
  }>;
  responsiveRules: Array<{
    id: string;
    query: string;
    target: LayerDoc["responsive"]["rules"][number]["target"];
    selector: string | null;
    changes: Record<string, unknown>;
  }>;
  generationRequests: Array<{
    id: string;
    sectionId: string;
    prompt: string;
    status: string;
    requestedAt: string;
    selector: string | null;
    sectionVisible: boolean;
  }>;
}

export type ProjectQualityGates = VerificationGates;

export interface ProjectExportPackage {
  manifest: ProjectExportManifest;
  files: ProjectExportFile[];
}

const PROJECT_VERIFY_CHAIN =
  "npm run verify:preview && npm run verify:handoff && npm run verify:analysis-plan && npm run verify:image-manifest && npm run verify:layerdoc && npm run verify:contract && npm run verify:gates";
const SECTION_CANDIDATE_SCHEMA_FILE = "section-candidate.schema.json";

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function visualProblemSummaryFor(report: VerificationReport): ProjectVisualProblemSummary {
  const areas = report.visualProblemAreas ?? [];
  return {
    total: areas.length,
    affectedLayerIds: Array.from(new Set(areas.map((area) => area.affectedLayerId).filter((layerId): layerId is string => Boolean(layerId)))),
    unmapped: areas.filter((area) => !area.affectedLayerId).length,
    areas: areas.map((area) => ({ ...area, bounds: { ...area.bounds } }))
  };
}

const sha256RoundConstants = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

// Keep project-package generation browser-safe; exported verifier scripts can use Node, Studio exports cannot.
function rightRotate(value: number, shift: number): number {
  return (value >>> shift) | (value << (32 - shift));
}

function utf8Bytes(value: string): number[] {
  const bytes: number[] = [];

  for (let index = 0; index < value.length; index += 1) {
    let codePoint = value.charCodeAt(index);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (next - 0xdc00);
        index += 1;
      }
    }

    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push(0xc0 | (codePoint >>> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x10000) {
      bytes.push(0xe0 | (codePoint >>> 12), 0x80 | ((codePoint >>> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(
        0xf0 | (codePoint >>> 18),
        0x80 | ((codePoint >>> 12) & 0x3f),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    }
  }

  return bytes;
}

function sha256(value: string): string {
  const bytes = utf8Bytes(value);
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) {
    bytes.push(0);
  }

  const highLength = Math.floor(bitLength / 0x100000000);
  const lowLength = bitLength >>> 0;
  for (const part of [highLength, lowLength]) {
    bytes.push((part >>> 24) & 0xff, (part >>> 16) & 0xff, (part >>> 8) & 0xff, part & 0xff);
  }

  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const words = new Array<number>(64);

  for (let chunk = 0; chunk < bytes.length; chunk += 64) {
    for (let index = 0; index < 16; index += 1) {
      const offset = chunk + index * 4;
      words[index] = ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 = rightRotate(words[index - 15], 7) ^ rightRotate(words[index - 15], 18) ^ (words[index - 15] >>> 3);
      const s1 = rightRotate(words[index - 2], 17) ^ rightRotate(words[index - 2], 19) ^ (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + choose + sha256RoundConstants[index] + words[index]) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  return `sha256:${hash.map((part) => part.toString(16).padStart(8, "0")).join("")}`;
}

function layerDocHash(doc: LayerDoc): string {
  return sha256(stableJson(doc));
}

function selectorFor(attribute: string, value: string): string {
  return `[${attribute}="${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
}

function selectorForResponsiveTarget(doc: LayerDoc, target: LayerDoc["responsive"]["rules"][number]["target"]): string | null {
  if (target.type === "section") {
    return selectorFor("data-section-id", target.id);
  }
  if (target.type === "layer") {
    return selectorFor("data-layer-id", target.id);
  }

  const component = doc.components.find((candidate) => candidate.id === target.id);
  return component?.exportable ? selectorFor("data-component-id", target.id) : null;
}

function visibleContractSections(doc: LayerDoc): LayerDoc["sections"] {
  return doc.sections.filter((section) => section.visible !== false);
}

function visibleContractLayers(doc: LayerDoc): LayerDoc["layers"] {
  const hiddenSectionIds = new Set(doc.sections.filter((section) => section.visible === false).map((section) => section.id));
  return doc.layers.filter((layer) => !layer.sectionId || !hiddenSectionIds.has(layer.sectionId));
}

function visibleContractComponents(doc: LayerDoc, visibleLayerIds: Set<string>): LayerDoc["components"] {
  return doc.components.filter((component) => component.layerIds.some((layerId) => visibleLayerIds.has(layerId)));
}

function visibleComponentLayerIds(component: LayerDoc["components"][number], visibleLayerIds: Set<string>): string[] {
  return component.layerIds.filter((layerId) => visibleLayerIds.has(layerId));
}

function visibleContractResponsiveRules(
  doc: LayerDoc,
  visibleSectionIds: Set<string>,
  visibleLayerIds: Set<string>,
  visibleComponentIds: Set<string>
): LayerDoc["responsive"]["rules"] {
  return doc.responsive.rules.filter((rule) => {
    if (rule.target.type === "section") {
      return visibleSectionIds.has(rule.target.id);
    }
    if (rule.target.type === "component") {
      return visibleComponentIds.has(rule.target.id);
    }
    return visibleLayerIds.has(rule.target.id);
  });
}

function createIntegrationContract(doc: LayerDoc, componentName: string, componentFile: string, sourceHash: string): ProjectIntegrationContract {
  const sections = visibleContractSections(doc);
  const layers = visibleContractLayers(doc);
  const visibleSectionIds = new Set(sections.map((section) => section.id));
  const visibleLayerIds = new Set(layers.map((layer) => layer.id));
  const components = visibleContractComponents(doc, visibleLayerIds);
  const visibleComponentIds = new Set(components.map((component) => component.id));
  const responsiveRules = visibleContractResponsiveRules(doc, visibleSectionIds, visibleLayerIds, visibleComponentIds);
  const sectionsById = new Map(doc.sections.map((section) => [section.id, section]));
  const componentIdsByLayerId = new Map<string, string[]>();
  for (const component of components) {
    for (const layerId of visibleComponentLayerIds(component, visibleLayerIds)) {
      componentIdsByLayerId.set(layerId, [...(componentIdsByLayerId.get(layerId) ?? []), component.id]);
    }
  }

  return {
    version: "0.1.0",
    layerDoc: {
      file: "layerdoc.json",
      hash: sourceHash,
      schema: doc.schema,
      version: doc.version
    },
    component: {
      name: componentName,
      file: `src/${componentFile}`,
      rootSelector: selectorFor("data-layerdoc-version", doc.version),
      verificationAttributes: verificationDataAttributes(doc)
    },
    preview: {
      file: "preview.html",
      rootSelector: selectorFor("data-layerdoc", doc.version),
      verificationAttributes: verificationDataAttributes(doc)
    },
    sections: sections.map((section) => ({
      id: section.id,
      name: section.name,
      selector: selectorFor("data-section-id", section.id),
      layerIds: [...section.layerIds]
    })),
    layers: layers.map((layer) => ({
      id: layer.id,
      kind: layer.kind,
      track: layer.track,
      editable: layer.editable,
      sectionId: layer.sectionId ?? null,
      componentIds: componentIdsByLayerId.get(layer.id) ?? [],
      assetId: layer.assetId ?? null,
      selector: selectorFor("data-layer-id", layer.id),
      interactionIds: doc.interactions.filter((interaction) => interaction.layerId === layer.id).map((interaction) => interaction.id)
    })),
    components: components.map((component) => ({
      id: component.id,
      exportable: component.exportable,
      selector: component.exportable ? selectorFor("data-component-id", component.id) : null,
      layerIds: visibleComponentLayerIds(component, visibleLayerIds)
    })),
    assets: doc.assets.map((asset) => ({
      id: asset.id,
      type: asset.type,
      source: asset.source,
      uri: asset.uri ?? null,
      usedByLayerIds: layers.filter((layer) => layer.assetId === asset.id).map((layer) => layer.id)
    })),
    interactions: doc.interactions.filter((interaction) => visibleLayerIds.has(interaction.layerId)).map((interaction) => ({
      id: interaction.id,
      layerId: interaction.layerId,
      event: interaction.event,
      action: interaction.action,
      selector: selectorFor("data-layer-id", interaction.layerId)
    })),
    responsiveRules: responsiveRules.map((rule) => ({
      id: rule.id,
      query: rule.query,
      target: { ...rule.target },
      selector: selectorForResponsiveTarget(doc, rule.target),
      changes: { ...rule.changes }
    })),
    generationRequests: doc.generation.sectionRequests.map((request) => ({
      id: request.id,
      sectionId: request.sectionId,
      prompt: request.prompt,
      status: request.status,
      requestedAt: request.requestedAt,
      selector: visibleSectionIds.has(request.sectionId) ? selectorFor("data-section-id", request.sectionId) : null,
      sectionVisible: sectionsById.get(request.sectionId)?.visible !== false
    }))
  };
}

function packageJsonFor(manifest: ProjectExportManifest): string {
  return stableJson({
    name: manifest.packageName,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      dev: "vite",
      build: "tsc --noEmit && vite build",
      preview: "vite preview",
      verify: PROJECT_VERIFY_CHAIN,
      "verify:handoff": "node scripts/verify-handoff.mjs",
      "verify:analysis-plan": "node scripts/verify-analysis-plan.mjs",
      "verify:image-manifest": "node scripts/verify-image-manifest.mjs",
      "verify:layerdoc": "node scripts/verify-layerdoc.mjs",
      "verify:contract": "node scripts/verify-contract.mjs",
      "verify:preview": "node scripts/verify-preview.mjs",
      "verify:gates": "node scripts/verify-gates.mjs"
    },
    dependencies: {
      react: "^19.2.7",
      "react-dom": "^19.2.7"
    },
    devDependencies: {
      "@vitejs/plugin-react": "^6.0.3",
      "@types/react": "^19.2.17",
      "@types/react-dom": "^19.2.3",
      pixelmatch: "^7.2.0",
      pngjs: "^7.0.0",
      playwright: "^1.61.1",
      tailwindcss: "^4.0.0",
      typescript: "^5.8.3",
      vite: "^8.1.0"
    }
  });
}

function referenceVisualFor(sourceImage: LayerDoc["metadata"]["sourceImage"]): ProjectReferenceVisual {
  return {
    file: "reference.png",
    role: "visual_verification_reference",
    sourceUri: sourceImage?.uri ?? null
  };
}

function qualityGateScriptFor(): string {
  return `import { readFileSync } from "node:fs";

function readJson(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
}

const report = readJson("../verification-report.json");
const gates = readJson("../quality-gates.json");
const audit = readJson("../layerdoc-audit.json");
const checks = [
  ["visual_similarity", report.visualSimilarity, gates.visualSimilarity],
  ["structure_score", report.structureScore, gates.structureScore],
  ["component_score", report.componentScore, gates.componentScore],
  ["project_fit_score", report.projectFitScore, gates.projectFitScore]
];
const failures = checks.flatMap(([label, value, gate]) => {
  if (value === null || value === undefined || value < gate) {
    return [\`\${label} \${value ?? "n/a"} is below \${gate}\`];
  }
  return [];
});

if (Array.isArray(report.issues) && report.issues.length > 0) {
  failures.push(\`\${report.issues.length} structural issue(s) reported\`);
}

if (audit.assetCompliance?.passed === false) {
  const findings = Array.isArray(audit.assetCompliance.findings) ? audit.assetCompliance.findings : [];
  const detail = findings.length > 0 ? findings.join(" ") : "asset compliance audit did not pass";
  failures.push(\`asset_compliance failed: \${detail}\`);
}

if (Array.isArray(audit.editableCoverage?.sectionsWithoutEditableLayers) && audit.editableCoverage.sectionsWithoutEditableLayers.length > 0) {
  failures.push(\`editable_coverage failed: visible sections without editable layers: \${audit.editableCoverage.sectionsWithoutEditableLayers.join(", ")}\`);
}

const result = {
  passed: failures.length === 0,
  failures,
  gates,
  scores: {
    visualSimilarity: report.visualSimilarity,
    structureScore: report.structureScore,
    componentScore: report.componentScore,
    projectFitScore: report.projectFitScore
  }
};

process.stdout.write(\`\${JSON.stringify(result, null, 2)}\\n\`);
if (!result.passed) {
  process.exitCode = 1;
}
`;
}

function handoffVerifierScriptFor(): string {
  return `import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

function readJson(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
}

function stableJson(value) {
  return \`\${JSON.stringify(value, null, 2)}\\n\`;
}

function sha256(value) {
  return \`sha256:\${createHash("sha256").update(value).digest("hex")}\`;
}

function pushIf(condition, failures, code, message) {
  if (condition) {
    failures.push({ code, message });
  }
}

function fileExists(path) {
  return existsSync(new URL(\`../\${path}\`, import.meta.url));
}

function npmRunScriptName(command) {
  const match = /^npm run ([^\\s]+)$/.exec(command ?? "");
  return match?.[1] ?? null;
}

function visualProblemSummaryFor(report) {
  const areas = report.visualProblemAreas ?? [];
  return {
    total: areas.length,
    affectedLayerIds: Array.from(new Set(areas.map((area) => area.affectedLayerId).filter(Boolean))),
    unmapped: areas.filter((area) => !area.affectedLayerId).length,
    areas
  };
}

const manifest = readJson("../manifest.json");
const handoff = readJson("../handoff-summary.json");
const packageJson = readJson("../package.json");
const contract = readJson("../integration-contract.json");
const layerDoc = readJson("../layerdoc.json");
const audit = readJson("../layerdoc-audit.json");
const report = readJson("../verification-report.json");
const actualLayerDocHash = sha256(stableJson(layerDoc));
const failures = [];
const manifestFiles = Array.isArray(manifest.files) ? manifest.files : [];
const handoffCommands = Array.isArray(handoff.commands) ? handoff.commands : [];
const packageScripts = packageJson.scripts ?? {};

pushIf(manifest.source !== "layerdoc", failures, "manifest_source_invalid", "manifest.json source must be layerdoc.");
pushIf(manifest.handoffSummary !== "handoff-summary.json", failures, "manifest_handoff_file_mismatch", "manifest.json handoffSummary must be handoff-summary.json.");
pushIf(manifest.sectionCandidateSchema !== "${SECTION_CANDIDATE_SCHEMA_FILE}", failures, "manifest_section_candidate_schema_mismatch", "manifest.json sectionCandidateSchema must be ${SECTION_CANDIDATE_SCHEMA_FILE}.");
pushIf(handoff.source !== "layerdoc", failures, "handoff_source_invalid", "handoff-summary.json source must be layerdoc.");
pushIf(handoff.positioning !== "AI UI Production System", failures, "handoff_positioning_invalid", "handoff-summary.json positioning must identify the AI UI Production System.");
pushIf(handoff.sourceOfTruth?.file !== "layerdoc.json", failures, "handoff_source_file_mismatch", "handoff sourceOfTruth.file must be layerdoc.json.");
pushIf(handoff.sourceOfTruth?.schemaFile !== "layerdoc.schema.json", failures, "handoff_schema_file_mismatch", "handoff sourceOfTruth.schemaFile must be layerdoc.schema.json.");
pushIf(handoff.sourceOfTruth?.hash !== actualLayerDocHash, failures, "handoff_source_hash_mismatch", "handoff sourceOfTruth.hash must match the current layerdoc.json hash.");
pushIf(manifest.layerDocHash !== actualLayerDocHash, failures, "manifest_layerdoc_hash_mismatch", "manifest.json layerDocHash must match the current layerdoc.json hash.");
pushIf(!fileExists(manifest.sectionCandidateSchema), failures, "section_candidate_schema_missing", "manifest.json sectionCandidateSchema must point at an existing file.");

pushIf(!manifestFiles.includes("scripts/verify-handoff.mjs"), failures, "handoff_verifier_not_listed", "manifest.json files must include scripts/verify-handoff.mjs.");
for (const path of manifestFiles) {
  pushIf(!fileExists(path), failures, "manifest_file_missing", \`manifest.json lists missing file \${path}.\`);
}

pushIf(packageScripts.verify !== "${PROJECT_VERIFY_CHAIN}", failures, "package_verify_chain_mismatch", "package.json verify script must run the full handoff verification chain.");
for (const scriptName of ["verify:handoff", "verify:analysis-plan", "verify:image-manifest", "verify:layerdoc", "verify:contract", "verify:preview", "verify:gates"]) {
  pushIf(typeof packageScripts[scriptName] !== "string", failures, "package_verify_script_missing", \`package.json scripts must include \${scriptName}.\`);
}

for (const command of handoffCommands) {
  const scriptName = npmRunScriptName(command.command);
  if (scriptName) {
    pushIf(typeof packageScripts[scriptName] !== "string", failures, "handoff_command_script_missing", \`handoff command \${command.command} does not exist in package.json scripts.\`);
  }
}

pushIf(handoff.entrypoint?.component !== manifest.componentName, failures, "handoff_entrypoint_component_mismatch", "handoff entrypoint component must match manifest componentName.");
pushIf(handoff.entrypoint?.file !== contract.component?.file, failures, "handoff_entrypoint_file_mismatch", "handoff entrypoint file must match integration contract component file.");
pushIf(handoff.entrypoint?.rootSelector !== contract.component?.rootSelector, failures, "handoff_entrypoint_selector_mismatch", "handoff entrypoint rootSelector must match integration contract.");
pushIf(handoff.contract?.file !== manifest.integrationContract, failures, "handoff_contract_file_mismatch", "handoff contract.file must match manifest integrationContract.");
pushIf(handoff.contract?.sections !== (contract.sections?.length ?? 0), failures, "handoff_contract_section_count_mismatch", "handoff section count must match integration contract.");
pushIf(handoff.contract?.layers !== (contract.layers?.length ?? 0), failures, "handoff_contract_layer_count_mismatch", "handoff layer count must match integration contract.");
pushIf(handoff.contract?.components !== (contract.components?.length ?? 0), failures, "handoff_contract_component_count_mismatch", "handoff component count must match integration contract.");
pushIf(handoff.contract?.assets !== (contract.assets ?? []).filter((asset) => Array.isArray(asset.usedByLayerIds) && asset.usedByLayerIds.length > 0).length, failures, "handoff_contract_asset_count_mismatch", "handoff asset count must match integration contract used assets.");
pushIf(handoff.contract?.interactions !== (contract.interactions?.length ?? 0), failures, "handoff_contract_interaction_count_mismatch", "handoff interaction count must match integration contract.");
pushIf(handoff.contract?.responsiveRules !== (contract.responsiveRules?.length ?? 0), failures, "handoff_contract_responsive_count_mismatch", "handoff responsive rule count must match integration contract.");
pushIf(handoff.contract?.generationRequests !== (contract.generationRequests?.length ?? 0), failures, "handoff_contract_generation_request_count_mismatch", "handoff generation request count must match integration contract.");
pushIf(handoff.sectionRegeneration?.candidateSchemaFile !== manifest.sectionCandidateSchema, failures, "handoff_section_candidate_schema_mismatch", "handoff sectionRegeneration.candidateSchemaFile must match manifest sectionCandidateSchema.");
pushIf(handoff.sectionRegeneration?.requestCount !== (contract.generationRequests?.length ?? 0), failures, "handoff_section_regeneration_count_mismatch", "handoff sectionRegeneration.requestCount must match integration contract.");

pushIf(handoff.quality?.referenceVisual?.file !== manifest.referenceVisual?.file, failures, "handoff_reference_visual_mismatch", "handoff reference visual must match manifest referenceVisual.");
pushIf(handoff.quality?.gatesFile !== "quality-gates.json", failures, "handoff_gates_file_mismatch", "handoff quality gatesFile must be quality-gates.json.");
pushIf(manifest.scores?.visualSimilarity !== report.visualSimilarity, failures, "manifest_visual_score_mismatch", "manifest visual score must match verification-report.json.");
pushIf(manifest.scores?.structureScore !== report.structureScore, failures, "manifest_structure_score_mismatch", "manifest structure score must match verification-report.json.");
pushIf(manifest.scores?.componentScore !== report.componentScore, failures, "manifest_component_score_mismatch", "manifest component score must match verification-report.json.");
pushIf(manifest.scores?.projectFitScore !== report.projectFitScore, failures, "manifest_project_fit_score_mismatch", "manifest project fit score must match verification-report.json.");
pushIf(stableJson(manifest.scores?.evidence?.visual) !== stableJson(report.evidence?.visual), failures, "manifest_visual_evidence_mismatch", "manifest visual evidence must match verification-report.json.");
pushIf(handoff.quality?.scores?.visual_similarity !== report.visualSimilarity, failures, "handoff_visual_score_mismatch", "handoff visual score must match verification-report.json.");
pushIf(handoff.quality?.scores?.structure_score !== report.structureScore, failures, "handoff_structure_score_mismatch", "handoff structure score must match verification-report.json.");
pushIf(handoff.quality?.scores?.component_score !== report.componentScore, failures, "handoff_component_score_mismatch", "handoff component score must match verification-report.json.");
pushIf(handoff.quality?.scores?.project_fit_score !== report.projectFitScore, failures, "handoff_project_fit_score_mismatch", "handoff project fit score must match verification-report.json.");
pushIf(stableJson(handoff.quality?.visualEvidence) !== stableJson(report.evidence?.visual), failures, "handoff_visual_evidence_mismatch", "handoff visual evidence must match verification-report.json.");
pushIf(stableJson(handoff.quality?.visualProblems) !== stableJson(visualProblemSummaryFor(report)), failures, "handoff_visual_problems_mismatch", "handoff visual problem summary must match verification-report.json.");

pushIf(handoff.audit?.file !== "layerdoc-audit.json", failures, "handoff_audit_file_mismatch", "handoff audit.file must be layerdoc-audit.json.");
pushIf(handoff.audit?.assetCompliancePassed !== audit.assetCompliance?.passed, failures, "handoff_asset_compliance_mismatch", "handoff asset compliance result must match layerdoc-audit.json.");
pushIf(handoff.audit?.structureValid !== audit.structure?.valid, failures, "handoff_structure_valid_mismatch", "handoff structure validity must match layerdoc-audit.json.");

const result = {
  passed: failures.length === 0,
  failures,
  filesChecked: manifestFiles.length,
  commandsChecked: handoffCommands.length,
  layerDocHash: actualLayerDocHash
};

process.stdout.write(\`\${JSON.stringify(result, null, 2)}\\n\`);
if (!result.passed) {
  process.exitCode = 1;
}
`;
}

function analysisPlanVerifierScriptFor(): string {
  return `import { readFileSync } from "node:fs";

function readJson(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
}

function stableJson(value) {
  return JSON.stringify(value);
}

function pushIf(condition, failures, code, message) {
  if (condition) {
    failures.push({ code, message });
  }
}

const manifest = readJson("../manifest.json");
const handoff = readJson("../handoff-summary.json");
const layerDoc = readJson("../layerdoc.json");
const defaultAnalysisPlanFile = "analysis-plan.json";
const defaultAnalysisPlanSchemaFile = "analysis-plan.schema.json";
const defaultAnalysisPlanAuditFile = "analysis-plan-audit.json";
const hasAnalysisPlan = Boolean(manifest.analysisPlan || manifest.analysisPlanFile || manifest.analysisPlanAudit || manifest.analysisPlanSchema || manifest.analysisPlanAuditFile);
const failures = [];

if (!hasAnalysisPlan) {
  process.stdout.write(\`\${JSON.stringify({ passed: true, skipped: true, reason: "No Analysis Plan metadata is declared in manifest.json." }, null, 2)}\\n\`);
} else {
  pushIf(!manifest.analysisPlanSchema, failures, "analysis_plan_schema_missing", "manifest.json must declare analysisPlanSchema.");
  pushIf(!manifest.analysisPlanAuditFile, failures, "analysis_plan_audit_file_missing", "manifest.json must declare analysisPlanAuditFile.");
  pushIf(Boolean(manifest.analysisPlanFile) && manifest.analysisPlanFile !== defaultAnalysisPlanFile, failures, "analysis_plan_file_unexpected", \`Analysis Plan file must be \${defaultAnalysisPlanFile}.\`);
  pushIf(Boolean(manifest.analysisPlanSchema) && manifest.analysisPlanSchema !== defaultAnalysisPlanSchemaFile, failures, "analysis_plan_schema_file_unexpected", \`Analysis Plan schema file must be \${defaultAnalysisPlanSchemaFile}.\`);
  pushIf(Boolean(manifest.analysisPlanAuditFile) && manifest.analysisPlanAuditFile !== defaultAnalysisPlanAuditFile, failures, "analysis_plan_audit_file_unexpected", \`Analysis Plan audit file must be \${defaultAnalysisPlanAuditFile}.\`);

  const plan = manifest.analysisPlanFile ? readJson(\`../\${manifest.analysisPlanFile}\`) : null;
  const schema = manifest.analysisPlanSchema ? readJson(\`../\${manifest.analysisPlanSchema}\`) : null;
  const audit = manifest.analysisPlanAuditFile ? readJson(\`../\${manifest.analysisPlanAuditFile}\`) : null;

  pushIf(schema?.title !== "HomepageAnalysisPlan 0.1.0", failures, "analysis_plan_schema_title_invalid", "Analysis Plan schema title must be HomepageAnalysisPlan 0.1.0.");
  pushIf(schema?.properties?.sections?.minItems !== 8, failures, "analysis_plan_schema_min_sections_invalid", "Analysis Plan schema must require at least 8 homepage sections.");
  pushIf(schema?.properties?.sections?.maxItems !== 15, failures, "analysis_plan_schema_max_sections_invalid", "Analysis Plan schema must allow no more than 15 homepage sections.");
  pushIf(audit?.readiness?.readyForLayerDoc !== true, failures, "analysis_plan_not_ready", "Analysis Plan audit is not ready for LayerDoc.");
  pushIf(Array.isArray(audit?.readiness?.blockers) && audit.readiness.blockers.length > 0, failures, "analysis_plan_blockers_present", "Analysis Plan audit still contains blockers.");

  if (plan) {
    const planLayerCount = Array.isArray(plan.sections)
      ? plan.sections.reduce((total, section) => total + (Array.isArray(section.layers) ? section.layers.length : 0), 0)
      : 0;
    pushIf(plan.name !== manifest.analysisPlan?.name, failures, "analysis_plan_name_mismatch", "analysis-plan.json name must match manifest.json analysisPlan.name.");
    pushIf(!Array.isArray(plan.sections), failures, "analysis_plan_sections_missing", "analysis-plan.json sections must be an array.");
    pushIf(Array.isArray(plan.sections) && plan.sections.length !== manifest.analysisPlan?.sectionCount, failures, "analysis_plan_section_count_mismatch", "analysis-plan.json section count must match manifest.json analysisPlan.sectionCount.");
    pushIf(planLayerCount !== manifest.analysisPlan?.layerCount, failures, "analysis_plan_layer_count_mismatch", "analysis-plan.json layer count must match manifest.json analysisPlan.layerCount.");
    pushIf(plan.canvas?.width !== layerDoc.canvas?.width || plan.canvas?.height !== layerDoc.canvas?.height, failures, "analysis_plan_canvas_mismatch", "analysis-plan.json canvas must match layerdoc.json canvas.");
  }

  if (manifest.analysisPlanAudit && stableJson(manifest.analysisPlanAudit) !== stableJson(audit)) {
    failures.push({ code: "manifest_analysis_plan_audit_mismatch", message: "manifest.json analysisPlanAudit must match analysis-plan-audit.json." });
  }

  if (layerDoc.metadata?.analysisPlanAudit && stableJson(layerDoc.metadata.analysisPlanAudit) !== stableJson(audit)) {
    failures.push({ code: "layerdoc_analysis_plan_audit_mismatch", message: "layerdoc.json metadata.analysisPlanAudit must match analysis-plan-audit.json." });
  }

  const files = handoff.sourceAnalysisPlanFiles ?? {};
  pushIf(files.planFile !== manifest.analysisPlanFile, failures, "handoff_analysis_plan_file_mismatch", "handoff-summary.json sourceAnalysisPlanFiles.planFile must match manifest.json.");
  pushIf(files.schemaFile !== manifest.analysisPlanSchema, failures, "handoff_analysis_plan_schema_mismatch", "handoff-summary.json sourceAnalysisPlanFiles.schemaFile must match manifest.json.");
  pushIf(files.auditFile !== manifest.analysisPlanAuditFile, failures, "handoff_analysis_plan_audit_mismatch", "handoff-summary.json sourceAnalysisPlanFiles.auditFile must match manifest.json.");

  const result = {
    passed: failures.length === 0,
    failures,
    planFile: manifest.analysisPlanFile,
    schemaFile: manifest.analysisPlanSchema,
    auditFile: manifest.analysisPlanAuditFile,
    readiness: audit?.readiness ?? null
  };
  process.stdout.write(\`\${JSON.stringify(result, null, 2)}\\n\`);
  if (!result.passed) {
    process.exitCode = 1;
  }
}
`;
}

function imageManifestVerifierScriptFor(): string {
  return `import { readFileSync } from "node:fs";

function readJson(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
}

function pushIf(condition, failures, code, message) {
  if (condition) {
    failures.push({ code, message });
  }
}

function layerCount(sections) {
  return Array.isArray(sections)
    ? sections.reduce((total, section) => total + (Array.isArray(section.layers) ? section.layers.length : 0), 0)
    : 0;
}

const manifest = readJson("../manifest.json");
const handoff = readJson("../handoff-summary.json");
const layerDoc = readJson("../layerdoc.json");
const defaultImageManifestFile = "image-manifest.json";
const failures = [];

if (!manifest.imageManifestFile) {
  process.stdout.write(\`\${JSON.stringify({ passed: true, skipped: true, reason: "No ImageAnalysisManifest file is declared in manifest.json." }, null, 2)}\\n\`);
} else {
  pushIf(manifest.imageManifestFile !== defaultImageManifestFile, failures, "image_manifest_file_unexpected", \`Image manifest file must be \${defaultImageManifestFile}.\`);
  pushIf(!Array.isArray(manifest.files) || !manifest.files.includes(manifest.imageManifestFile), failures, "image_manifest_not_listed", "manifest.json files must include imageManifestFile.");
  pushIf(handoff.sourceImageManifestFile !== manifest.imageManifestFile, failures, "handoff_image_manifest_file_mismatch", "handoff-summary.json sourceImageManifestFile must match manifest.json imageManifestFile.");

  const imageManifest = readJson(\`../\${manifest.imageManifestFile}\`);
  const sourceImage = imageManifest.sourceImage ?? {};
  const layerDocSourceImage = layerDoc.metadata?.sourceImage ?? {};
  const manifestLayerCount = layerCount(imageManifest.sections);
  const layerDocSections = Array.isArray(layerDoc.sections) ? layerDoc.sections : [];
  const layerDocLayers = Array.isArray(layerDoc.layers) ? layerDoc.layers : [];
  const layerDocSectionIds = new Set(layerDocSections.map((section) => section.id));
  const layerDocLayerIds = new Set(layerDocLayers.map((layer) => layer.id));

  pushIf(imageManifest.name !== layerDoc.metadata?.name, failures, "image_manifest_name_mismatch", "image-manifest.json name must match layerdoc.json metadata.name.");
  pushIf(sourceImage.uri !== layerDocSourceImage.uri || sourceImage.width !== layerDocSourceImage.width || sourceImage.height !== layerDocSourceImage.height, failures, "image_manifest_source_mismatch", "image-manifest.json sourceImage must match layerdoc.json metadata.sourceImage.");
  pushIf(sourceImage.width !== layerDoc.canvas?.width || sourceImage.height !== layerDoc.canvas?.height, failures, "image_manifest_canvas_mismatch", "image-manifest.json sourceImage dimensions must match layerdoc.json canvas.");
  pushIf(!Array.isArray(imageManifest.sections), failures, "image_manifest_sections_missing", "image-manifest.json sections must be an array.");
  pushIf(Array.isArray(imageManifest.sections) && imageManifest.sections.length !== layerDocSections.length, failures, "image_manifest_section_count_mismatch", "image-manifest.json section count must match layerdoc.json.");
  pushIf(manifestLayerCount !== layerDocLayers.length, failures, "image_manifest_layer_count_mismatch", "image-manifest.json layer count must match layerdoc.json.");

  for (const section of Array.isArray(imageManifest.sections) ? imageManifest.sections : []) {
    pushIf(!layerDocSectionIds.has(section.id), failures, "image_manifest_section_missing", \`Image manifest section \${section.id} is not present in layerdoc.json.\`);
    for (const layer of Array.isArray(section.layers) ? section.layers : []) {
      pushIf(!layerDocLayerIds.has(layer.id), failures, "image_manifest_layer_missing", \`Image manifest layer \${layer.id} is not present in layerdoc.json.\`);
    }
  }

  const result = {
    passed: failures.length === 0,
    failures,
    imageManifestFile: manifest.imageManifestFile,
    sourceImage,
    sectionCount: Array.isArray(imageManifest.sections) ? imageManifest.sections.length : 0,
    layerCount: manifestLayerCount
  };
  process.stdout.write(\`\${JSON.stringify(result, null, 2)}\\n\`);
  if (!result.passed) {
    process.exitCode = 1;
  }
}
`;
}

function contractVerifierScriptFor(): string {
  return `import { readFileSync } from "node:fs";

function readJson(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
}

function readText(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

function stableJson(value) {
  return \`\${JSON.stringify(value, null, 2)}\\n\`;
}

function issue(code, path, message) {
  return { code, path, message };
}

function selectorFor(attribute, value) {
  return \`[\${attribute}="\${String(value).replace(/\\\\/g, "\\\\\\\\").replace(/"/g, '\\\\"')}"]\`;
}

function scoreAttributeValue(value) {
  return value === null || value === undefined ? "n/a" : String(value);
}

function verificationDataAttributes(layerDoc) {
  const scores = layerDoc.verification?.scores ?? {};
  return {
    "data-verification-visual-similarity": scoreAttributeValue(scores.visualSimilarity),
    "data-verification-structure-score": scoreAttributeValue(scores.structureScore),
    "data-verification-component-score": scoreAttributeValue(scores.componentScore),
    "data-verification-project-fit-score": scoreAttributeValue(scores.projectFitScore),
    "data-verification-issues": String((layerDoc.verification?.issues ?? []).length)
  };
}

function selectorAttributeNeedle(selector) {
  const match = /^\\[([^=\\]]+)="(.*)"\\]$/.exec(selector ?? "");
  if (!match) {
    return null;
  }

  const value = match[2].replace(/\\\\"/g, '"').replace(/\\\\\\\\/g, "\\\\");
  return \`\${match[1]}="\${value}"\`;
}

function sourceHasAttributeToken(source, attribute, expected) {
  const marker = \`\${attribute}="\`;
  let start = source.indexOf(marker);
  while (start !== -1) {
    const valueStart = start + marker.length;
    const valueEnd = source.indexOf('"', valueStart);
    if (valueEnd === -1) {
      return false;
    }

    const tokens = source.slice(valueStart, valueEnd).split(/\\s+/);
    if (tokens.includes(String(expected))) {
      return true;
    }

    start = source.indexOf(marker, valueEnd + 1);
  }

  return false;
}

function sourceHasAttributeValue(source, attribute, expected) {
  const marker = \`\${attribute}="\`;
  let start = source.indexOf(marker);
  while (start !== -1) {
    const valueStart = start + marker.length;
    const valueEnd = source.indexOf('"', valueStart);
    if (valueEnd === -1) {
      return false;
    }

    if (source.slice(valueStart, valueEnd) === String(expected)) {
      return true;
    }

    start = source.indexOf(marker, valueEnd + 1);
  }

  return false;
}

function escapeHtmlText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pxDeclaration(property, value) {
  return typeof value === "number" && Number.isFinite(value) ? \`\${property}:\${value}px !important;\` : null;
}

function rawDeclaration(property, value) {
  return typeof value === "string" && value.length > 0 ? \`\${property}:\${value} !important;\` : null;
}

function numericDeclaration(property, value) {
  return typeof value === "number" && Number.isFinite(value) ? \`\${property}:\${value} !important;\` : null;
}

function numericSpacing(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function paddingValue(padding) {
  const vertical = numericSpacing(padding.y) ?? numericSpacing(padding.top) ?? numericSpacing(padding.bottom) ?? 0;
  const horizontal = numericSpacing(padding.x) ?? numericSpacing(padding.left) ?? numericSpacing(padding.right) ?? 0;
  return \`\${vertical}px \${horizontal}px\`;
}

function declarationsForResponsiveChanges(changes) {
  const declarations = [];
  const bounds = changes?.bounds;
  const style = changes?.style;

  if (isRecord(bounds)) {
    declarations.push(
      pxDeclaration("left", bounds.x),
      pxDeclaration("top", bounds.y),
      pxDeclaration("width", bounds.width),
      pxDeclaration("height", bounds.height)
    );
  }

  if (isRecord(style)) {
    declarations.push(
      rawDeclaration("background-color", style.backgroundColor),
      rawDeclaration("color", style.textColor),
      rawDeclaration("border-color", style.borderColor),
      pxDeclaration("border-radius", style.borderRadius),
      rawDeclaration("font-family", style.fontFamily),
      pxDeclaration("font-size", style.fontSize),
      numericDeclaration("font-weight", style.fontWeight),
      pxDeclaration("line-height", style.lineHeight),
      pxDeclaration("letter-spacing", style.letterSpacing),
      numericDeclaration("opacity", style.opacity),
      pxDeclaration("gap", style.gap)
    );

    if (isRecord(style.padding)) {
      declarations.push(\`padding:\${paddingValue(style.padding)} !important;\`);
    }
  }

  if (changes?.visible === false) {
    declarations.push("display:none !important;");
  }

  return declarations.filter(Boolean);
}

function domSelectors(contract) {
  return [
    ...(contract.sections ?? []).map((section, index) => ({ path: \`sections[\${index}].selector\`, selector: section.selector })),
    ...(contract.layers ?? []).map((layer, index) => ({ path: \`layers[\${index}].selector\`, selector: layer.selector })),
    ...(contract.components ?? []).map((component, index) => ({ path: \`components[\${index}].selector\`, selector: component.selector })),
    ...(contract.responsiveRules ?? []).map((rule, index) => ({ path: \`responsiveRules[\${index}].selector\`, selector: rule.selector }))
  ].filter((entry) => typeof entry.selector === "string" && entry.selector.length > 0);
}

function interactionMetadata(contract) {
  return (contract.interactions ?? []).flatMap((interaction, index) => [
    { path: \`interactions[\${index}].id\`, attribute: "data-interaction-ids", value: interaction.id },
    { path: \`interactions[\${index}].event\`, attribute: "data-interaction-events", value: interaction.event },
    { path: \`interactions[\${index}].action\`, attribute: "data-interaction-actions", value: interaction.action }
  ]).filter((entry) => typeof entry.value === "string" && entry.value.length > 0);
}

function assetUriRequirements(contract) {
  return (contract.assets ?? []).map((asset, index) => ({
    path: \`assets[\${index}].uri\`,
    uri: asset.uri,
    used: Array.isArray(asset.usedByLayerIds) && asset.usedByLayerIds.length > 0
  })).filter((entry) => entry.used && typeof entry.uri === "string" && entry.uri.length > 0);
}

function layerCopyRequirements(layerDoc, format) {
  return visibleLayerEntries(layerDoc).map(({ layer, index }) => ({
    path: \`layers[\${index}].content.text\`,
    text: layer.content?.text
  })).filter((entry) => typeof entry.text === "string" && entry.text.length > 0)
    .map((entry) => ({
      ...entry,
      text: format === "html" ? escapeHtmlText(entry.text) : entry.text
    }));
}

function hiddenSectionIds(layerDoc) {
  return new Set((layerDoc.sections ?? []).filter((section) => section.visible === false).map((section) => section.id));
}

function visibleLayerEntries(layerDoc) {
  const hiddenIds = hiddenSectionIds(layerDoc);
  return (layerDoc.layers ?? [])
    .map((layer, index) => ({ layer, index }))
    .filter(({ layer }) => !layer.sectionId || !hiddenIds.has(layer.sectionId));
}

function visibleResponsiveRules(layerDoc, sections, layers, components) {
  const sectionIds = new Set(sections.map((section) => section.id));
  const layerIds = new Set(layers.map((layer) => layer.id));
  const componentIds = new Set(components.map((component) => component.id));
  return (layerDoc.responsive?.rules ?? []).filter((rule) => {
    if (rule.target?.type === "section") {
      return sectionIds.has(rule.target.id);
    }
    if (rule.target?.type === "component") {
      return componentIds.has(rule.target.id);
    }
    return layerIds.has(rule.target?.id);
  });
}

function finiteRect(rect) {
  return isRecord(rect) &&
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height);
}

function relativeLayerBounds(layerDoc, layer) {
  if (!finiteRect(layer.bounds)) {
    return null;
  }

  const section = (layerDoc.sections ?? []).find((candidate) => candidate.id === layer.sectionId);
  if (!finiteRect(section?.bounds)) {
    return { ...layer.bounds };
  }

  return {
    x: layer.bounds.x - section.bounds.x,
    y: layer.bounds.y - section.bounds.y,
    width: layer.bounds.width,
    height: layer.bounds.height
  };
}

function boundsFragments(bounds, format) {
  if (format === "react") {
    return [
      \`left: \${bounds.x}\`,
      \`top: \${bounds.y}\`,
      \`width: \${bounds.width}\`,
      \`height: \${bounds.height}\`
    ];
  }

  return [
    \`left:\${bounds.x}px\`,
    \`top:\${bounds.y}px\`,
    \`width:\${bounds.width}px\`,
    \`height:\${bounds.height}px\`
  ];
}

function layerBoundsRequirements(layerDoc, format) {
  return visibleLayerEntries(layerDoc).flatMap(({ layer, index }) => {
    const bounds = relativeLayerBounds(layerDoc, layer);
    if (!bounds || typeof layer.id !== "string" || layer.id.length === 0) {
      return [];
    }

    const selector = selectorFor("data-layer-id", layer.id);
    return boundsFragments(bounds, format).map((fragment) => ({
      path: \`layers[\${index}].bounds\`,
      selector,
      fragment
    }));
  });
}

function stringStyleFragment(property, value, format) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  return format === "react"
    ? \`\${property}: \${JSON.stringify(value)}\`
    : \`\${property}:\${escapeHtmlText(value)}\`;
}

function numberStyleFragment(property, value, format, unit = "") {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return format === "react"
    ? \`\${property}: \${value}\`
    : \`\${property}:\${value}\${unit}\`;
}

function pixelStringStyleFragment(property, value, format) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return format === "react" ? \`\${property}: \${JSON.stringify(\`\${value}px\`)}\` : \`\${property}:\${value}px\`;
}

function styleFragments(style, format) {
  if (!isRecord(style)) {
    return [];
  }

  const fragments = format === "react"
    ? [
        stringStyleFragment("backgroundColor", style.backgroundColor, format),
        stringStyleFragment("color", style.textColor, format),
        stringStyleFragment("borderColor", style.borderColor, format),
        numberStyleFragment("borderRadius", style.borderRadius, format),
        stringStyleFragment("fontFamily", style.fontFamily, format),
        numberStyleFragment("fontSize", style.fontSize, format),
        numberStyleFragment("fontWeight", style.fontWeight, format),
        pixelStringStyleFragment("lineHeight", style.lineHeight, format),
        pixelStringStyleFragment("letterSpacing", style.letterSpacing, format),
        numberStyleFragment("opacity", style.opacity, format),
        numberStyleFragment("gap", style.gap, format)
      ]
    : [
        stringStyleFragment("background-color", style.backgroundColor, format),
        stringStyleFragment("color", style.textColor, format),
        stringStyleFragment("border-color", style.borderColor, format),
        numberStyleFragment("border-radius", style.borderRadius, format, "px"),
        stringStyleFragment("font-family", style.fontFamily, format),
        numberStyleFragment("font-size", style.fontSize, format, "px"),
        numberStyleFragment("font-weight", style.fontWeight, format),
        pixelStringStyleFragment("line-height", style.lineHeight, format),
        pixelStringStyleFragment("letter-spacing", style.letterSpacing, format),
        numberStyleFragment("opacity", style.opacity, format),
        numberStyleFragment("gap", style.gap, format, "px")
      ];

  if (isRecord(style.padding)) {
    const padding = paddingValue(style.padding);
    fragments.push(format === "react" ? \`padding: \${JSON.stringify(padding)}\` : \`padding:\${padding}\`);
  }

  return fragments.filter(Boolean);
}

function layerStyleRequirements(layerDoc, format) {
  return visibleLayerEntries(layerDoc).flatMap(({ layer, index }) => {
    if (typeof layer.id !== "string" || layer.id.length === 0) {
      return [];
    }

    const selector = selectorFor("data-layer-id", layer.id);
    return styleFragments(layer.style, format).map((fragment) => ({
      path: \`layers[\${index}].style\`,
      selector,
      fragment
    }));
  });
}

// Contract checks must bind fragments to real DOM/TSX nodes, not matching CSS selectors in media queries.
function findDomAttribute(source, attributeFragment, fromIndex = 0) {
  const marker = \` \${attributeFragment}\`;
  let start = source.indexOf(marker, fromIndex);
  while (start !== -1) {
    const tagStart = source.lastIndexOf("<", start);
    const tagEnd = source.lastIndexOf(">", start);
    if (tagStart !== -1 && tagStart > tagEnd) {
      return start + 1;
    }

    start = source.indexOf(marker, start + marker.length);
  }

  return -1;
}

function scopedSourceSegment(source, selector) {
  const needle = selectorAttributeNeedle(selector);
  if (!needle) {
    return "";
  }

  const start = findDomAttribute(source, needle);
  if (start === -1) {
    return "";
  }

  const nextMarkers = ["data-layer-id=", "data-section-id=", "data-component-id="];
  const endCandidates = nextMarkers
    .map((marker) => findDomAttribute(source, marker, start + needle.length))
    .filter((index) => index !== -1);
  const end = endCandidates.length > 0 ? Math.min(...endCandidates) : source.length;
  return source.slice(start, end);
}

function sourceHasScopedFragment(source, selector, fragment) {
  return scopedSourceSegment(source, selector).includes(fragment);
}

function visibleSectionIds(layerDoc) {
  return (layerDoc.sections ?? [])
    .filter((section) => section.visible !== false && typeof section.id === "string" && section.id.length > 0)
    .map((section) => section.id);
}

function sectionOrderRequirement(layerDoc) {
  const expected = visibleSectionIds(layerDoc);
  return expected.length > 1 ? { path: "sections", expected } : null;
}

function sectionOrderFromSource(source, expected) {
  return expected
    .map((sectionId) => ({
      sectionId,
      index: findDomAttribute(source, \`data-section-id="\${sectionId}"\`)
    }))
    .filter((entry) => entry.index !== -1)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.sectionId);
}

function sameOrder(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function responsiveCssRequirements(contract) {
  return (contract.responsiveRules ?? []).flatMap((rule, index) => {
    const fragments = [
      \`@media \${rule.query}\`,
      rule.selector,
      ...declarationsForResponsiveChanges(rule.changes ?? {})
    ].filter((fragment) => typeof fragment === "string" && fragment.length > 0);

    return fragments.map((fragment) => ({ path: \`responsiveRules[\${index}]\`, fragment }));
  });
}

function projectSelectors(contract) {
  return [
    { path: "component.rootSelector", selector: contract.component?.rootSelector },
    ...domSelectors(contract)
  ].filter((entry) => typeof entry.selector === "string" && entry.selector.length > 0);
}

function previewSelectors(contract) {
  return [
    { path: "preview.rootSelector", selector: contract.preview?.rootSelector },
    ...domSelectors(contract)
  ].filter((entry) => typeof entry.selector === "string" && entry.selector.length > 0);
}

function verificationAttributeRequirements(pathPrefix, attributes) {
  return Object.entries(attributes ?? {}).map(([attribute, value]) => ({
    path: pathPrefix + ".verificationAttributes." + attribute,
    attribute,
    value
  }));
}

function selectorForResponsiveTarget(layerDoc, target) {
  if (target?.type === "section") {
    return selectorFor("data-section-id", target.id);
  }
  if (target?.type === "layer") {
    return selectorFor("data-layer-id", target.id);
  }

  const component = (layerDoc.components ?? []).find((candidate) => candidate.id === target?.id);
  return component?.exportable ? selectorFor("data-component-id", target.id) : null;
}

function expectedContractFrom(layerDoc, manifest) {
  const sections = (layerDoc.sections ?? []).filter((section) => section.visible !== false);
  const layers = visibleLayerEntries(layerDoc).map(({ layer }) => layer);
  const visibleLayerIds = new Set(layers.map((layer) => layer.id));
  const visibleSectionIds = new Set(sections.map((section) => section.id));
  const sectionsById = new Map((layerDoc.sections ?? []).map((section) => [section.id, section]));
  const components = (layerDoc.components ?? []).filter((component) => (component.layerIds ?? []).some((layerId) => visibleLayerIds.has(layerId)));
  const responsiveRules = visibleResponsiveRules(layerDoc, sections, layers, components);
  const componentIdsByLayerId = new Map();
  for (const component of components) {
    for (const layerId of component.layerIds ?? []) {
      if (!visibleLayerIds.has(layerId)) {
        continue;
      }

      componentIdsByLayerId.set(layerId, [...(componentIdsByLayerId.get(layerId) ?? []), component.id]);
    }
  }

  return {
    version: "0.1.0",
    layerDoc: {
      file: "layerdoc.json",
      hash: manifest.layerDocHash,
      schema: layerDoc.schema,
      version: layerDoc.version
    },
    component: {
      name: manifest.componentName,
      file: \`src/\${manifest.componentName}.tsx\`,
      rootSelector: selectorFor("data-layerdoc-version", layerDoc.version),
      verificationAttributes: verificationDataAttributes(layerDoc)
    },
    preview: {
      file: "preview.html",
      rootSelector: selectorFor("data-layerdoc", layerDoc.version),
      verificationAttributes: verificationDataAttributes(layerDoc)
    },
    sections: sections.map((section) => ({
      id: section.id,
      name: section.name,
      selector: selectorFor("data-section-id", section.id),
      layerIds: [...(section.layerIds ?? [])]
    })),
    layers: layers.map((layer) => ({
      id: layer.id,
      kind: layer.kind,
      track: layer.track,
      editable: layer.editable,
      sectionId: layer.sectionId ?? null,
      componentIds: componentIdsByLayerId.get(layer.id) ?? [],
      assetId: layer.assetId ?? null,
      selector: selectorFor("data-layer-id", layer.id),
      interactionIds: (layerDoc.interactions ?? []).filter((interaction) => interaction.layerId === layer.id).map((interaction) => interaction.id)
    })),
    components: components.map((component) => ({
      id: component.id,
      exportable: component.exportable,
      selector: component.exportable ? selectorFor("data-component-id", component.id) : null,
      layerIds: [...(component.layerIds ?? []).filter((layerId) => visibleLayerIds.has(layerId))]
    })),
    assets: (layerDoc.assets ?? []).map((asset) => ({
      id: asset.id,
      type: asset.type,
      source: asset.source,
      uri: asset.uri ?? null,
      usedByLayerIds: layers.filter((layer) => layer.assetId === asset.id).map((layer) => layer.id)
    })),
    interactions: (layerDoc.interactions ?? []).filter((interaction) => visibleLayerIds.has(interaction.layerId)).map((interaction) => ({
      id: interaction.id,
      layerId: interaction.layerId,
      event: interaction.event,
      action: interaction.action,
      selector: selectorFor("data-layer-id", interaction.layerId)
    })),
    responsiveRules: responsiveRules.map((rule) => ({
      id: rule.id,
      query: rule.query,
      target: { ...rule.target },
      selector: selectorForResponsiveTarget(layerDoc, rule.target),
      changes: { ...(rule.changes ?? {}) }
    })),
    generationRequests: (layerDoc.generation?.sectionRequests ?? []).map((request) => ({
      id: request.id,
      sectionId: request.sectionId,
      prompt: request.prompt,
      status: request.status,
      requestedAt: request.requestedAt,
      selector: visibleSectionIds.has(request.sectionId) ? selectorFor("data-section-id", request.sectionId) : null,
      sectionVisible: sectionsById.get(request.sectionId)?.visible !== false
    }))
  };
}

const layerDoc = readJson("../layerdoc.json");
const manifest = readJson("../manifest.json");
const contract = readJson("../integration-contract.json");
const expected = expectedContractFrom(layerDoc, manifest);
const issues = [];

if (manifest.integrationContract !== "integration-contract.json") {
  issues.push(issue(
    "integration_contract_manifest_mismatch",
    "manifest.json.integrationContract",
    \`manifest.json points at \${manifest.integrationContract ?? "n/a"} instead of integration-contract.json.\`
  ));
}

if (stableJson(contract) !== stableJson(expected)) {
  issues.push(issue(
    "integration_contract_mismatch",
    "integration-contract.json",
    \`integration-contract.json does not match LayerDoc-derived mapping. Expected \${stableJson(expected)} Received \${stableJson(contract)}\`
  ));
}

try {
  const componentPath = contract.component?.file ?? \`src/\${manifest.componentName}.tsx\`;
  const componentSource = readText(\`../\${componentPath}\`);
  for (const entry of projectSelectors(contract)) {
    const needle = selectorAttributeNeedle(entry.selector);
    if (!needle || !componentSource.includes(needle)) {
      issues.push(issue(
        "project_selector_missing",
        entry.path,
        \`Project file \${componentPath} does not contain selector \${entry.selector}.\`
      ));
    }
  }
  for (const entry of verificationAttributeRequirements("component", contract.component?.verificationAttributes)) {
    if (!sourceHasAttributeValue(componentSource, entry.attribute, entry.value)) {
      issues.push(issue(
        "project_verification_attribute_missing",
        entry.path,
        \`Project file \${componentPath} does not contain \${entry.attribute} value \${entry.value}.\`
      ));
    }
  }
  const sectionOrder = sectionOrderRequirement(layerDoc);
  if (sectionOrder) {
    const actual = sectionOrderFromSource(componentSource, sectionOrder.expected);
    if (actual.length === sectionOrder.expected.length && !sameOrder(actual, sectionOrder.expected)) {
      issues.push(issue(
        "project_section_order_mismatch",
        sectionOrder.path,
        \`Project file \${componentPath} section order \${actual.join(" -> ")} does not match LayerDoc order \${sectionOrder.expected.join(" -> ")}.\`
      ));
    }
  }
  for (const entry of layerBoundsRequirements(layerDoc, "react")) {
    if (!sourceHasScopedFragment(componentSource, entry.selector, entry.fragment)) {
      issues.push(issue(
        "project_layer_bounds_missing",
        entry.path,
        \`Project file \${componentPath} does not contain \${entry.selector} bounds fragment \${entry.fragment}.\`
      ));
    }
  }
  for (const entry of layerStyleRequirements(layerDoc, "react")) {
    if (!sourceHasScopedFragment(componentSource, entry.selector, entry.fragment)) {
      issues.push(issue(
        "project_layer_style_missing",
        entry.path,
        \`Project file \${componentPath} does not contain \${entry.selector} style fragment \${entry.fragment}.\`
      ));
    }
  }
  for (const entry of layerCopyRequirements(layerDoc, "react")) {
    if (!componentSource.includes(entry.text)) {
      issues.push(issue(
        "project_layer_copy_missing",
        entry.path,
        \`Project file \${componentPath} does not contain layer copy \${entry.text}.\`
      ));
    }
  }
  for (const entry of assetUriRequirements(contract)) {
    if (!sourceHasAttributeValue(componentSource, "src", entry.uri)) {
      issues.push(issue(
        "project_asset_uri_missing",
        entry.path,
        \`Project file \${componentPath} does not contain asset src \${entry.uri}.\`
      ));
    }
  }
  for (const entry of responsiveCssRequirements(contract)) {
    if (!componentSource.includes(entry.fragment)) {
      issues.push(issue(
        "project_responsive_css_missing",
        entry.path,
        \`Project file \${componentPath} does not contain responsive CSS fragment \${entry.fragment}.\`
      ));
    }
  }
  for (const entry of interactionMetadata(contract)) {
    if (!sourceHasAttributeToken(componentSource, entry.attribute, entry.value)) {
      issues.push(issue(
        "project_interaction_metadata_missing",
        entry.path,
        \`Project file \${componentPath} does not contain \${entry.attribute} token \${entry.value}.\`
      ));
    }
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown read failure";
  issues.push(issue(
    "project_file_missing",
    "component.file",
    \`Could not read project component file \${contract.component?.file ?? "n/a"}: \${message}\`
  ));
}

try {
  const previewPath = contract.preview?.file ?? "preview.html";
  const previewSource = readText(\`../\${previewPath}\`);
  for (const entry of previewSelectors(contract)) {
    const needle = selectorAttributeNeedle(entry.selector);
    if (!needle || !previewSource.includes(needle)) {
      issues.push(issue(
        "preview_selector_missing",
        entry.path,
        \`Preview file \${previewPath} does not contain selector \${entry.selector}.\`
      ));
    }
  }
  for (const entry of verificationAttributeRequirements("preview", contract.preview?.verificationAttributes)) {
    if (!sourceHasAttributeValue(previewSource, entry.attribute, entry.value)) {
      issues.push(issue(
        "preview_verification_attribute_missing",
        entry.path,
        \`Preview file \${previewPath} does not contain \${entry.attribute} value \${entry.value}.\`
      ));
    }
  }
  const sectionOrder = sectionOrderRequirement(layerDoc);
  if (sectionOrder) {
    const actual = sectionOrderFromSource(previewSource, sectionOrder.expected);
    if (actual.length === sectionOrder.expected.length && !sameOrder(actual, sectionOrder.expected)) {
      issues.push(issue(
        "preview_section_order_mismatch",
        sectionOrder.path,
        \`Preview file \${previewPath} section order \${actual.join(" -> ")} does not match LayerDoc order \${sectionOrder.expected.join(" -> ")}.\`
      ));
    }
  }
  for (const entry of layerBoundsRequirements(layerDoc, "html")) {
    if (!sourceHasScopedFragment(previewSource, entry.selector, entry.fragment)) {
      issues.push(issue(
        "preview_layer_bounds_missing",
        entry.path,
        \`Preview file \${previewPath} does not contain \${entry.selector} bounds fragment \${entry.fragment}.\`
      ));
    }
  }
  for (const entry of layerStyleRequirements(layerDoc, "html")) {
    if (!sourceHasScopedFragment(previewSource, entry.selector, entry.fragment)) {
      issues.push(issue(
        "preview_layer_style_missing",
        entry.path,
        \`Preview file \${previewPath} does not contain \${entry.selector} style fragment \${entry.fragment}.\`
      ));
    }
  }
  for (const entry of layerCopyRequirements(layerDoc, "html")) {
    if (!previewSource.includes(entry.text)) {
      issues.push(issue(
        "preview_layer_copy_missing",
        entry.path,
        \`Preview file \${previewPath} does not contain layer copy \${entry.text}.\`
      ));
    }
  }
  for (const entry of assetUriRequirements(contract)) {
    if (!sourceHasAttributeValue(previewSource, "src", entry.uri)) {
      issues.push(issue(
        "preview_asset_uri_missing",
        entry.path,
        \`Preview file \${previewPath} does not contain asset src \${entry.uri}.\`
      ));
    }
  }
  for (const entry of responsiveCssRequirements(contract)) {
    if (!previewSource.includes(entry.fragment)) {
      issues.push(issue(
        "preview_responsive_css_missing",
        entry.path,
        \`Preview file \${previewPath} does not contain responsive CSS fragment \${entry.fragment}.\`
      ));
    }
  }
  for (const entry of interactionMetadata(contract)) {
    if (!sourceHasAttributeToken(previewSource, entry.attribute, entry.value)) {
      issues.push(issue(
        "preview_interaction_metadata_missing",
        entry.path,
        \`Preview file \${previewPath} does not contain \${entry.attribute} token \${entry.value}.\`
      ));
    }
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown read failure";
  issues.push(issue(
    "preview_file_missing",
    "preview.file",
    \`Could not read preview file \${contract.preview?.file ?? "n/a"}: \${message}\`
  ));
}

const result = {
  passed: issues.length === 0,
  contractPath: "integration-contract.json",
  layerDocHash: manifest.layerDocHash ?? null,
  issues
};

process.stdout.write(\`\${JSON.stringify(result, null, 2)}\\n\`);
if (!result.passed) {
  process.exitCode = 1;
}
`;
}

function layerDocVerifierScriptFor(): string {
  return `import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

function readJson(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
}

function stableJson(value) {
  return \`\${JSON.stringify(value, null, 2)}\\n\`;
}

function sha256(value) {
  return \`sha256:\${createHash("sha256").update(value).digest("hex")}\`;
}

function issue(code, path, message) {
  return { code, path, message };
}

function isPositiveRect(rect) {
  return rect && Number.isFinite(rect.x) && Number.isFinite(rect.y) && rect.width > 0 && rect.height > 0;
}

function fitsCanvas(rect, canvas) {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= canvas.width && rect.y + rect.height <= canvas.height;
}

function collectDuplicateIds(ids) {
  const seen = new Set();
  const duplicates = new Set();
  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.add(id);
    }
    seen.add(id);
  }
  return [...duplicates];
}

function classifyLayer(layer) {
  if (["text", "button", "nav", "card", "form", "input", "list", "table", "icon"].includes(layer.kind)) {
    return "component";
  }
  if (["image", "background"].includes(layer.kind)) {
    return "asset";
  }
  if (["chart", "map", "scene3d"].includes(layer.kind)) {
    return "approximation";
  }
  return "layout";
}

const analysisPlanSources = new Set(["seeded", "provided", "editor", "manual"]);
const analysisPlanTrackKeys = ["component", "asset", "approximation", "layout"];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateNonNegativeNumber(value, path, message, issues) {
  if (!isNonNegativeNumber(value)) {
    issues.push(issue("metadata_invalid", path, message));
  }
}

function validateBoolean(value, path, message, issues) {
  if (typeof value !== "boolean") {
    issues.push(issue("metadata_invalid", path, message));
  }
}

function validateStringArray(value, path, message, issues) {
  if (!isStringArray(value)) {
    issues.push(issue("metadata_invalid", path, message));
  }
}

function validateAnalysisPlanTrackCounts(value, path, issues) {
  if (!isRecord(value)) {
    issues.push(issue("metadata_invalid", path, "Analysis Plan audit track counts must be an object."));
    return;
  }

  for (const track of analysisPlanTrackKeys) {
    validateNonNegativeNumber(value[track], \`\${path}.\${track}\`, \`Analysis Plan audit \${track} track count must be a non-negative number.\`, issues);
  }
}

function validateAnalysisPlanAudit(audit, issues) {
  if (!audit) {
    return;
  }

  const metadataPath = "metadata.analysisPlanAudit";
  if (!isRecord(audit)) {
    issues.push(issue("metadata_invalid", metadataPath, "Analysis Plan audit must be an object."));
    return;
  }

  const summary = audit.summary;
  if (!isRecord(summary)) {
    issues.push(issue("metadata_invalid", \`\${metadataPath}.summary\`, "Analysis Plan audit summary must be an object."));
  } else {
    validateNonNegativeNumber(summary.sections, \`\${metadataPath}.summary.sections\`, "Analysis Plan audit section count must be a non-negative number.", issues);
    validateNonNegativeNumber(summary.layers, \`\${metadataPath}.summary.layers\`, "Analysis Plan audit layer count must be a non-negative number.", issues);
    validateNonNegativeNumber(summary.editableLayers, \`\${metadataPath}.summary.editableLayers\`, "Analysis Plan audit editable layer count must be a non-negative number.", issues);
  }

  validateAnalysisPlanTrackCounts(audit.tracks, \`\${metadataPath}.tracks\`, issues);

  const coverage = audit.coverage;
  if (!isRecord(coverage)) {
    issues.push(issue("metadata_invalid", \`\${metadataPath}.coverage\`, "Analysis Plan audit coverage must be an object."));
  } else {
    validateNonNegativeNumber(coverage.sectionsWithLayers, \`\${metadataPath}.coverage.sectionsWithLayers\`, "Analysis Plan audit sectionsWithLayers must be a non-negative number.", issues);
    validateStringArray(coverage.emptySectionIds, \`\${metadataPath}.coverage.emptySectionIds\`, "Analysis Plan audit emptySectionIds must be a string array.", issues);
  }

  const readiness = audit.readiness;
  if (!isRecord(readiness)) {
    issues.push(issue("metadata_invalid", \`\${metadataPath}.readiness\`, "Analysis Plan audit readiness must be an object."));
  } else {
    validateBoolean(readiness.sectionRangeOk, \`\${metadataPath}.readiness.sectionRangeOk\`, "Analysis Plan audit sectionRangeOk must be boolean.", issues);
    validateBoolean(readiness.validPlan, \`\${metadataPath}.readiness.validPlan\`, "Analysis Plan audit validPlan must be boolean.", issues);
    validateBoolean(readiness.allSectionsHaveLayers, \`\${metadataPath}.readiness.allSectionsHaveLayers\`, "Analysis Plan audit allSectionsHaveLayers must be boolean.", issues);
    validateBoolean(readiness.readyForLayerDoc, \`\${metadataPath}.readiness.readyForLayerDoc\`, "Analysis Plan audit readyForLayerDoc must be boolean.", issues);
    validateStringArray(readiness.blockers, \`\${metadataPath}.readiness.blockers\`, "Analysis Plan audit blockers must be a string array.", issues);
  }

  validateStringArray(audit.issues, \`\${metadataPath}.issues\`, "Analysis Plan audit issues must be a string array.", issues);

  if (!Array.isArray(audit.sectionBreakdown)) {
    issues.push(issue("metadata_invalid", \`\${metadataPath}.sectionBreakdown\`, "Analysis Plan audit sectionBreakdown must be an array."));
    return;
  }

  for (const [index, section] of audit.sectionBreakdown.entries()) {
    const sectionPath = \`\${metadataPath}.sectionBreakdown[\${index}]\`;
    if (!isRecord(section)) {
      issues.push(issue("metadata_invalid", sectionPath, "Analysis Plan audit section breakdown item must be an object."));
      continue;
    }

    if (!isNonEmptyString(section.sectionId)) {
      issues.push(issue("metadata_invalid", \`\${sectionPath}.sectionId\`, "Analysis Plan audit sectionId must be a non-empty string."));
    }
    if (!isNonEmptyString(section.name)) {
      issues.push(issue("metadata_invalid", \`\${sectionPath}.name\`, "Analysis Plan audit section name must be a non-empty string."));
    }
    validateNonNegativeNumber(section.layerCount, \`\${sectionPath}.layerCount\`, "Analysis Plan audit section layerCount must be a non-negative number.", issues);
    validateNonNegativeNumber(section.editableLayerCount, \`\${sectionPath}.editableLayerCount\`, "Analysis Plan audit section editableLayerCount must be a non-negative number.", issues);
    validateAnalysisPlanTrackCounts(section.tracks, \`\${sectionPath}.tracks\`, issues);
  }
}

function validateLayerDoc(doc) {
  const issues = [];
  if (doc?.schema !== "layerdoc") {
    issues.push(issue("schema_invalid", "schema", "LayerDoc schema must be \\"layerdoc\\"."));
  }
  if (doc?.version !== "0.1.0") {
    issues.push(issue("version_invalid", "version", "LayerDoc version must be 0.1.0."));
  }

  const sections = Array.isArray(doc?.sections) ? doc.sections : [];
  const layers = Array.isArray(doc?.layers) ? doc.layers : [];
  const assets = Array.isArray(doc?.assets) ? doc.assets : [];
  const components = Array.isArray(doc?.components) ? doc.components : [];
  const interactions = Array.isArray(doc?.interactions) ? doc.interactions : [];
  const responsiveRules = Array.isArray(doc?.responsive?.rules) ? doc.responsive.rules : [];
  const sectionRequests = Array.isArray(doc?.generation?.sectionRequests) ? doc.generation.sectionRequests : [];
  const canvas = doc?.canvas ?? {};
  const analysisPlan = doc?.metadata?.analysisPlan;
  const analysisPlanAudit = doc?.metadata?.analysisPlanAudit;

  const sectionIds = new Set(sections.map((section) => section.id));
  const layerIds = new Set(layers.map((layer) => layer.id));
  const componentIds = new Set(components.map((component) => component.id));
  const sectionsById = new Map(sections.map((section) => [section.id, section]));
  const layersById = new Map(layers.map((layer) => [layer.id, layer]));
  const assetIds = new Set(assets.map((asset) => asset.id));
  for (const id of collectDuplicateIds([
    ...sections.map((section) => section.id),
    ...layers.map((layer) => layer.id),
    ...assets.map((asset) => asset.id),
    ...components.map((component) => component.id),
    ...interactions.map((interaction) => interaction.id),
    ...responsiveRules.map((rule) => rule.id),
    ...sectionRequests.map((request) => request.id)
  ])) {
    issues.push(issue("duplicate_id", id, \`Duplicate id "\${id}" appears in the LayerDoc graph.\`));
  }

  if (analysisPlan) {
    if (!analysisPlanSources.has(analysisPlan.source)) {
      issues.push(issue("metadata_invalid", "metadata.analysisPlan.source", \`Analysis Plan source "\${analysisPlan.source}" is not supported.\`));
    }
    if (!isNonEmptyString(analysisPlan.name)) {
      issues.push(issue("metadata_invalid", "metadata.analysisPlan.name", "Analysis Plan name must be a non-empty string."));
    }
    if (!isNonNegativeNumber(analysisPlan.sectionCount)) {
      issues.push(issue("metadata_invalid", "metadata.analysisPlan.sectionCount", "Analysis Plan sectionCount must be a non-negative number."));
    }
    if (!isNonNegativeNumber(analysisPlan.layerCount)) {
      issues.push(issue("metadata_invalid", "metadata.analysisPlan.layerCount", "Analysis Plan layerCount must be a non-negative number."));
    }
    if (analysisPlan.uri !== undefined && !isNonEmptyString(analysisPlan.uri)) {
      issues.push(issue("metadata_invalid", "metadata.analysisPlan.uri", "Analysis Plan uri must be a non-empty string when provided."));
    }
  }
  validateAnalysisPlanAudit(analysisPlanAudit, issues);

  for (const [index, section] of sections.entries()) {
    const path = \`sections[\${index}]\`;
    if (!isPositiveRect(section.bounds)) {
      issues.push(issue("bounds_invalid", \`\${path}.bounds\`, \`Section "\${section.id}" has non-positive bounds.\`));
    } else if (!fitsCanvas(section.bounds, canvas)) {
      issues.push(issue("bounds_outside_canvas", \`\${path}.bounds\`, \`Section "\${section.id}" exceeds the canvas.\`));
    }
    if (section.visible !== false && (section.layerIds ?? []).length === 0) {
      issues.push(issue("section_empty", \`\${path}.layerIds\`, \`Visible section "\${section.id}" must contain at least one layer.\`));
    }
    for (const layerId of section.layerIds ?? []) {
      const layer = layersById.get(layerId);
      if (!layer) {
        issues.push(issue("layer_missing", \`\${path}.layerIds\`, \`Section "\${section.id}" references missing layer "\${layerId}".\`));
      } else if (layer.sectionId !== section.id) {
        issues.push(issue(
          "layer_section_mismatch",
          \`\${path}.layerIds\`,
          \`Section "\${section.id}" includes layer "\${layerId}" but that layer points at section "\${layer.sectionId ?? "none"}".\`
        ));
      }
    }
  }

  for (const [index, layer] of layers.entries()) {
    const path = \`layers[\${index}]\`;
    if (!isPositiveRect(layer.bounds)) {
      issues.push(issue("bounds_invalid", \`\${path}.bounds\`, \`Layer "\${layer.id}" has non-positive bounds.\`));
    } else if (!fitsCanvas(layer.bounds, canvas)) {
      issues.push(issue("bounds_outside_canvas", \`\${path}.bounds\`, \`Layer "\${layer.id}" exceeds the canvas.\`));
    }
    if (layer.sectionId) {
      const section = sectionsById.get(layer.sectionId);
      if (!section) {
        issues.push(issue("section_missing", \`\${path}.sectionId\`, \`Layer "\${layer.id}" references missing section "\${layer.sectionId}".\`));
      } else if (!(section.layerIds ?? []).includes(layer.id)) {
        issues.push(issue(
          "layer_section_mismatch",
          \`\${path}.sectionId\`,
          \`Layer "\${layer.id}" points at section "\${layer.sectionId}" but that section does not include the layer id.\`
        ));
      }
    }
    if (layer.track !== classifyLayer(layer)) {
      issues.push(issue("track_mismatch", \`\${path}.track\`, \`Layer "\${layer.id}" is "\${layer.kind}" but is routed to "\${layer.track}".\`));
    }
    if (layer.track === "asset" && (!layer.assetId || !assetIds.has(layer.assetId))) {
      issues.push(issue("asset_missing", \`\${path}.assetId\`, \`Asset layer "\${layer.id}" does not point at a known asset.\`));
    }
  }

  for (const [index, component] of components.entries()) {
    for (const layerId of component.layerIds ?? []) {
      if (!layerIds.has(layerId)) {
        issues.push(issue("layer_missing", \`components[\${index}].layerIds\`, \`Component "\${component.id}" references missing layer "\${layerId}".\`));
      }
    }
  }

  for (const [index, interaction] of interactions.entries()) {
    if (!layerIds.has(interaction.layerId)) {
      issues.push(issue("layer_missing", \`interactions[\${index}].layerId\`, \`Interaction "\${interaction.id}" references missing layer "\${interaction.layerId}".\`));
    }
  }

  for (const [index, rule] of responsiveRules.entries()) {
    const target = rule.target;
    const targetExists =
      (target?.type === "section" && sectionIds.has(target.id)) ||
      (target?.type === "layer" && layerIds.has(target.id)) ||
      (target?.type === "component" && componentIds.has(target.id));

    if (!targetExists) {
      issues.push(issue(
        "responsive_target_missing",
        \`responsive.rules[\${index}].target.id\`,
        \`Responsive rule "\${rule.id}" targets missing \${target?.type ?? "object"} "\${target?.id ?? "unknown"}".\`
      ));
    }
  }

  for (const [index, request] of sectionRequests.entries()) {
    if (!sectionIds.has(request.sectionId)) {
      issues.push(issue("section_missing", \`generation.sectionRequests[\${index}].sectionId\`, \`Regeneration request "\${request.id}" references missing section "\${request.sectionId}".\`));
    }
  }

  return issues;
}

const layerDoc = readJson("../layerdoc.json");
const manifest = readJson("../manifest.json");
const schema = readJson("../layerdoc.schema.json");
const issues = validateLayerDoc(layerDoc);
const actualLayerDocHash = sha256(stableJson(layerDoc));
if (manifest.layerDocHash && manifest.layerDocHash !== actualLayerDocHash) {
  issues.push(issue(
    "layerdoc_hash_mismatch",
    "layerdoc.json",
    \`Current layerdoc.json hash \${actualLayerDocHash} does not match manifest.json \${manifest.layerDocHash}; regenerate the project package from LayerDoc.\`
  ));
}
const result = {
  passed: issues.length === 0,
  schema: schema.$id ?? null,
  layerdocVersion: layerDoc.version ?? null,
  layerDocHash: actualLayerDocHash,
  expectedLayerDocHash: manifest.layerDocHash ?? null,
  issues
};

process.stdout.write(\`\${JSON.stringify(result, null, 2)}\\n\`);
if (!result.passed) {
  process.exitCode = 1;
}
`;
}

function previewVerifierScriptFor(): string {
  return `import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");
const pixelmatchModule = require("pixelmatch");
const pixelmatch = pixelmatchModule.default ?? pixelmatchModule;

const usage = \`Usage: node scripts/verify-preview.mjs [--reference <reference.png>] [--out <directory>] [--candidate <candidate.png>]

Options:
  --reference <reference.png>    Original AI visual or target PNG. Defaults to manifest.json referenceVisual.file.
  --out <directory>              Directory for candidate.png and diff.png. Defaults to verification-artifacts.
  --candidate <candidate.png>    Optional pre-rendered candidate PNG. If omitted, Playwright renders preview.html.
  --browser <executable>         Optional browser executable path for Playwright.
  --threshold <0-1>              Pixelmatch threshold. Defaults to 0.1.
  --include-aa                   Include anti-aliased pixels in visual diff.
\`;

function readOption(args, index, name) {
  const arg = args[index];
  if (arg.startsWith(\`\${name}=\`)) {
    return { value: arg.slice(name.length + 1), nextIndex: index + 1 };
  }
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(\`\${name} requires a value.\\n\\n\${usage}\`);
  }
  return { value, nextIndex: index + 2 };
}

function parseArgs(args) {
  const options = {
    out: "verification-artifacts",
    threshold: 0.1,
    includeAA: false
  };
  let index = 0;
  while (index < args.length) {
    const arg = args[index];
    if (arg === "-h" || arg === "--help") {
      process.stdout.write(usage);
      process.exit(0);
    }
    if (arg === "--include-aa") {
      options.includeAA = true;
      index += 1;
      continue;
    }
    if (arg === "--reference" || arg.startsWith("--reference=")) {
      const option = readOption(args, index, "--reference");
      options.reference = option.value;
      index = option.nextIndex;
      continue;
    }
    if (arg === "--out" || arg.startsWith("--out=")) {
      const option = readOption(args, index, "--out");
      options.out = option.value;
      index = option.nextIndex;
      continue;
    }
    if (arg === "--candidate" || arg.startsWith("--candidate=")) {
      const option = readOption(args, index, "--candidate");
      options.candidate = option.value;
      index = option.nextIndex;
      continue;
    }
    if (arg === "--browser" || arg.startsWith("--browser=")) {
      const option = readOption(args, index, "--browser");
      options.browser = option.value;
      index = option.nextIndex;
      continue;
    }
    if (arg === "--threshold" || arg.startsWith("--threshold=")) {
      const option = readOption(args, index, "--threshold");
      options.threshold = Number(option.value);
      if (!Number.isFinite(options.threshold)) {
        throw new Error("--threshold must be a finite number.");
      }
      index = option.nextIndex;
      continue;
    }
    throw new Error(\`Unknown argument: \${arg}.\\n\\n\${usage}\`);
  }
  return options;
}

function readJson(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
}

function readText(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

function stableJson(value) {
  return \`\${JSON.stringify(value, null, 2)}\\n\`;
}

function writeJson(path, value) {
  writeFileSync(new URL(path, import.meta.url), stableJson(value));
}

function writeText(path, value) {
  writeFileSync(new URL(path, import.meta.url), value);
}

function sha256(value) {
  return \`sha256:\${createHash("sha256").update(value).digest("hex")}\`;
}

function referencePathFrom(options, manifest) {
  const manifestReference = manifest?.referenceVisual?.file;
  const reference = options.reference ?? (typeof manifestReference === "string" && manifestReference.length > 0 ? manifestReference : null);
  if (!reference) {
    throw new Error(\`Missing reference visual. Pass --reference <reference.png> or set manifest.json referenceVisual.file.\\n\\n\${usage}\`);
  }
  return resolve(reference);
}

function normalizedRelative(path) {
  return path.split(/[\\\\/]+/).join("/");
}

function roundPercentage(value) {
  return Math.round(value * 100) / 100;
}

function scoreAttributeValue(value) {
  return value === null || value === undefined ? "n/a" : String(value);
}

function verificationDataAttributes(report) {
  return {
    "data-verification-visual-similarity": scoreAttributeValue(report.visualSimilarity),
    "data-verification-structure-score": scoreAttributeValue(report.structureScore),
    "data-verification-component-score": scoreAttributeValue(report.componentScore),
    "data-verification-project-fit-score": scoreAttributeValue(report.projectFitScore),
    "data-verification-issues": String((report.issues ?? []).length)
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[\\\\^$.*+?()[\\]{}|]/g, "\\\\$&");
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function syncRootAttributes(source, rootAttribute, attrs) {
  let next = source;
  for (const [attribute, value] of Object.entries(attrs)) {
    const replacement = \` \${attribute}="\${escapeAttribute(value)}"\`;
    const attributePattern = new RegExp(\`\\\\s\${escapeRegExp(attribute)}="[^"]*"\`);
    if (attributePattern.test(next)) {
      next = next.replace(attributePattern, replacement);
      continue;
    }

    const rootPattern = new RegExp(\`(\${escapeRegExp(rootAttribute)}="[^"]*")\`);
    if (!rootPattern.test(next)) {
      throw new Error(\`Could not find root attribute \${rootAttribute} while syncing verification attributes.\`);
    }
    next = next.replace(rootPattern, \`$1\${replacement}\`);
  }
  return next;
}

function isDifference(diffData, width, x, y) {
  const index = (width * y + x) << 2;
  return diffData[index] === 255 && diffData[index + 1] === 0 && diffData[index + 2] === 0;
}

function collectProblemAreas(diffData, width, height) {
  const visited = new Uint8Array(width * height);
  const areas = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const startIndex = width * y + x;
      if (visited[startIndex] || !isDifference(diffData, width, x, y)) {
        continue;
      }

      let left = x;
      let top = y;
      let right = x;
      let bottom = y;
      const stack = [[x, y]];
      visited[startIndex] = 1;

      while (stack.length > 0) {
        const [currentX, currentY] = stack.pop();
        left = Math.min(left, currentX);
        top = Math.min(top, currentY);
        right = Math.max(right, currentX);
        bottom = Math.max(bottom, currentY);

        for (const [nextX, nextY] of [
          [currentX + 1, currentY],
          [currentX - 1, currentY],
          [currentX, currentY + 1],
          [currentX, currentY - 1]
        ]) {
          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) {
            continue;
          }
          const nextIndex = width * nextY + nextX;
          if (!visited[nextIndex] && isDifference(diffData, width, nextX, nextY)) {
            visited[nextIndex] = 1;
            stack.push([nextX, nextY]);
          }
        }
      }

      areas.push({ x: left, y: top, width: right - left + 1, height: bottom - top + 1 });
    }
  }

  return areas;
}

function boundsFromAreas(areas) {
  if (areas.length === 0) {
    return null;
  }
  const left = Math.min(...areas.map((area) => area.x));
  const top = Math.min(...areas.map((area) => area.y));
  const right = Math.max(...areas.map((area) => area.x + area.width));
  const bottom = Math.max(...areas.map((area) => area.y + area.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function rectArea(rect) {
  return rect.width * rect.height;
}

function intersectionArea(a, b) {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= left || bottom <= top) {
    return 0;
  }
  return (right - left) * (bottom - top);
}

function visibleLayersFor(layerDoc) {
  const visibleSectionIds = new Set((layerDoc.sections ?? []).filter((section) => section.visible !== false).map((section) => section.id));
  return (layerDoc.layers ?? []).filter((layer) => !layer.sectionId || visibleSectionIds.has(layer.sectionId));
}

function affectedLayerForProblemArea(area, layers) {
  const ranked = layers
    .map((layer) => ({
      layer,
      overlap: intersectionArea(area, layer.bounds),
      layerArea: rectArea(layer.bounds)
    }))
    .filter((candidate) => candidate.overlap > 0)
    .sort((a, b) => {
      if (b.overlap !== a.overlap) {
        return b.overlap - a.overlap;
      }
      if (a.layer.editable !== b.layer.editable) {
        return a.layer.editable ? -1 : 1;
      }
      return a.layerArea - b.layerArea;
    });

  return ranked[0]?.layer ?? null;
}

function visualProblemAreasFor(layerDoc, visualDiff) {
  const layers = visibleLayersFor(layerDoc);
  return (visualDiff.problemAreas ?? []).map((area, index) => {
    const affectedLayer = affectedLayerForProblemArea(area, layers);
    return {
      id: \`visual-problem-\${index + 1}\`,
      bounds: { ...area },
      affectedLayerId: affectedLayer?.id ?? null,
      affectedLayerKind: affectedLayer?.kind ?? null,
      affectedLayerTrack: affectedLayer?.track ?? null,
      affectedLayerEditable: affectedLayer?.editable ?? null,
      affectedSectionId: affectedLayer?.sectionId ?? null
    };
  });
}

function visualProblemSummaryFor(report) {
  const areas = report.visualProblemAreas ?? [];
  return {
    total: areas.length,
    affectedLayerIds: Array.from(new Set(areas.map((area) => area.affectedLayerId).filter(Boolean))),
    unmapped: areas.filter((area) => !area.affectedLayerId).length,
    areas
  };
}

function comparePngs(referencePath, candidatePath, diffPath, threshold, includeAA) {
  const reference = PNG.sync.read(readFileSync(referencePath));
  const candidate = PNG.sync.read(readFileSync(candidatePath));
  if (reference.width !== candidate.width || reference.height !== candidate.height) {
    throw new Error(\`PNG dimensions must match: reference \${reference.width}x\${reference.height}, candidate \${candidate.width}x\${candidate.height}.\`);
  }

  const diff = new PNG({ width: reference.width, height: reference.height });
  const mismatchedPixels = pixelmatch(reference.data, candidate.data, diff.data, reference.width, reference.height, {
    threshold,
    includeAA
  });
  writeFileSync(diffPath, PNG.sync.write(diff));

  const comparedPixels = reference.width * reference.height;
  const problemAreas = collectProblemAreas(diff.data, reference.width, reference.height);
  return {
    visualSimilarity: roundPercentage(100 - (mismatchedPixels / comparedPixels) * 100),
    mismatchedPixels,
    comparedPixels,
    dimensions: { width: reference.width, height: reference.height },
    mismatchBounds: boundsFromAreas(problemAreas),
    problemAreas,
    diffPath: normalizedRelative(diffPath),
    threshold
  };
}

async function renderPreviewScreenshot(outputPath, browserExecutablePath) {
  const { chromium } = await import("playwright");
  const layerDoc = readJson("../layerdoc.json");
  const browser = await chromium.launch(browserExecutablePath ? { executablePath: resolve(browserExecutablePath) } : undefined);
  try {
    const page = await browser.newPage({
      viewport: {
        width: layerDoc.canvas.width,
        height: layerDoc.canvas.height
      },
      deviceScaleFactor: 1
    });
    await page.goto(pathToFileURL(fileURLToPath(new URL("../preview.html", import.meta.url))).href, { waitUntil: "networkidle" });
    await page.screenshot({ path: outputPath });
  } finally {
    await browser.close();
  }
}

const options = parseArgs(process.argv.slice(2));
const manifest = readJson("../manifest.json");
const outputDir = resolve(options.out);
mkdirSync(outputDir, { recursive: true });

const referencePath = referencePathFrom(options, manifest);
const candidatePath = options.candidate ? resolve(options.candidate) : join(outputDir, "candidate.png");
const diffPath = join(outputDir, "diff.png");

if (!options.candidate) {
  await renderPreviewScreenshot(candidatePath, options.browser);
}

const visualDiff = comparePngs(referencePath, candidatePath, diffPath, options.threshold, options.includeAA);
const handoff = readJson("../handoff-summary.json");
const layerDoc = readJson("../layerdoc.json");
const contract = readJson("../integration-contract.json");
const report = readJson("../verification-report.json");
report.visualSimilarity = visualDiff.visualSimilarity;
report.visualDiff = {
  ...visualDiff,
  diffPath: normalizedRelative(join(options.out, "diff.png"))
};
report.visualProblemAreas = visualProblemAreasFor(layerDoc, visualDiff);
report.evidence = {
  ...(report.evidence ?? {}),
  visual: {
    kind: "html-screenshot",
    label: "HTML screenshot",
    description: "The exported project rendered preview.html and compared the captured screenshot."
  }
};
writeJson("../verification-report.json", report);

const verificationAttributes = verificationDataAttributes(report);
layerDoc.verification = {
  scores: {
    visualSimilarity: report.visualSimilarity,
    structureScore: report.structureScore,
    componentScore: report.componentScore,
    projectFitScore: report.projectFitScore
  },
  issues: (report.issues ?? []).map((issue) => ({ ...issue })),
  visualProblemAreas: (report.visualProblemAreas ?? []).map((area) => ({ ...area, bounds: { ...area.bounds } }))
};
const layerDocHash = sha256(stableJson(layerDoc));
writeJson("../layerdoc.json", layerDoc);

manifest.scores = report;
manifest.layerDocHash = layerDocHash;
writeJson("../manifest.json", manifest);

contract.layerDoc = {
  ...(contract.layerDoc ?? {}),
  hash: layerDocHash
};
contract.component = {
  ...(contract.component ?? {}),
  verificationAttributes
};
contract.preview = {
  ...(contract.preview ?? {}),
  verificationAttributes
};
writeJson("../integration-contract.json", contract);

const componentPath = contract.component?.file ?? \`src/\${manifest.componentName}.tsx\`;
const previewPath = contract.preview?.file ?? "preview.html";
writeText(\`../\${componentPath}\`, syncRootAttributes(readText(\`../\${componentPath}\`), "data-layerdoc-version", verificationAttributes));
writeText(\`../\${previewPath}\`, syncRootAttributes(readText(\`../\${previewPath}\`), "data-layerdoc", verificationAttributes));

handoff.sourceOfTruth = {
  ...(handoff.sourceOfTruth ?? {}),
  hash: layerDocHash
};
handoff.quality = {
  ...(handoff.quality ?? {}),
  scores: {
    visual_similarity: report.visualSimilarity,
    structure_score: report.structureScore,
    component_score: report.componentScore,
    project_fit_score: report.projectFitScore
  },
  visualEvidence: report.evidence.visual,
  visualProblems: visualProblemSummaryFor(report)
};
writeJson("../handoff-summary.json", handoff);

process.stdout.write(\`\${JSON.stringify({
  reportPath: "verification-report.json",
  manifestPath: "manifest.json",
  handoffSummaryPath: "handoff-summary.json",
  layerDocPath: "layerdoc.json",
  contractPath: "integration-contract.json",
  componentPath,
  previewPath,
  layerDocHash,
  referencePath,
  candidatePath,
  diffPath: normalizedRelative(join(options.out, "diff.png")),
  visualSimilarity: report.visualSimilarity,
  evidence: report.evidence.visual
}, null, 2)}\\n\`);
`;
}

function appShellFor(componentName: string): string {
  return `import { ${componentName} } from "./${componentName}";

export default function App() {
  return <${componentName} />;
}
`;
}

function mainEntryFor(): string {
  return `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
`;
}

function indexCssFor(): string {
  return `@import "tailwindcss";

:root {
  color: #0f172a;
  background: #f8fafc;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  min-width: 100%;
  min-height: 100%;
  margin: 0;
}

button,
input {
  font: inherit;
}
`;
}

function indexHtmlFor(componentName: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${componentName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

function viteConfigFor(): string {
  return `import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()]
});
`;
}

function tsConfigFor(): string {
  return stableJson({
    compilerOptions: {
      target: "ES2022",
      useDefineForClassFields: true,
      lib: ["DOM", "DOM.Iterable", "ES2022"],
      allowJs: false,
      skipLibCheck: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      strict: true,
      forceConsistentCasingInFileNames: true,
      module: "ESNext",
      moduleResolution: "Bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      jsx: "react-jsx"
    },
    include: ["src"],
    references: []
  });
}

function readmeFor(manifest: ProjectExportManifest): string {
  return `# ${manifest.componentName}

LayerDoc source of truth: \`layerdoc.json\`

Run locally:
- \`npm install\`
- \`npm run dev\`
- \`npm run build\`
- \`npm run verify\`
- \`npm run verify:preview\`
- \`npm run verify:handoff\`
- \`npm run verify:analysis-plan\`
- \`npm run verify:image-manifest\`
- \`npm run verify:layerdoc\`
- \`npm run verify:contract\`
- \`npm run verify:gates\`

Generated assets:
- \`package.json\`, \`index.html\`, \`vite.config.ts\`, \`tsconfig.json\`: runnable Vite React project shell
- \`src/main.tsx\`, \`src/App.tsx\`, \`src/index.css\`: project entry points
- \`src/${manifest.componentName}.tsx\`: React + Tailwind component export
- \`preview.html\`: deterministic HTML verification preview
- \`handoff-summary.json\`: machine-readable integration summary for CI, importers, and downstream project handoff
- \`integration-contract.json\`: stable mapping from visible LayerDoc objects to project files and DOM selectors
- \`manifest.json\`, \`layerdoc.schema.json\`: project package manifest and LayerDoc source contract
- \`${manifest.sectionCandidateSchema}\`: reviewed section regeneration candidate contract for AI workers and Studio imports
${manifest.analysisPlanFile ? `- \`${manifest.analysisPlanFile}\`: confirmed Homepage Analysis Plan used before LayerDoc build\n` : ""}${manifest.analysisPlanSchema ? `- \`${manifest.analysisPlanSchema}\`: Homepage Analysis Plan source contract\n` : ""}${manifest.analysisPlanAuditFile ? `- \`${manifest.analysisPlanAuditFile}\`: Analysis Plan coverage, track, and readiness audit\n` : ""}${manifest.imageManifestFile ? `- \`${manifest.imageManifestFile}\`: source image decomposition manifest connecting the visual intake to LayerDoc sections and layers\n` : ""}- \`${manifest.referenceVisual.file}\`: original target visual expected by preview verification; included when the exporter receives \`referencePng\`; homepage pipeline supplies it automatically
- \`layerdoc-audit.json\`: structure, track, and asset-compliance audit
- \`verification-report.json\`, \`quality-gates.json\`, \`scripts/verify-handoff.mjs\`, \`scripts/verify-analysis-plan.mjs\`, \`scripts/verify-image-manifest.mjs\`, \`scripts/verify-layerdoc.mjs\`, \`scripts/verify-contract.mjs\`, \`scripts/verify-preview.mjs\`, \`scripts/verify-gates.mjs\`: executable source, structure, contract, visual, and quality gate handoff

Verification:
- Run \`npm run verify:preview\` first to use the manifest reference visual, render \`preview.html\`, capture \`verification-artifacts/candidate.png\`, produce \`verification-artifacts/diff.png\`, and sync \`verification-report.json\`, \`layerdoc.json\`, \`manifest.json\`, \`integration-contract.json\`, \`handoff-summary.json\`, and rendered root quality attributes.
- Run \`npm run verify:handoff\` after preview verification to confirm the project package manifest, file list, commands, scripts, entrypoint, contract summary, quality summary, audit summary, and LayerDoc hash still agree.
- Run \`npm run verify:analysis-plan\` to confirm Analysis Plan schema and audit artifacts still match \`manifest.json\`, \`layerdoc.json\`, and \`handoff-summary.json\`.
- Run \`npm run verify:image-manifest\` to confirm the source image decomposition still matches \`manifest.json\`, \`layerdoc.json\`, and \`handoff-summary.json\`.
- Run \`npm run verify:layerdoc\` after editing \`layerdoc.json\` to catch broken graph references before integration.
- Run \`npm run verify:contract\` to confirm \`integration-contract.json\` still matches the LayerDoc source, project selectors, preview selectors, section order, layer bounds, layer style, layer copy, assets, responsive CSS, and interaction metadata.
- Hidden sections remain editable in \`layerdoc.json\` but are intentionally omitted from rendered project, preview, and responsive CSS contract requirements.
- Put the original target visual at \`${manifest.referenceVisual.file}\`.
- Run \`npm run verify:gates\` after preview verification to enforce score thresholds and LayerDoc asset compliance.

Verifier scores:
- visual_similarity: ${manifest.scores.visualSimilarity ?? "n/a"}
- visual_evidence: ${manifest.scores.evidence.visual.kind} (${manifest.scores.evidence.visual.label})
- structure_score: ${manifest.scores.structureScore}
- component_score: ${manifest.scores.componentScore}
- project_fit_score: ${manifest.scores.projectFitScore}
`;
}

function handoffCommands(): ProjectHandoffCommand[] {
  return [
    { label: "Install dependencies", command: "npm install" },
    { label: "Run the project", command: "npm run dev" },
    { label: "Build the project", command: "npm run build" },
    { label: "Verify full handoff", command: "npm run verify" },
    { label: "Verify visual preview", command: "npm run verify:preview" },
    { label: "Verify project handoff", command: "npm run verify:handoff" },
    { label: "Verify Analysis Plan artifacts", command: "npm run verify:analysis-plan" },
    { label: "Verify Image Manifest artifacts", command: "npm run verify:image-manifest" },
    { label: "Verify LayerDoc source", command: "npm run verify:layerdoc" },
    { label: "Verify integration contract", command: "npm run verify:contract" },
    { label: "Enforce quality gates", command: "npm run verify:gates" }
  ];
}

function createHandoffSummary(
  manifest: ProjectExportManifest,
  contract: ProjectIntegrationContract,
  audit: LayerDocAudit,
  sourceImage: LayerDoc["metadata"]["sourceImage"],
  analysisPlan: LayerDoc["metadata"]["analysisPlan"],
  analysisPlanAudit: LayerDoc["metadata"]["analysisPlanAudit"]
): ProjectHandoffSummary {
  return {
    version: "0.1.0",
    positioning: "AI UI Production System",
    source: "layerdoc",
    sourceOfTruth: {
      file: contract.layerDoc.file,
      schemaFile: "layerdoc.schema.json",
      hash: manifest.layerDocHash
    },
    ...(sourceImage ? { sourceVisual: { ...sourceImage } } : {}),
    ...(manifest.imageManifestFile ? { sourceImageManifestFile: manifest.imageManifestFile } : {}),
    ...(analysisPlan ? { sourceAnalysisPlan: { ...analysisPlan } } : {}),
    ...(analysisPlanAudit ? { sourceAnalysisPlanAudit: { ...analysisPlanAudit } } : {}),
    ...(manifest.analysisPlanFile || manifest.analysisPlanSchema || manifest.analysisPlanAuditFile
      ? {
          sourceAnalysisPlanFiles: {
            ...(manifest.analysisPlanFile ? { planFile: manifest.analysisPlanFile } : {}),
            ...(manifest.analysisPlanSchema ? { schemaFile: manifest.analysisPlanSchema } : {}),
            ...(manifest.analysisPlanAuditFile ? { auditFile: manifest.analysisPlanAuditFile } : {})
          }
        }
      : {}),
    entrypoint: {
      component: contract.component.name,
      file: contract.component.file,
      rootSelector: contract.component.rootSelector
    },
    contract: {
      file: manifest.integrationContract,
      sections: contract.sections.length,
      layers: contract.layers.length,
      components: contract.components.length,
      assets: contract.assets.filter((asset) => asset.usedByLayerIds.length > 0).length,
      interactions: contract.interactions.length,
      responsiveRules: contract.responsiveRules.length,
      generationRequests: contract.generationRequests.length
    },
    sectionRegeneration: {
      candidateSchemaFile: manifest.sectionCandidateSchema,
      requestCount: contract.generationRequests.length
    },
    quality: {
      scores: {
        visual_similarity: manifest.scores.visualSimilarity,
        structure_score: manifest.scores.structureScore,
        component_score: manifest.scores.componentScore,
        project_fit_score: manifest.scores.projectFitScore
      },
      visualEvidence: manifest.scores.evidence.visual,
      visualProblems: visualProblemSummaryFor(manifest.scores),
      referenceVisual: manifest.referenceVisual,
      gatesFile: "quality-gates.json"
    },
    audit: {
      file: "layerdoc-audit.json",
      assetCompliancePassed: audit.assetCompliance.passed,
      structureValid: audit.structure.valid,
      editableCoverage: audit.editableCoverage
    },
    commands: handoffCommands()
  };
}

/**
 * Package a LayerDoc into files a downstream project can commit.
 * LayerDoc remains the editable source; React, preview HTML, and reports are
 * derived artifacts with traceable layer ids.
 */
export function createProjectExportPackage(doc: LayerDoc, options: ProjectExportPackageOptions): ProjectExportPackage {
  const report = options.report ?? createVerificationReport(doc);
  const sourceDoc = layerDocWithVerificationReport(doc, report);
  const reactExport = exportReactTailwind(sourceDoc, { componentName: options.componentName });
  const audit = createLayerDocAudit(sourceDoc);
  const packageName = options.packageName ?? toKebabCase(options.componentName);
  const sourceHash = layerDocHash(sourceDoc);
  const referenceVisual = referenceVisualFor(sourceDoc.metadata.sourceImage);
  const analysisPlanPath = options.analysisPlan ? "analysis-plan.json" : undefined;
  const imageManifestPath = options.imageManifest ? "image-manifest.json" : undefined;
  const analysisPlanSchemaPath = sourceDoc.metadata.analysisPlan || sourceDoc.metadata.analysisPlanAudit ? "analysis-plan.schema.json" : undefined;
  const analysisPlanAuditPath = sourceDoc.metadata.analysisPlanAudit ? "analysis-plan-audit.json" : undefined;
  const files = [
    "README.md",
    ...(analysisPlanPath ? [analysisPlanPath] : []),
    ...(imageManifestPath ? [imageManifestPath] : []),
    ...(analysisPlanAuditPath ? [analysisPlanAuditPath] : []),
    ...(analysisPlanSchemaPath ? [analysisPlanSchemaPath] : []),
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
    SECTION_CANDIDATE_SCHEMA_FILE,
    ...(options.referencePng ? [referenceVisual.file] : []),
    "scripts/verify-analysis-plan.mjs",
    "scripts/verify-contract.mjs",
    "scripts/verify-gates.mjs",
    "scripts/verify-handoff.mjs",
    "scripts/verify-image-manifest.mjs",
    "scripts/verify-layerdoc.mjs",
    "scripts/verify-preview.mjs",
    "src/App.tsx",
    "src/index.css",
    "src/main.tsx",
    `src/${reactExport.fileName}`,
    "tsconfig.json",
    "verification-report.json",
    "vite.config.ts"
  ];
  const manifest: ProjectExportManifest = {
    packageName,
    componentName: options.componentName,
    source: "layerdoc",
    layerDocHash: sourceHash,
    integrationContract: "integration-contract.json",
    handoffSummary: "handoff-summary.json",
    sectionCandidateSchema: SECTION_CANDIDATE_SCHEMA_FILE,
    referenceVisual,
    ...(sourceDoc.metadata.analysisPlan ? { analysisPlan: { ...sourceDoc.metadata.analysisPlan } } : {}),
    ...(analysisPlanPath ? { analysisPlanFile: analysisPlanPath } : {}),
    ...(imageManifestPath ? { imageManifestFile: imageManifestPath } : {}),
    ...(sourceDoc.metadata.analysisPlanAudit ? { analysisPlanAudit: { ...sourceDoc.metadata.analysisPlanAudit } } : {}),
    ...(analysisPlanSchemaPath ? { analysisPlanSchema: analysisPlanSchemaPath } : {}),
    ...(analysisPlanAuditPath ? { analysisPlanAuditFile: analysisPlanAuditPath } : {}),
    files,
    scores: report,
    audit
  };
  const integrationContract = createIntegrationContract(sourceDoc, options.componentName, reactExport.fileName, sourceHash);
  const handoffSummary = createHandoffSummary(
    manifest,
    integrationContract,
    audit,
    sourceDoc.metadata.sourceImage,
    sourceDoc.metadata.analysisPlan,
    sourceDoc.metadata.analysisPlanAudit
  );

  return {
    manifest,
    files: [
      { path: "README.md", contents: readmeFor(manifest) },
      ...(analysisPlanPath && options.analysisPlan ? [{ path: analysisPlanPath, contents: stableJson(options.analysisPlan) }] : []),
      ...(imageManifestPath && options.imageManifest ? [{ path: imageManifestPath, contents: stableJson(options.imageManifest) }] : []),
      ...(analysisPlanAuditPath && sourceDoc.metadata.analysisPlanAudit
        ? [{ path: analysisPlanAuditPath, contents: stableJson(sourceDoc.metadata.analysisPlanAudit) }]
        : []),
      ...(analysisPlanSchemaPath ? [{ path: analysisPlanSchemaPath, contents: stableJson(createHomepageAnalysisPlanJsonSchema()) }] : []),
      { path: "handoff-summary.json", contents: stableJson(handoffSummary) },
      { path: "index.html", contents: indexHtmlFor(options.componentName) },
      { path: "integration-contract.json", contents: stableJson(integrationContract) },
      { path: "layerdoc-audit.json", contents: stableJson(audit) },
      { path: "layerdoc.schema.json", contents: stableJson(createLayerDocJsonSchema()) },
      { path: "layerdoc.json", contents: stableJson(sourceDoc) },
      { path: "manifest.json", contents: stableJson(manifest) },
      { path: "package.json", contents: packageJsonFor(manifest) },
      { path: "preview.html", contents: renderHtmlPreview(sourceDoc) },
      { path: "quality-gates.json", contents: stableJson(defaultVerificationGates) },
      { path: SECTION_CANDIDATE_SCHEMA_FILE, contents: stableJson(createSectionRegenerationCandidateJsonSchema()) },
      ...(options.referencePng ? [{ path: referenceVisual.file, contents: options.referencePng }] : []),
      { path: "scripts/verify-analysis-plan.mjs", contents: analysisPlanVerifierScriptFor() },
      { path: "scripts/verify-contract.mjs", contents: contractVerifierScriptFor() },
      { path: "scripts/verify-gates.mjs", contents: qualityGateScriptFor() },
      { path: "scripts/verify-handoff.mjs", contents: handoffVerifierScriptFor() },
      { path: "scripts/verify-image-manifest.mjs", contents: imageManifestVerifierScriptFor() },
      { path: "scripts/verify-layerdoc.mjs", contents: layerDocVerifierScriptFor() },
      { path: "scripts/verify-preview.mjs", contents: previewVerifierScriptFor() },
      { path: "src/App.tsx", contents: appShellFor(options.componentName) },
      { path: "src/index.css", contents: indexCssFor() },
      { path: "src/main.tsx", contents: mainEntryFor() },
      { path: "tsconfig.json", contents: tsConfigFor() },
      { path: "verification-report.json", contents: stableJson(report) },
      { path: "vite.config.ts", contents: viteConfigFor() },
      { path: `src/${reactExport.fileName}`, contents: reactExport.code }
    ]
  };
}
