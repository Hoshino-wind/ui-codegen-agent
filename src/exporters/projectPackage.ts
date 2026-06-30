import type { LayerDoc } from "../layerdoc/types.js";
import { createLayerDocAudit, type LayerDocAudit } from "../layerdoc/audit.js";
import { createLayerDocJsonSchema } from "../layerdoc/jsonSchema.js";
import { defaultVerificationGates, type VerificationGates } from "../verifier/gates.js";
import { createVerificationReport, type VerificationReport } from "../verifier/report.js";
import { renderHtmlPreview } from "./htmlPreview.js";
import { exportReactTailwind } from "./reactTailwind.js";

export interface ProjectExportPackageOptions {
  componentName: string;
  packageName?: string;
  report?: VerificationReport;
}

export interface ProjectExportFile {
  path: string;
  contents: string;
}

export interface ProjectExportManifest {
  packageName: string;
  componentName: string;
  source: "layerdoc";
  layerDocHash: string;
  integrationContract: string;
  files: string[];
  scores: VerificationReport;
  audit: LayerDocAudit;
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
  };
  preview: {
    file: string;
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
}

export type ProjectQualityGates = VerificationGates;

export interface ProjectExportPackage {
  manifest: ProjectExportManifest;
  files: ProjectExportFile[];
}

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

