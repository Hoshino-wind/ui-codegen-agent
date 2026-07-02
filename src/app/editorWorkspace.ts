import {
  applySectionRegenerationCandidate,
  requestSectionRegeneration,
  revertSectionRegenerationApplication,
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
import type {
  ImageAssetPatch,
  LayerBoundsPatch,
  SectionRegenerationCandidateInput,
  SectionRegenerationRevertOptions,
  SectionRegenerationRequestInput
} from "../editor/operations.js";
import { createLayerDocAudit, type LayerDocAudit } from "../layerdoc/audit.js";
import type { LayerDoc, LayerNode, LayerStyle } from "../layerdoc/types.js";
import { createVerificationReport, layerDocWithVerificationReport, type VerificationReport, type VerificationVisualEvidence } from "../verifier/report.js";
import type { PngSnapshotComparisonResult } from "../verifier/visualDiff.js";

export interface EditorWorkspaceHistoryEntry {
  id: string;
  operation: string;
  label: string;
  selectedLayerIdBefore: string;
  selectedLayerIdAfter: string;
  before: LayerDoc;
  after: LayerDoc;
}

export interface EditorWorkspaceHistory {
  past: EditorWorkspaceHistoryEntry[];
  future: EditorWorkspaceHistoryEntry[];
}

export interface EditorWorkspace {
  doc: LayerDoc;
  selectedLayerId: string;
  referencePng?: Uint8Array;
  previewHtml: string;
  reactExport: ReactTailwindExportResult;
  projectExport: ProjectExportPackage;
  report: VerificationReport;
  audit: LayerDocAudit;
  history: EditorWorkspaceHistory;
}

export interface EditorWorkspaceOptions {
  referencePng?: Uint8Array;
  history?: EditorWorkspaceHistory;
}

function firstEditableLayerId(doc: LayerDoc): string {
  const layer = doc.layers.find((candidate) => candidate.editable);
  if (!layer) {
    throw new Error("LayerDoc must contain at least one editable layer for the editor workspace.");
  }
  return layer.id;
}

function firstEditableCandidateLayerId(candidate: SectionRegenerationCandidateInput): string | null {
  return candidate.layers.find((layer) => layer.editable)?.id ?? null;
}

function firstEditableSectionLayerId(doc: LayerDoc, sectionId: string): string | null {
  const section = doc.sections.find((candidate) => candidate.id === sectionId);
  if (!section) {
    return null;
  }

  const layerIds = new Set(section.layerIds);
  return doc.layers.find((layer) => layerIds.has(layer.id) && layer.editable)?.id ?? null;
}

function selectedLayerExists(doc: LayerDoc, layerId: string): boolean {
  return doc.layers.some((layer) => layer.id === layerId);
}

function cloneReferencePng(referencePng: Uint8Array | undefined): Uint8Array | undefined {
  return referencePng ? new Uint8Array(referencePng) : undefined;
}

function emptyHistory(): EditorWorkspaceHistory {
  return { past: [], future: [] };
}

function cloneHistory(history: EditorWorkspaceHistory | undefined): EditorWorkspaceHistory {
  return history ? { past: [...history.past], future: [...history.future] } : emptyHistory();
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
    audit,
    history: cloneHistory(options.history)
  };
}

function nextHistoryEntryId(history: EditorWorkspaceHistory): string {
  return `edit-${history.past.length + history.future.length + 1}`;
}

function materializeEdit(
  workspace: EditorWorkspace,
  nextDoc: LayerDoc,
  selectedLayerId: string,
  operation: string,
  label: string
): EditorWorkspace {
  const nextWorkspace = materialize(nextDoc, selectedLayerId, createVerificationReport(nextDoc), workspace);
  const entry: EditorWorkspaceHistoryEntry = {
    id: nextHistoryEntryId(workspace.history),
    operation,
    label,
    selectedLayerIdBefore: workspace.selectedLayerId,
    selectedLayerIdAfter: selectedLayerId,
    before: workspace.doc,
    after: nextWorkspace.doc
  };

  return {
    ...nextWorkspace,
    history: {
      past: [...workspace.history.past, entry],
      future: []
    }
  };
}

export function createEditorWorkspace(doc: LayerDoc, options: EditorWorkspaceOptions = {}): EditorWorkspace {
  return materialize(doc, firstEditableLayerId(doc), createVerificationReport(doc), { ...options, history: options.history ?? emptyHistory() });
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
  return materializeEdit(workspace, nextDoc, workspace.selectedLayerId, "update-text", `Update ${workspace.selectedLayerId} text`);
}

export function updateSelectedButtonAction(workspace: EditorWorkspace, action: string): EditorWorkspace {
  const nextDoc = updateButtonAction(workspace.doc, workspace.selectedLayerId, action);
  return materializeEdit(workspace, nextDoc, workspace.selectedLayerId, "update-button-action", `Update ${workspace.selectedLayerId} action`);
}

export function updateSelectedLayerStyle(workspace: EditorWorkspace, style: LayerStyle): EditorWorkspace {
  const nextDoc = updateLayerStyle(workspace.doc, workspace.selectedLayerId, style);
  return materializeEdit(workspace, nextDoc, workspace.selectedLayerId, "update-layer-style", `Update ${workspace.selectedLayerId} style`);
}

