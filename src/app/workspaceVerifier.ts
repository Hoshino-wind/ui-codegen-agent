import { applyWorkspaceVisualDiff, type EditorWorkspace } from "./editorWorkspace.js";
import {
  compareImageDataSnapshots,
  type ImageDataSnapshot,
  type ImageDataSnapshotComparisonInput
} from "../verifier/imageDataDiff.js";
import { verificationVisualEvidence, type VerificationVisualEvidence } from "../verifier/report.js";

export interface WorkspaceVisualVerificationInput {
  reference: ImageDataSnapshot;
  candidate: ImageDataSnapshot;
  threshold?: ImageDataSnapshotComparisonInput["threshold"];
  includeAA?: ImageDataSnapshotComparisonInput["includeAA"];
  visualEvidence?: VerificationVisualEvidence;
}

export interface WorkspaceCandidateSnapshotInput {
  doc: EditorWorkspace["doc"];
  previewHtml: string;
  canvas: EditorWorkspace["doc"]["canvas"];
}

export type WorkspaceCandidateSnapshotRenderer = (input: WorkspaceCandidateSnapshotInput) => Promise<ImageDataSnapshot> | ImageDataSnapshot;

export interface WorkspacePreviewVerificationInput {
  reference: ImageDataSnapshot;
  renderCandidate: WorkspaceCandidateSnapshotRenderer;
  threshold?: ImageDataSnapshotComparisonInput["threshold"];
  includeAA?: ImageDataSnapshotComparisonInput["includeAA"];
  visualEvidence?: VerificationVisualEvidence;
}

export function runWorkspaceVisualVerification(workspace: EditorWorkspace, input: WorkspaceVisualVerificationInput): EditorWorkspace {
  const comparison = compareImageDataSnapshots({
    reference: input.reference,
    candidate: input.candidate,
    threshold: input.threshold,
    includeAA: input.includeAA
  });

  return applyWorkspaceVisualDiff(workspace, {
    visualSimilarity: comparison.visualSimilarity,
    mismatchedPixels: comparison.mismatchedPixels,
    comparedPixels: comparison.comparedPixels,
    dimensions: comparison.dimensions,
    mismatchBounds: comparison.mismatchBounds,
    problemAreas: comparison.problemAreas,
    diffPath: null,
    threshold: comparison.threshold
  }, input.visualEvidence ?? verificationVisualEvidence.imageData);
}

export async function runWorkspacePreviewVerification(workspace: EditorWorkspace, input: WorkspacePreviewVerificationInput): Promise<EditorWorkspace> {
  const candidate = await input.renderCandidate({
    doc: workspace.doc,
    previewHtml: workspace.previewHtml,
    canvas: workspace.doc.canvas
  });

  return runWorkspaceVisualVerification(workspace, {
    reference: input.reference,
    candidate,
    threshold: input.threshold,
    includeAA: input.includeAA,
    visualEvidence: input.visualEvidence ?? verificationVisualEvidence.layerDocRaster
  });
}
