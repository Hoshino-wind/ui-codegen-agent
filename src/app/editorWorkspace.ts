import { updateImageLayerAsset, updateLayerBounds, updateLayerStyle, updateTextLayer } from "../editor/operations.js";
import { moveSection } from "../editor/operations.js";
import { renderHtmlPreview } from "../exporters/htmlPreview.js";
import { createProjectExportPackage, type ProjectExportPackage } from "../exporters/projectPackage.js";
import { exportReactTailwind, type ReactTailwindExportResult } from "../exporters/reactTailwind.js";
import type { ImageAssetPatch, LayerBoundsPatch } from "../editor/operations.js";
import type { LayerDoc, LayerNode, LayerStyle } from "../layerdoc/types.js";
import { createVerificationReport, type VerificationReport } from "../verifier/report.js";
import type { PngSnapshotComparisonResult } from "../verifier/visualDiff.js";

export interface EditorWorkspace {
  doc: LayerDoc;
  selectedLayerId: string;
  previewHtml: string;
  reactExport: ReactTailwindExportResult;
  projectExport: ProjectExportPackage;
  report: VerificationReport;
}

function firstEditableLayerId(doc: LayerDoc): string {
  const layer = doc.layers.find((candidate) => candidate.editable);
  if (!layer) {
    throw new Error("LayerDoc must contain at least one editable layer for the editor workspace.");
  }
  return layer.id;
}

function selectedLayerExists(doc: LayerDoc, layerId: string): boolean {
  return doc.layers.some((layer) => layer.id === layerId);
}

function materialize(doc: LayerDoc, selectedLayerId: string): EditorWorkspace {
  const report = createVerificationReport(doc);

  return {
    doc,
    selectedLayerId,
    previewHtml: renderHtmlPreview(doc),
    reactExport: exportReactTailwind(doc, { componentName: "ProductionHomepage" }),
    projectExport: createProjectExportPackage(doc, { componentName: "ProductionHomepage", report }),
    report
  };
}

export function createEditorWorkspace(doc: LayerDoc): EditorWorkspace {
  return materialize(doc, firstEditableLayerId(doc));
}

export function selectedLayer(workspace: EditorWorkspace): LayerNode {
  const layer = workspace.doc.layers.find((candidate) => candidate.id === workspace.selectedLayerId);
  if (!layer) {
    throw new Error(`Selected layer "${workspace.selectedLayerId}" was not found.`);
  }
  return layer;
}

export function selectWorkspaceLayer(workspace: EditorWorkspace, layerId: string): EditorWorkspace {
  if (!selectedLayerExists(workspace.doc, layerId)) {
    throw new Error(`Layer "${layerId}" was not found.`);
  }
  return materialize(workspace.doc, layerId);
}

export function applyWorkspaceVisualDiff(workspace: EditorWorkspace, visualDiff: PngSnapshotComparisonResult): EditorWorkspace {
  const report = createVerificationReport(workspace.doc, { visualDiff });

  return {
    ...workspace,
    report,
    projectExport: createProjectExportPackage(workspace.doc, { componentName: "ProductionHomepage", report })
  };
}

export function updateSelectedText(workspace: EditorWorkspace, text: string): EditorWorkspace {
  const nextDoc = updateTextLayer(workspace.doc, workspace.selectedLayerId, text);
  return materialize(nextDoc, workspace.selectedLayerId);
}

export function updateSelectedLayerStyle(workspace: EditorWorkspace, style: LayerStyle): EditorWorkspace {
  const nextDoc = updateLayerStyle(workspace.doc, workspace.selectedLayerId, style);
  return materialize(nextDoc, workspace.selectedLayerId);
}

export function updateSelectedBounds(workspace: EditorWorkspace, bounds: LayerBoundsPatch): EditorWorkspace {
  const nextDoc = updateLayerBounds(workspace.doc, workspace.selectedLayerId, bounds);
  return materialize(nextDoc, workspace.selectedLayerId);
}

export function updateSelectedImageAsset(workspace: EditorWorkspace, asset: ImageAssetPatch): EditorWorkspace {
  const nextDoc = updateImageLayerAsset(workspace.doc, workspace.selectedLayerId, asset);
  return materialize(nextDoc, workspace.selectedLayerId);
}

export function moveWorkspaceSection(workspace: EditorWorkspace, sectionId: string, targetIndex: number): EditorWorkspace {
  const nextDoc = moveSection(workspace.doc, sectionId, targetIndex);
  const selected = selectedLayerExists(nextDoc, workspace.selectedLayerId) ? workspace.selectedLayerId : firstEditableLayerId(nextDoc);
  return materialize(nextDoc, selected);
}
