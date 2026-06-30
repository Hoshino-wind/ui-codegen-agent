export {
  moveSection,
  requestSectionRegeneration,
  setSectionVisibility,
  updateButtonAction,
  updateImageLayerAsset,
  updateLayerBounds,
  updateLayerStyle,
  updateTextLayer
} from "./editor/operations.js";
export { renderHtmlPreview } from "./exporters/htmlPreview.js";
export {
  createProjectExportPackage
} from "./exporters/projectPackage.js";
export { writeProjectExportPackage } from "./exporters/projectPackageWriter.js";
export { exportReactTailwind } from "./exporters/reactTailwind.js";
export { createStoredZipArchive } from "./exporters/zipArchive.js";
export {
  addAnalysisLayer,
  createHomepageAnalysisPlan,
  toPngIntakeSections,
  updateAnalysisLayer,
  validateHomepageAnalysisPlan
} from "./importers/homepageAnalysisPlan.js";
export { createHomepageLayerDocFromPng } from "./importers/homepagePngPipeline.js";
export { addHeroAnnotationSetToPlan, seedHomepageAnalysisPlan } from "./importers/homepageSeed.js";
export { createLayerDocFromImageManifest } from "./importers/imageManifest.js";
export { createImageManifestFromPng } from "./importers/pngIntake.js";
export { createForeignObjectSnapshotSvg, inlineHtmlImageSources, renderHtmlPreviewSnapshot } from "./app/htmlPreviewSnapshot.js";
export { createImageAssetPatchFromFile, readBrowserFileAsDataUrl } from "./app/imageAssetUpload.js";
export { renderLayerDocSnapshot } from "./app/layerDocSnapshot.js";
export { createProblemAreaAnnotations } from "./app/problemAreaOverlay.js";
export { runWorkspacePreviewVerification, runWorkspaceVisualVerification } from "./app/workspaceVerifier.js";
export { classifyLayer } from "./layerdoc/classification.js";
export { createLayerDocAudit } from "./layerdoc/audit.js";
export { createLayerDoc } from "./layerdoc/factory.js";
export { createLayerDocJsonSchema } from "./layerdoc/jsonSchema.js";
export { scoreProjectFit } from "./layerdoc/scoring.js";
export { validateLayerDoc } from "./layerdoc/validation.js";
export { createVerificationReport, verificationVisualEvidence } from "./verifier/report.js";
export { defaultVerificationGates, evaluateVerificationGates } from "./verifier/gates.js";
export { compareImageDataSnapshots } from "./verifier/imageDataDiff.js";
export { runLayerDocPreviewVerification } from "./verifier/previewRun.js";
export { runLayerDocVerification } from "./verifier/run.js";
export { comparePngSnapshots } from "./verifier/visualDiff.js";
export type {
  LayerDocAssetCompliance,
  LayerDocAudit,
  LayerDocAuditSummary,
  LayerDocRiskyAsset,
  LayerDocSectionAudit,
  LayerDocStructureAudit,
  LayerDocTrackCounts
} from "./layerdoc/audit.js";
export type {
  AssetNode,
  Canvas,
  ComponentNode,
  CreateLayerDocInput,
  InteractionNode,
  LayerDoc,
  LayerKind,
  LayerNode,
  LayerSpacing,
  LayerStyle,
  LayerTrack,
  ProjectFitScore,
  Rect,
  ResponsiveRule,
  GenerationState,
  SectionRegenerationRequest,
  SectionNode,
  TokenSet,
  ValidationResult,
  VerificationIssue,
  VerificationIssueCode,
  VerificationScores
} from "./layerdoc/types.js";
export type { ImageAssetPatch, LayerBoundsPatch, SectionRegenerationRequestInput } from "./editor/operations.js";
export type {
  VerificationEvidence,
  VerificationInput,
  VerificationReport,
  VerificationVisualEvidence,
  VerificationVisualEvidenceKind
} from "./verifier/report.js";
export type {
  ImageDataSnapshot,
  ImageDataSnapshotComparisonInput,
  ImageDataSnapshotComparisonResult
} from "./verifier/imageDataDiff.js";
export type {
  LayerDocPreviewVerificationRun,
  PreviewSnapshotRenderer,
  PreviewSnapshotRenderInput,
  PreviewViewport,
  RunLayerDocPreviewVerificationInput
} from "./verifier/previewRun.js";
export type { VerificationGateResult, VerificationGates } from "./verifier/gates.js";
export type { LayerDocVerificationRun, RunLayerDocVerificationInput } from "./verifier/run.js";
export type { PngSnapshotComparisonInput, PngSnapshotComparisonResult } from "./verifier/visualDiff.js";
export type {
  HtmlImageSourceInliner,
  HtmlPreviewSnapshotDependencies,
  HtmlPreviewSnapshotInput
} from "./app/htmlPreviewSnapshot.js";
export type { ImageAssetUploadDependencies, ImageReplacementFileLike } from "./app/imageAssetUpload.js";
export type { ProblemAreaAnnotation, ProblemAreaAnnotationOptions } from "./app/problemAreaOverlay.js";
export type {
  WorkspaceCandidateSnapshotInput,
  WorkspaceCandidateSnapshotRenderer,
  WorkspacePreviewVerificationInput,
  WorkspaceVisualVerificationInput
} from "./app/workspaceVerifier.js";
export type {
  ProjectExportFile,
  ProjectIntegrationContract,
  ProjectExportManifest,
  ProjectExportPackage,
  ProjectExportPackageOptions
} from "./exporters/projectPackage.js";
export type { ZipArchiveFile } from "./exporters/zipArchive.js";
export type {
  WrittenProjectExportFile,
  WrittenProjectExportPackage
} from "./exporters/projectPackageWriter.js";
export type { ReactTailwindExportOptions, ReactTailwindExportResult } from "./exporters/reactTailwind.js";
export type {
  AnalysisLayerPatch,
  CreateHomepageAnalysisPlanInput,
  HomepageAnalysisPlan
} from "./importers/homepageAnalysisPlan.js";
export type {
  HomepagePngPipelineInput,
  HomepagePngPipelineResult
} from "./importers/homepagePngPipeline.js";
export type {
  ImageAnalysisManifest,
  ImageManifestAssetInput,
  ImageManifestImportOptions,
  ImageManifestLayerInput,
  ImageManifestSectionInput
} from "./importers/imageManifest.js";
export type {
  PngIntakeAssetPlan,
  PngIntakeInput,
  PngIntakeLayerPlan,
  PngIntakeSectionPlan
} from "./importers/pngIntake.js";
