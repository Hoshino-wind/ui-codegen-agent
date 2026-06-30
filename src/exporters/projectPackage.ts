import type { LayerDoc } from "../layerdoc/types.js";
import { createLayerDocAudit, type LayerDocAudit } from "../layerdoc/audit.js";
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
- \`npm run verify:gates\`

Generated assets:
- \`package.json\`, \`index.html\`, \`vite.config.ts\`, \`tsconfig.json\`: runnable Vite React project shell
- \`src/main.tsx\`, \`src/App.tsx\`, \`src/index.css\`: project entry points
- \`src/${manifest.componentName}.tsx\`: React + Tailwind component export
- \`preview.html\`: deterministic HTML verification preview
- \`manifest.json\`: project package manifest and quality scores
- \`layerdoc-audit.json\`: structure, track, and asset-compliance audit
- \`verification-report.json\`, \`quality-gates.json\`, \`scripts/verify-gates.mjs\`: executable quality gate handoff

Verification:
- Use \`runLayerDocPreviewVerification\` with the original reference PNG to render \`preview.html\`, capture a candidate PNG, and produce \`diff.png\`.

Verifier scores:
- visual_similarity: ${manifest.scores.visualSimilarity ?? "n/a"}
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
    "layerdoc.json",
    "manifest.json",
    "package.json",
    "preview.html",
    "quality-gates.json",
    "scripts/verify-gates.mjs",
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
      { path: "layerdoc.json", contents: stableJson(doc) },
      { path: "manifest.json", contents: stableJson(manifest) },
      { path: "package.json", contents: packageJsonFor(manifest) },
      { path: "preview.html", contents: renderHtmlPreview(doc) },
      { path: "quality-gates.json", contents: stableJson(defaultVerificationGates) },
      { path: "scripts/verify-gates.mjs", contents: qualityGateScriptFor() },
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