function createIntegrationContract(doc: LayerDoc, componentName: string, componentFile: string, sourceHash: string): ProjectIntegrationContract {
  const componentIdsByLayerId = new Map<string, string[]>();
  for (const component of doc.components) {
    for (const layerId of component.layerIds) {
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
      rootSelector: selectorFor("data-layerdoc-version", doc.version)
    },
    preview: {
      file: "preview.html"
    },
    sections: doc.sections.map((section) => ({
      id: section.id,
      name: section.name,
      selector: selectorFor("data-section-id", section.id),
      layerIds: [...section.layerIds]
    })),
    layers: doc.layers.map((layer) => ({
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
    components: doc.components.map((component) => ({
      id: component.id,
      exportable: component.exportable,
      selector: component.exportable ? selectorFor("data-component-id", component.id) : null,
      layerIds: [...component.layerIds]
    })),
    assets: doc.assets.map((asset) => ({
      id: asset.id,
      type: asset.type,
      source: asset.source,
      uri: asset.uri ?? null,
      usedByLayerIds: doc.layers.filter((layer) => layer.assetId === asset.id).map((layer) => layer.id)
    })),
    interactions: doc.interactions.map((interaction) => ({
      id: interaction.id,
      layerId: interaction.layerId,
      event: interaction.event,
      action: interaction.action,
      selector: selectorFor("data-layer-id", interaction.layerId)
    })),
    responsiveRules: doc.responsive.rules.map((rule) => ({
      id: rule.id,
      query: rule.query,
      target: { ...rule.target },
      selector: selectorForResponsiveTarget(doc, rule.target),
      changes: { ...rule.changes }
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
  return (layerDoc.layers ?? []).map((layer, index) => ({
    path: \`layers[\${index}].content.text\`,
    text: layer.content?.text
  })).filter((entry) => typeof entry.text === "string" && entry.text.length > 0)
    .map((entry) => ({
      ...entry,
      text: format === "html" ? escapeHtmlText(entry.text) : entry.text
    }));
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
  return (layerDoc.layers ?? []).flatMap((layer, index) => {
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
        numberStyleFragment("opacity", style.opacity, format),
        numberStyleFragment("gap", style.gap, format)
      ]
    : [
        stringStyleFragment("background-color", style.backgroundColor, format),
        stringStyleFragment("color", style.textColor, format),
        stringStyleFragment("border-color", style.borderColor, format),
        numberStyleFragment("border-radius", style.borderRadius, format, "px"),
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
  return (layerDoc.layers ?? []).flatMap((layer, index) => {
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
  const componentIdsByLayerId = new Map();
  for (const component of layerDoc.components ?? []) {
    for (const layerId of component.layerIds ?? []) {
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
      rootSelector: selectorFor("data-layerdoc-version", layerDoc.version)
    },
    preview: {
      file: "preview.html"
    },
    sections: (layerDoc.sections ?? []).map((section) => ({
      id: section.id,
      name: section.name,
      selector: selectorFor("data-section-id", section.id),
      layerIds: [...(section.layerIds ?? [])]
    })),
    layers: (layerDoc.layers ?? []).map((layer) => ({
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
    components: (layerDoc.components ?? []).map((component) => ({
      id: component.id,
      exportable: component.exportable,
      selector: component.exportable ? selectorFor("data-component-id", component.id) : null,
      layerIds: [...(component.layerIds ?? [])]
    })),
    assets: (layerDoc.assets ?? []).map((asset) => ({
      id: asset.id,
      type: asset.type,
      source: asset.source,
      uri: asset.uri ?? null,
      usedByLayerIds: (layerDoc.layers ?? []).filter((layer) => layer.assetId === asset.id).map((layer) => layer.id)
    })),
    interactions: (layerDoc.interactions ?? []).map((interaction) => ({
      id: interaction.id,
      layerId: interaction.layerId,
      event: interaction.event,
      action: interaction.action,
      selector: selectorFor("data-layer-id", interaction.layerId)
    })),
    responsiveRules: (layerDoc.responsive?.rules ?? []).map((rule) => ({
      id: rule.id,
      query: rule.query,
      target: { ...rule.target },
      selector: selectorForResponsiveTarget(layerDoc, rule.target),
      changes: { ...(rule.changes ?? {}) }
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
  for (const entry of domSelectors(contract)) {
    const needle = selectorAttributeNeedle(entry.selector);
    if (!needle || !previewSource.includes(needle)) {
      issues.push(issue(
        "preview_selector_missing",
        entry.path,
        \`Preview file \${previewPath} does not contain selector \${entry.selector}.\`
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
  return `import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");
const pixelmatchModule = require("pixelmatch");
const pixelmatch = pixelmatchModule.default ?? pixelmatchModule;

const usage = \`Usage: node scripts/verify-preview.mjs --reference <reference.png> [--out <directory>] [--candidate <candidate.png>]

Options:
  --reference <reference.png>    Original AI visual or target PNG.
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
  if (!options.reference) {
    throw new Error(\`Missing required argument: --reference <reference.png>.\\n\\n\${usage}\`);
  }
  return options;
}

function readJson(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
}

function writeJson(path, value) {
  writeFileSync(new URL(path, import.meta.url), \`\${JSON.stringify(value, null, 2)}\\n\`);
}

function normalizedRelative(path) {
  return path.split(/[\\\\/]+/).join("/");
}

function roundPercentage(value) {
  return Math.round(value * 100) / 100;
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
const outputDir = resolve(options.out);
mkdirSync(outputDir, { recursive: true });

const referencePath = resolve(options.reference);
const candidatePath = options.candidate ? resolve(options.candidate) : join(outputDir, "candidate.png");
const diffPath = join(outputDir, "diff.png");

if (!options.candidate) {
  await renderPreviewScreenshot(candidatePath, options.browser);
}

const visualDiff = comparePngs(referencePath, candidatePath, diffPath, options.threshold, options.includeAA);
const report = readJson("../verification-report.json");
report.visualSimilarity = visualDiff.visualSimilarity;
report.visualDiff = {
  ...visualDiff,
  diffPath: normalizedRelative(join(options.out, "diff.png"))
};
report.evidence = {
  ...(report.evidence ?? {}),
  visual: {
    kind: "html-screenshot",
    label: "HTML screenshot",
    description: "The exported project rendered preview.html and compared the captured screenshot."
  }
};
writeJson("../verification-report.json", report);

process.stdout.write(\`\${JSON.stringify({
  reportPath: "verification-report.json",
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
- \`npm run verify:layerdoc\`
- \`npm run verify:contract\`
- \`npm run verify:preview -- --reference ./reference.png\`
- \`npm run verify:gates\`

Generated assets:
- \`package.json\`, \`index.html\`, \`vite.config.ts\`, \`tsconfig.json\`: runnable Vite React project shell
- \`src/main.tsx\`, \`src/App.tsx\`, \`src/index.css\`: project entry points
- \`src/${manifest.componentName}.tsx\`: React + Tailwind component export
- \`preview.html\`: deterministic HTML verification preview
- \`integration-contract.json\`: stable mapping from LayerDoc objects to project files and DOM selectors
- \`manifest.json\`, \`layerdoc.schema.json\`: project package manifest and LayerDoc source contract
- \`layerdoc-audit.json\`: structure, track, and asset-compliance audit
- \`verification-report.json\`, \`quality-gates.json\`, \`scripts/verify-layerdoc.mjs\`, \`scripts/verify-contract.mjs\`, \`scripts/verify-preview.mjs\`, \`scripts/verify-gates.mjs\`: executable source, contract, visual, and quality gate handoff

Verification:
- Run \`npm run verify:layerdoc\` after editing \`layerdoc.json\` to catch broken graph references before integration.
- Run \`npm run verify:contract\` to confirm \`integration-contract.json\` still matches the LayerDoc source, project selectors, preview selectors, layer bounds, layer style, layer copy, assets, responsive CSS, and interaction metadata.
- Put the original target visual at \`reference.png\`.
- Run \`npm run verify:preview -- --reference ./reference.png\` to render \`preview.html\`, capture \`verification-artifacts/candidate.png\`, produce \`verification-artifacts/diff.png\`, and update \`verification-report.json\`.
- Run \`npm run verify:gates\` after preview verification to enforce score thresholds and LayerDoc asset compliance.

Verifier scores:
- visual_similarity: ${manifest.scores.visualSimilarity ?? "n/a"}
- visual_evidence: ${manifest.scores.evidence.visual.kind} (${manifest.scores.evidence.visual.label})
- structure_score: ${manifest.scores.structureScore}
- component_score: ${manifest.scores.componentScore}
- project_fit_score: ${manifest.scores.projectFitScore}
`;
}

/**
 * Package a LayerDoc into files a downstream project can commit.
 * LayerDoc remains the editable source; React, preview HTML, and reports are
 * derived artifacts with traceable layer ids.
 */
export function createProjectExportPackage(doc: LayerDoc, options: ProjectExportPackageOptions): ProjectExportPackage {
  const reactExport = exportReactTailwind(doc, { componentName: options.componentName });
  const report = options.report ?? createVerificationReport(doc);
  const audit = createLayerDocAudit(doc);
  const packageName = options.packageName ?? toKebabCase(options.componentName);
  const sourceHash = layerDocHash(doc);
  const files = [
    "README.md",
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
    files,
    scores: report,
    audit
  };
  const integrationContract = createIntegrationContract(doc, options.componentName, reactExport.fileName, sourceHash);

  return {
    manifest,
    files: [
      { path: "README.md", contents: readmeFor(manifest) },
      { path: "index.html", contents: indexHtmlFor(options.componentName) },
      { path: "integration-contract.json", contents: stableJson(integrationContract) },
      { path: "layerdoc-audit.json", contents: stableJson(audit) },
      { path: "layerdoc.schema.json", contents: stableJson(createLayerDocJsonSchema()) },
      { path: "layerdoc.json", contents: stableJson(doc) },
      { path: "manifest.json", contents: stableJson(manifest) },
      { path: "package.json", contents: packageJsonFor(manifest) },
      { path: "preview.html", contents: renderHtmlPreview(doc) },
      { path: "quality-gates.json", contents: stableJson(defaultVerificationGates) },
      { path: "scripts/verify-contract.mjs", contents: contractVerifierScriptFor() },
      { path: "scripts/verify-gates.mjs", contents: qualityGateScriptFor() },
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
