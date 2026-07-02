import { validateLayerDoc } from "../layerdoc/validation.js";
import type { LayerDoc } from "../layerdoc/types.js";
import { createHomepageAnalysisPlanJsonSchema, type HomepageAnalysisPlan } from "../importers/homepageAnalysisPlan.js";
import { createHomepageAnalysisTask } from "../importers/homepageAnalysisTask.js";
import type { ProjectExportPackage } from "../exporters/projectPackage.js";
import { createStoredZipArchive, type ZipArchiveFile } from "../exporters/zipArchive.js";
import { base64ToBytes, bytesToBase64 } from "../shared/base64.js";
import { createEditorWorkspace, type EditorWorkspace } from "./editorWorkspace.js";

export interface LayerDocDownloadArtifact {
  fileName: string;
  mimeType: "application/json" | "application/zip" | "text/html;charset=utf-8" | "text/plain;charset=utf-8";
  contents: string | Uint8Array;
}

export interface AnalysisTaskPackageDownloadInput {
  name: string;
  sourceImage: {
    uri: string;
    width: number;
    height: number;
    dataUri?: string;
  };
}

interface JsonProjectExportTextFile {
  path: string;
  contents: string;
}

interface JsonProjectExportBinaryFile {
  path: string;
  contentEncoding: "base64";
  contentsBase64: string;
}

type JsonProjectExportFile = JsonProjectExportTextFile | JsonProjectExportBinaryFile;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLayerDocCandidate(value: unknown): value is LayerDoc {
  return (
    isRecord(value) &&
    value.schema === "layerdoc" &&
    value.version === "0.1.0" &&
    isRecord(value.metadata) &&
    isRecord(value.canvas) &&
    Array.isArray(value.sections) &&
    Array.isArray(value.layers) &&
    Array.isArray(value.assets) &&
    Array.isArray(value.components) &&
    Array.isArray(value.interactions) &&
    isRecord(value.responsive) &&
    isRecord(value.verification)
  );
}

function normalizeLayerDocCandidate(doc: LayerDoc): LayerDoc {
  return {
    ...doc,
    generation: {
      sectionRequests: doc.generation?.sectionRequests ?? [],
      sectionApplications: doc.generation?.sectionApplications ?? []
    },
    verification: {
      ...doc.verification,
      visualProblemAreas: doc.verification.visualProblemAreas ?? []
    }
  };
}

function parseLayerDocJson(contents: string): LayerDoc {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON.";
    throw new Error(`LayerDoc JSON could not be parsed: ${message}`);
  }

  if (!isLayerDocCandidate(parsed)) {
    throw new Error("Input file is not a LayerDoc 0.1.0 document.");
  }

  const doc = normalizeLayerDocCandidate(parsed);
  const validation = validateLayerDoc(doc);
  if (!validation.valid) {
    const messages = validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join(" ");
    throw new Error(`LayerDoc validation failed: ${messages}`);
  }

  return doc;
}

function projectExportForJson(projectExport: ProjectExportPackage): Omit<ProjectExportPackage, "files"> & { files: JsonProjectExportFile[] } {
  return {
    ...projectExport,
    files: projectExport.files.map((file) =>
      typeof file.contents === "string"
        ? { path: file.path, contents: file.contents }
        : { path: file.path, contentEncoding: "base64", contentsBase64: bytesToBase64(file.contents) }
    )
  };
}

function sourcePngFromDataUri(dataUri: string | undefined): Uint8Array | null {
  if (!dataUri) {
    return null;
  }

  const match = /^data:image\/png(?:;[^,]*)?;base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUri);
  if (!match) {
    throw new Error("Analysis Task source image must be a PNG data URI.");
  }

  return base64ToBytes(match[1]);
}

export function createWorkspaceFromLayerDocJson(contents: string): EditorWorkspace {
  return createEditorWorkspace(parseLayerDocJson(contents));
}

