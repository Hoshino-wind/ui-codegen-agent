import { validateLayerDoc } from "../layerdoc/validation.js";
import type { LayerDoc } from "../layerdoc/types.js";
import { createEditorWorkspace, type EditorWorkspace } from "./editorWorkspace.js";

export interface LayerDocDownloadArtifact {
  fileName: string;
  mimeType: "application/json" | "text/plain;charset=utf-8";
  contents: string;
}

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

  const validation = validateLayerDoc(parsed);
  if (!validation.valid) {
    const messages = validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join(" ");
    throw new Error(`LayerDoc validation failed: ${messages}`);
  }

  return parsed;
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

export function createReactExportDownload(workspace: EditorWorkspace): LayerDocDownloadArtifact {
  return {
    fileName: workspace.reactExport.fileName,
    mimeType: "text/plain;charset=utf-8",
    contents: workspace.reactExport.code
  };
}

export function createVerificationReportDownload(workspace: EditorWorkspace): LayerDocDownloadArtifact {
  return {
    fileName: "verification-report.json",
    mimeType: "application/json",
    contents: `${JSON.stringify(workspace.report, null, 2)}\n`
  };
}
