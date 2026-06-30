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
  files: string[];
  scores: VerificationReport;
  audit: LayerDocAudit;
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
- \`npm run verify:preview -- --reference ./reference.png\`
- \`npm run verify:gates\`

Generated assets:
- \`package.json\`, \`index.html\`, \`vite.config.ts\`, \`tsconfig.json\`: runnable Vite React project shell
- \`src/main.tsx\`, \`src/App.tsx\`, \`src/index.css\`: project entry points
- \`src/${manifest.componentName}.tsx\`: React + Tailwind component export
- \`preview.html\`: deterministic HTML verification preview
- \`manifest.json\`, \`layerdoc.schema.json\`: project package manifest and LayerDoc source contract
- \`layerdoc-audit.json\`: structure, track, and asset-compliance audit
- \`verification-report.json\`, \`quality-gates.json\`, \`scripts/verify-preview.mjs\`, \`scripts/verify-gates.mjs\`: executable visual verifier and quality gate handoff

Verification:
- Put the original target visual at \`reference.png\`.
- Run \`npm run verify:preview -- --reference ./reference.png\` to render \`preview.html\`, capture \`verification-artifacts/candidate.png\`, produce \`verification-artifacts/diff.png\`, and update \`verification-report.json\`.
- Run \`npm run verify:gates\` after preview verification to enforce the current quality gates.

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
  const files = [
    "README.md",
    "index.html",
    "layerdoc-audit.json",
    "layerdoc.schema.json",
    "layerdoc.json",
    "manifest.json",
    "package.json",
    "preview.html",
    "quality-gates.json",
    "scripts/verify-gates.mjs",
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
    files,
    scores: report,
    audit
  };

  return {
    manifest,
    files: [
      { path: "README.md", contents: readmeFor(manifest) },
      { path: "index.html", contents: indexHtmlFor(options.componentName) },
      { path: "layerdoc-audit.json", contents: stableJson(audit) },
      { path: "layerdoc.schema.json", contents: stableJson(createLayerDocJsonSchema()) },
      { path: "layerdoc.json", contents: stableJson(doc) },
      { path: "manifest.json", contents: stableJson(manifest) },
      { path: "package.json", contents: packageJsonFor(manifest) },
      { path: "preview.html", contents: renderHtmlPreview(doc) },
      { path: "quality-gates.json", contents: stableJson(defaultVerificationGates) },
      { path: "scripts/verify-gates.mjs", contents: qualityGateScriptFor() },
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