export function updateSelectedBounds(workspace: EditorWorkspace, bounds: LayerBoundsPatch): EditorWorkspace {
  const nextDoc = updateLayerBounds(workspace.doc, workspace.selectedLayerId, bounds);
  return materializeEdit(workspace, nextDoc, workspace.selectedLayerId, "update-layer-bounds", `Update ${workspace.selectedLayerId} bounds`);
}

export function updateSelectedImageAsset(workspace: EditorWorkspace, asset: ImageAssetPatch): EditorWorkspace {
  const nextDoc = updateImageLayerAsset(workspace.doc, workspace.selectedLayerId, asset);
  return materializeEdit(workspace, nextDoc, workspace.selectedLayerId, "update-image-asset", `Update ${workspace.selectedLayerId} asset`);
}

export function updateSelectedImageAlt(workspace: EditorWorkspace, alt: string): EditorWorkspace {
  const nextDoc = updateImageLayerAlt(workspace.doc, workspace.selectedLayerId, alt);
  return materializeEdit(workspace, nextDoc, workspace.selectedLayerId, "update-image-alt", `Update ${workspace.selectedLayerId} alt text`);
}

export function moveWorkspaceSection(workspace: EditorWorkspace, sectionId: string, targetIndex: number): EditorWorkspace {
  const nextDoc = moveSection(workspace.doc, sectionId, targetIndex);
  const selected = selectedLayerExists(nextDoc, workspace.selectedLayerId) ? workspace.selectedLayerId : firstEditableLayerId(nextDoc);
  return materializeEdit(workspace, nextDoc, selected, "move-section", `Move ${sectionId} section`);
}

export function updateWorkspaceSectionVisibility(workspace: EditorWorkspace, sectionId: string, visible: boolean): EditorWorkspace {
  const nextDoc = setSectionVisibility(workspace.doc, sectionId, visible);
  const selected = selectedLayerExists(nextDoc, workspace.selectedLayerId) ? workspace.selectedLayerId : firstEditableLayerId(nextDoc);
  return materializeEdit(workspace, nextDoc, selected, "set-section-visibility", `${visible ? "Show" : "Hide"} ${sectionId} section`);
}

export function requestWorkspaceSectionRegeneration(
  workspace: EditorWorkspace,
  sectionId: string,
  prompt: string,
  options: Pick<SectionRegenerationRequestInput, "requestedAt"> = {}
): EditorWorkspace {
  const nextDoc = requestSectionRegeneration(workspace.doc, sectionId, { prompt, requestedAt: options.requestedAt });
  const selected = selectedLayerExists(nextDoc, workspace.selectedLayerId) ? workspace.selectedLayerId : firstEditableLayerId(nextDoc);
  return materializeEdit(workspace, nextDoc, selected, "request-section-regeneration", `Request ${sectionId} regeneration`);
}

export function applyWorkspaceSectionRegenerationCandidate(
  workspace: EditorWorkspace,
  sectionId: string,
  candidate: SectionRegenerationCandidateInput
): EditorWorkspace {
  const nextDoc = applySectionRegenerationCandidate(workspace.doc, sectionId, candidate);
  const selected = selectedLayerExists(nextDoc, workspace.selectedLayerId)
    ? workspace.selectedLayerId
    : (firstEditableCandidateLayerId(candidate) ?? firstEditableLayerId(nextDoc));
  return materializeEdit(workspace, nextDoc, selected, "apply-section-regeneration", `Apply ${sectionId} regeneration`);
}

export function revertWorkspaceSectionRegenerationApplication(
  workspace: EditorWorkspace,
  applicationId: string,
  options: SectionRegenerationRevertOptions = {}
): EditorWorkspace {
  const nextDoc = revertSectionRegenerationApplication(workspace.doc, applicationId, options);
  const application = nextDoc.generation.sectionApplications.find((candidate) => candidate.id === applicationId);
  const selected = selectedLayerExists(nextDoc, workspace.selectedLayerId)
    ? workspace.selectedLayerId
    : (application ? firstEditableSectionLayerId(nextDoc, application.sectionId) : null) ?? firstEditableLayerId(nextDoc);
  return materializeEdit(workspace, nextDoc, selected, "revert-section-regeneration", `Revert ${applicationId}`);
}

export function undoWorkspace(workspace: EditorWorkspace): EditorWorkspace {
  const entry = workspace.history.past.at(-1);
  if (!entry) {
    return workspace;
  }

  const past = workspace.history.past.slice(0, -1);
  return materialize(entry.before, entry.selectedLayerIdBefore, createVerificationReport(entry.before), {
    ...workspace,
    history: {
      past,
      future: [entry, ...workspace.history.future]
    }
  });
}

export function redoWorkspace(workspace: EditorWorkspace): EditorWorkspace {
  const [entry, ...future] = workspace.history.future;
  if (!entry) {
    return workspace;
  }

  return materialize(entry.after, entry.selectedLayerIdAfter, createVerificationReport(entry.after), {
    ...workspace,
    history: {
      past: [...workspace.history.past, entry],
      future
    }
  });
}
