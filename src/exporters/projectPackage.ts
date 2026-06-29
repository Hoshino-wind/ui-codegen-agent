import type { LayerDoc } from "../layerdoc/types.js";
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
}

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

function readmeFor(manifest: ProjectExportManifest): string {
  return `# ${manifest.componentName}

LayerDoc source of truth: \`layerdoc.json\`

Generated assets:
- \`src/${manifest.componentName}.tsx\`: React + Tailwind component export
- \`preview.html\`: deterministic HTML verification preview
- \`manifest.json\`: project package manifest and quality scores

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
  const packageName = options.packageName ?? toKebabCase(options.componentName);
  const manifest: ProjectExportManifest = {
    packageName,
    componentName: options.componentName,
    source: "layerdoc",
    files: [
      "README.md",
      "layerdoc.json",
      "manifest.json",
      "preview.html",
      `src/${reactExport.fileName}`
    ],
    scores: report
  };

  return {
    manifest,
    files: [
      { path: "README.md", contents: readmeFor(manifest) },
      { path: "layerdoc.json", contents: stableJson(doc) },
      { path: "manifest.json", contents: stableJson(manifest) },
      { path: "preview.html", contents: renderHtmlPreview(doc) },
      { path: `src/${reactExport.fileName}`, contents: reactExport.code }
    ]
  };
}
