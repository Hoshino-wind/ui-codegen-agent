import {
  requestSectionRegeneration,
  setSectionVisibility,
  updateButtonAction,
  updateImageLayerAsset,
  updateImageLayerAlt,
  updateLayerBounds,
  updateLayerStyle,
  updateTextLayer
} from "../editor/operations.js";
import { moveSection } from "../editor/operations.js";
import { renderHtmlPreview } from "../exporters/htmlPreview.js";
import { createProjectExportPackage, type ProjectExportPackage } from "../exporters/projectPackage.js";
import { exportReactTailwind, type ReactTailwindExportResult } from "../exporters/reactTailwind.js";
import type { ImageAssetPatch, LayerBoundsPatch, SectionRegenerationRequestInput } from "../editor/operations.js";
import { createLayerDocAudit, type LayerDocAudit } from "../layerdoc/audit.js";
import type { LayerDoc, LayerNode, LayerStyle } from "../layerdoc/types.js";
import { createVerificationReport, layerDocWithVerificationReport, type VerificationReport, type VerificationVisualEvidence } from "../verifier/report.js";
import type { PngSnapshotComparisonResult } from "../verifier/visualDiff.js";

export interface EditorWorkspace {
  doc: LayerDoc;
  selectedLayerId: string;
  referencePng?: Uint8Array;
  previewHtml: string;
  reactExport: ReactTailwindExportResult;
  projectExport: ProjectExportPackage;
  report: VerificationReport;
  audit: LayerDocAudit;
}

export interface EditorWorkspaceOptions {
  referencePng?: Uint8Array;
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

function cloneReferencePng(referencePng: Uint8Array | undefined): Uint8Array | undefined {
  return referencePng ? new Uint8Array(referencePng) : undefined;
}

function materialize(
  doc: LayerDoc,
  selectedLayerId: string,
  report: VerificationReport = createVerificationReport(doc),
  options: EditorWorkspaceOptions = {}
): EditorWorkspace {
  const verifiedDoc = layerDocWithVerificationReport(doc, report);
  const audit = createLayerDocAudit(verifiedDoc);
  const referencePng = cloneReferencePng(options.referencePng);

  return {
    doc: verifiedDoc,
    selectedLayerId,
    referencePng,
    previewHtml: renderHtmlPreview(verifiedDoc),
    reactExport: exportReactTailwind(verifiedDoc, { componentName: "ProductionHomepage" }),
    projectExport: createProjectExportPackage(verifiedDoc, { componentName: "ProductionHomepage", report, referencePng }),
    report,
    audit
  };
}

export function createEditorWorkspace(doc: LayerDoc, options: EditorWorkspaceOptions = {}): EditorWorkspace {
  return materialize(doc, firstEditableLayerId(doc), createVerificationReport(doc), options);
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
  return materialize(workspace.doc, layerId, createVerificationReport(workspace.doc), workspace);
}

export function applyWorkspaceVisualDiff(
  workspace: EditorWorkspace,
  visualDiff: PngSnapshotComparisonResult,
  visualEvidence?: VerificationVisualEvidence
): EditorWorkspace {
  const report = createVerificationReport(workspace.doc, { visualDiff, visualEvidence });
  return materialize(workspace.doc, workspace.selectedLayerId, report, workspace);
}

export function updateSelectedText(workspace: EditorWorkspace, text: string): EditorWorkspace {
  const nextDoc = updateTextLayer(workspace.doc, workspace.selectedLayerId, text);
  return materialize(nextDoc, workspace.selectedLayerId, createVerificationReport(nextDoc), workspace);
}

export function updateSelectedButtonAction(workspace: EditorWorkspace, action: string): EditorWorkspace {
  const nextDoc = updateButtonAction(workspace.doc, workspace.selectedLayerId, action);
  return materialize(nextDoc, workspace.selectedLayerId, createVerificationReport(nextDoc), workspace);
}

export function updateSelectedLayerStyle(workspace: EditorWorkspace, style: LayerStyle): EditorWorkspace {
  const nextDoc = updateLayerStyle(workspace.doc, workspace.selectedLayerId, style);
  return materialize(nextDoc, workspace.selectedLayerId, createVerificationReport(nextDoc), workspace);
}

export function updateSelectedBounds(workspace: EditorWorkspace, bounds: LayerBoundsPatch): EditorWorkspace {
  const nextDoc = updateLayerBounds(workspace.doc, workspace.selectedLayerId, bounds);
  return materialize(nextDoc, workspace.selectedLayerId, createVerificationReport(nextDoc), workspace);
}

export function updateSelectedImageAsset(workspace: EditorWorkspace, asset: ImageAssetPatch): EditorWorkspace {
  const nextDoc = updateImageLayerAsset(workspace.doc, workspace.selectedLayerId, asset);
  return materialize(nextDoc, workspace.selectedLayerId, createVerificationReport(nextDoc), workspace);
}

export function updateSelectedImageAlt(workspace: EditorWorkspace, alt: string): EditorWorkspace {
  const nextDoc = updateImageLayerAlt(workspace.doc, workspace.selectedLayerId, alt);
  return materialize(nextDoc, workspace.selectedLayerId, createVerificationReport(nextDoc), workspace);
}

export function moveWorkspaceSection(workspace: EditorWorkspace, sectionId: string, targetIndex: number): EditorWorkspace {
  const nextDoc = moveSection(workspace.doc, sectionId, targetIndex);
  const selected = selectedLayerExists(nextDoc, workspace.selectedLayerId) ? workspace.selectedLayerId : firstEditableLayerId(nextDoc);
  return materialize(nextDoc, selected, createVerificationReport(nextDoc), workspace);
}

export function updateWorkspaceSectionVisibility(workspace: EditorWorkspace, sectionId: string, visible: boolean): EditorWorkspace {
  const nextDoc = setSectionVisibility(workspace.doc, sectionId, visible);
  const selected = selectedLayerExists(nextDoc, workspace.selectedLayerId) ? workspace.selectedLayerId : firstEditableLayerId(nextDoc);
  return materialize(nextDoc, selected, createVerificationReport(nextDoc), workspace);
}

export function requestWorkspaceSectionRegeneration(
  workspace: EditorWorkspace,
  sectionId: string,
  prompt: string,
  options: Pick<SectionRegenerationRequestInput, "requestedAt"> = {}
): EditorWorkspace {
  const nextDoc = requestSectionRegeneration(workspace.doc, sectionId, { prompt, requestedAt: options.requestedAt });
  const selected = selectedLayerExists(nextDoc, workspace.selectedLayerId) ? workspace.selectedLayerId : firstEditableLayerId(nextDoc);
  return materialize(nextDoc, selected, createVerificationReport(nextDoc), workspace);
}