export function createLayerDocDownload(doc: LayerDoc, fileName = "layerdoc.json"): LayerDocDownloadArtifact {
  return {
    fileName,
    mimeType: "application/json",
    contents: `${JSON.stringify(doc, null, 2)}\n`
  };
}

export function createAnalysisPlanDownload(plan: HomepageAnalysisPlan, fileName = "analysis-plan.json"): LayerDocDownloadArtifact {
  return {
    fileName,
    mimeType: "application/json",
    contents: `${JSON.stringify(plan, null, 2)}\n`
  };
}

// Studio emits the same two-file handoff as the CLI so model/manual
// decomposition starts from schema-bound data instead of a loose prompt. When
// the browser has uploaded bytes, keep the package self-contained.
export function createAnalysisTaskPackageDownload(
  input: AnalysisTaskPackageDownloadInput,
  fileName = "analysis-task-package.zip"
): LayerDocDownloadArtifact {
  const sourcePng = sourcePngFromDataUri(input.sourceImage.dataUri);
  const task = createHomepageAnalysisTask({
    name: input.name,
    sourceImage: {
      uri: sourcePng ? "source.png" : input.sourceImage.uri,
      width: input.sourceImage.width,
      height: input.sourceImage.height
    },
    outputSchemaFile: "analysis-plan.schema.json"
  });
  const files: ZipArchiveFile[] = [
    { path: "analysis-task.json", contents: `${JSON.stringify(task, null, 2)}\n` },
    { path: "analysis-plan.schema.json", contents: `${JSON.stringify(createHomepageAnalysisPlanJsonSchema(), null, 2)}\n` }
  ];
  if (sourcePng) {
    files.push({ path: "source.png", contents: sourcePng });
  }

  return {
    fileName,
    mimeType: "application/zip",
    contents: createStoredZipArchive(files)
  };
}

export function createReactExportDownload(workspace: EditorWorkspace): LayerDocDownloadArtifact {
  return {
    fileName: workspace.reactExport.fileName,
    mimeType: "text/plain;charset=utf-8",
    contents: workspace.reactExport.code
  };
}

export function createHtmlPreviewDownload(workspace: EditorWorkspace): LayerDocDownloadArtifact {
  return {
    fileName: "preview.html",
    mimeType: "text/html;charset=utf-8",
    contents: workspace.previewHtml.endsWith("\n") ? workspace.previewHtml : `${workspace.previewHtml}\n`
  };
}

export function createProjectPackageDownload(workspace: EditorWorkspace): LayerDocDownloadArtifact {
  return {
    fileName: "project-package.json",
    mimeType: "application/json",
    contents: `${JSON.stringify(projectExportForJson(workspace.projectExport), null, 2)}\n`
  };
}

export function createProjectPackageZipDownload(workspace: EditorWorkspace): LayerDocDownloadArtifact {
  return {
    fileName: `${workspace.projectExport.manifest.packageName}.zip`,
    mimeType: "application/zip",
    contents: createStoredZipArchive(workspace.projectExport.files)
  };
}

function readProjectTextFile(projectExport: ProjectExportPackage, path: string): string {
  const file = projectExport.files.find((candidate) => candidate.path === path);
  if (!file || typeof file.contents !== "string") {
    throw new Error(`Project package does not contain a text file: ${path}.`);
  }
  return file.contents;
}

export function createBacktestRunbookDownload(workspace: EditorWorkspace): LayerDocDownloadArtifact {
  return {
    fileName: workspace.projectExport.manifest.backtestRunbook,
    mimeType: "application/json",
    contents: readProjectTextFile(workspace.projectExport, workspace.projectExport.manifest.backtestRunbook)
  };
}

export const createBacktestHandoffDownload = createBacktestRunbookDownload;

export function createVerificationReportDownload(workspace: EditorWorkspace): LayerDocDownloadArtifact {
  return {
    fileName: "verification-report.json",
    mimeType: "application/json",
    contents: `${JSON.stringify(workspace.report, null, 2)}\n`
  };
}
