import {
  CheckCircle2,
  Code2,
  Download,
  Eye,
  EyeOff,
  FileImage,
  FlaskConical,
  Layers3,
  Monitor,
  MousePointer2,
  PanelRight,
  Play,
  RefreshCw,
  Smartphone,
  SquareDashedMousePointer,
  Type,
  Upload,
  WandSparkles
} from "lucide-react";
import { useMemo, useState } from "react";

import type { LayerNode, LayerStyle, SectionNode } from "../layerdoc/types.js";
import {
  createEditorWorkspace,
  moveWorkspaceSection,
  requestWorkspaceSectionRegeneration,
  selectWorkspaceLayer,
  selectedLayer,
  updateSelectedButtonAction,
  updateSelectedBounds,
  updateSelectedImageAlt,
  updateSelectedImageAsset,
  updateSelectedLayerStyle,
  updateSelectedText,
  updateWorkspaceSectionVisibility,
  type EditorWorkspace
} from "./editorWorkspace.js";
import { createIntakeWorkspaceFromBrowserFile, cropBrowserReferenceAsset } from "./imageFileIntake.js";
import {
  addHeroAnnotationSet,
  addManualAnalysisLayer,
  buildWorkspaceFromIntake,
  createIntakeWorkspace,
  createIntakeWorkspaceFromAnalysisPlanJson,
  materializeReferenceCropAssets,
  selectIntakeLayer,
  selectIntakeSection,
  seedHomepageAnnotations,
  updateManualAnalysisLayer,
  type IntakeWorkspace,
  type ManualAnalysisLayerKind
} from "./intakeWorkspace.js";
import {
  createAnalysisPlanDownload,
  createLayerDocDownload,
  createProjectPackageDownload,
  createProjectPackageZipDownload,
  createReactExportDownload,
  createVerificationReportDownload,
  createWorkspaceFromLayerDocJson,
  type LayerDocDownloadArtifact
} from "./layerDocFile.js";
import { triggerBrowserDownload } from "./browserDownload.js";
import { createImageAssetPatchFromFile, readBrowserFileAsDataUrl } from "./imageAssetUpload.js";
import { renderHtmlPreviewSnapshot } from "./htmlPreviewSnapshot.js";
import { renderLayerDocSnapshot } from "./layerDocSnapshot.js";
import { createPreviewViewport, type PreviewMode } from "./previewViewport.js";
import { createProblemAreaAnnotations } from "./problemAreaOverlay.js";
import { createSampleHomepageLayerDoc } from "./sampleDocument.js";
import { runWorkspacePreviewVerification } from "./workspaceVerifier.js";
import { createWorkflowSummary, type WorkflowSummaryItem } from "./workflowSummary.js";
import type { PngIntakeLayerPlan } from "../importers/pngIntake.js";
import { evaluateVerificationGates } from "../verifier/gates.js";
import type { ImageDataSnapshot } from "../verifier/imageDataDiff.js";
import { verificationVisualEvidence } from "../verifier/report.js";

const workflowIcons = {
  Image: FileImage,
  LayerDoc: Layers3,
  Editor: SquareDashedMousePointer,
  Preview: Eye,
  Export: Code2,
  Verifier: CheckCircle2
};

type PreviewSurface = "canvas" | "html";

function formatScore(value: number | null): string {
  return value === null ? "n/a" : String(value);
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function styleValue(style: LayerStyle | undefined, key: keyof LayerStyle, fallback = ""): string {
  const value = style?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function paddingValue(style: LayerStyle | undefined, axis: "x" | "y"): string {
  const padding = style?.padding;
  if (!padding) {
    return "0";
  }

  const value = axis === "x" ? (padding.x ?? padding.left ?? padding.right) : (padding.y ?? padding.top ?? padding.bottom);
  return typeof value === "number" ? String(value) : "0";
}

function selectedSection(doc: EditorWorkspace["doc"], layer: LayerNode): SectionNode | undefined {
  return doc.sections.find((section) => section.id === layer.sectionId);
}

function buttonActionForLayer(doc: EditorWorkspace["doc"], layer: LayerNode): string {
  if (layer.kind !== "button") {
    return "";
  }

  return doc.interactions.find((interaction) => interaction.layerId === layer.id && interaction.event === "click")?.action ?? "";
}

function numberFromInput(value: string): number {
  return Number.parseInt(value, 10);
}

function numberFromDecimalInput(value: string): number {
  return Number.parseFloat(value);
}

function layerKindLabel(layer: LayerNode): string {
  return `${layer.kind} / ${layer.track}`;
}

function selectedAnalysisSection(intake: IntakeWorkspace) {
  return intake.analysisPlan.sections.find((section) => section.id === intake.selectedSectionId);
}

function selectedAnalysisLayer(intake: IntakeWorkspace): PngIntakeLayerPlan | null {
  if (!intake.selectedLayerId) {
    return null;
  }

  return intake.analysisPlan.sections.flatMap((section) => section.layers).find((layer) => layer.id === intake.selectedLayerId) ?? null;
}

interface VerifierSnapshot {
  fileName: string;
  image: ImageDataSnapshot;
}

async function readBrowserImageSnapshot(file: File): Promise<ImageDataSnapshot> {
  const bitmap = await createImageBitmap(file);

  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Browser canvas is unavailable.");
    }

    context.drawImage(bitmap, 0, 0);
    const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height);
    return {
      width: imageData.width,
      height: imageData.height,
      data: imageData.data
    };
  } finally {
    bitmap.close();
  }
}

async function createVerifierSnapshot(file: File): Promise<VerifierSnapshot> {
  if (file.type !== "image/png" && !file.name.toLowerCase().endsWith(".png")) {
    throw new Error("Verifier snapshots must be PNG files.");
  }

  return {
    fileName: file.name,
    image: await readBrowserImageSnapshot(file)
  };
}

function planLayerContent(layer: PngIntakeLayerPlan): string {
  return layer.kind === "image" ? (layer.alt ?? "") : (layer.text ?? "");
}

function WorkspaceStep({ index, item }: { index: number; item: WorkflowSummaryItem }) {
  const Icon = workflowIcons[item.label];
  return (
    <div className={`workflow-step ${item.active ? "active" : ""}`}>
      <div className="workflow-index">{index + 1}</div>
      <div className="workflow-icon">
        <Icon size={18} />
      </div>
      <div>
        <div className="workflow-label">{item.label}</div>
        <div className="workflow-detail">{item.detail}</div>
      </div>
      {item.done ? <CheckCircle2 className="workflow-check" size={16} /> : <span className="workflow-dot" />}
    </div>
  );
}

function CanvasLayer({
  layer,
  assetUri,
  isSelected,
  scale,
  showLabels,
  onSelect
}: {
  layer: LayerNode;
  assetUri?: string;
  isSelected: boolean;
  scale: number;
  showLabels: boolean;
  onSelect: () => void;
}) {
  const style = {
    left: layer.bounds.x * scale,
    top: layer.bounds.y * scale,
    width: layer.bounds.width * scale,
    height: layer.bounds.height * scale,
    backgroundColor: layer.style?.backgroundColor,
    color: layer.style?.textColor,
    borderColor: layer.style?.borderColor,
    borderStyle: layer.style?.borderColor ? "solid" : undefined,
    borderWidth: layer.style?.borderColor ? 1 : undefined,
    fontFamily: layer.style?.fontFamily,
    fontSize: layer.style?.fontSize ? layer.style.fontSize * scale : undefined,
    fontWeight: layer.style?.fontWeight,
    lineHeight: layer.style?.lineHeight !== undefined ? `${layer.style.lineHeight * scale}px` : undefined,
    letterSpacing: layer.style?.letterSpacing !== undefined ? `${layer.style.letterSpacing * scale}px` : undefined,
    borderRadius: layer.style?.borderRadius ? layer.style.borderRadius * scale : undefined,
    opacity: layer.style?.opacity
  };

  return (
    <button
      className={`canvas-layer ${layer.track} ${layer.kind} ${isSelected ? "selected" : ""}`}
      style={style}
      type="button"
      onClick={onSelect}
      aria-label={`Select ${layer.id}`}
    >
      {showLabels ? <span className="layer-badge">{layer.id}</span> : null}
      {layer.kind === "image" ? (
        <img src={assetUri} alt={layer.content?.alt ?? ""} />
      ) : (
        <span className="layer-text">{layer.content?.text ?? layer.kind}</span>
      )}
    </button>
  );
}

function CanvasPreview({
  previewMode,
  previewSurface,
  workspace,
  showLabels,
  onPreviewModeChange,
  onPreviewSurfaceChange,
  onSelectLayer
}: {
  previewMode: PreviewMode;
  previewSurface: PreviewSurface;
  workspace: EditorWorkspace;
  showLabels: boolean;
  onPreviewModeChange: (mode: PreviewMode) => void;
  onPreviewSurfaceChange: (surface: PreviewSurface) => void;
  onSelectLayer: (layerId: string) => void;
}) {
  const assetById = useMemo(() => new Map(workspace.doc.assets.map((asset) => [asset.id, asset])), [workspace.doc.assets]);
  const viewport = createPreviewViewport({ mode: previewMode, canvas: workspace.doc.canvas });
  const visibleSectionIds = useMemo(
    () => new Set(workspace.doc.sections.filter((section) => section.visible !== false).map((section) => section.id)),
    [workspace.doc.sections]
  );
  const visibleLayers = workspace.doc.layers.filter((layer) => !layer.sectionId || visibleSectionIds.has(layer.sectionId));
  const problemAreas = createProblemAreaAnnotations(workspace.report.visualDiff?.problemAreas ?? [], { scale: viewport.scale });

  return (
    <section className="canvas-panel">
      <div className="panel-heading">
        <div>
          <h2>{previewSurface === "html" ? "HTML Preview" : "Canvas Preview"}</h2>
          <p>
            {previewSurface === "html"
              ? "Generated HTML renders the same LayerDoc source used by export and verifier."
              : "LayerDoc renders real editable objects, not a flattened screenshot."}
          </p>
        </div>
        <div className="canvas-toolbar" aria-label="Canvas toolbar">
          <div className="preview-surface-tabs" aria-label="Preview surface">
            <button
              className={previewSurface === "canvas" ? "active" : ""}
              type="button"
              aria-pressed={previewSurface === "canvas"}
              onClick={() => onPreviewSurfaceChange("canvas")}
            >
              Canvas
            </button>
            <button
              className={previewSurface === "html" ? "active" : ""}
              type="button"
              aria-pressed={previewSurface === "html"}
              onClick={() => onPreviewSurfaceChange("html")}
            >
              HTML Preview
            </button>
          </div>
          <button
            className={`tool ${previewSurface === "canvas" ? "active" : ""}`}
            type="button"
            aria-label="Select"
            onClick={() => onPreviewSurfaceChange("canvas")}
          >
            <MousePointer2 size={16} />
          </button>
          <button
            className={`tool ${previewMode === "desktop" ? "active" : ""}`}
            type="button"
            aria-label="Desktop preview"
            aria-pressed={previewMode === "desktop"}
            onClick={() => onPreviewModeChange("desktop")}
          >
            <Monitor size={16} />
          </button>
          <button
            className={`tool ${previewMode === "mobile" ? "active" : ""}`}
            type="button"
            aria-label="Mobile preview"
            aria-pressed={previewMode === "mobile"}
            onClick={() => onPreviewModeChange("mobile")}
          >
            <Smartphone size={16} />
          </button>
          <span className="zoom-chip">{previewMode} / {Math.round(viewport.scale * 100)}%</span>
        </div>
      </div>

      <div className="canvas-rulers" style={{ width: viewport.display.width }}>
        {viewport.rulerTicks.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
      <div
        className={`layerdoc-canvas ${previewMode} ${previewSurface === "html" ? "html-preview-surface" : ""}`}
        style={{
          width: viewport.display.width,
          height: viewport.display.height,
          background: workspace.doc.canvas.background ?? "#ffffff"
        }}
      >
        {previewSurface === "html" ? (
          <iframe
            className="html-preview-frame"
            title="Generated HTML Preview"
            sandbox=""
            srcDoc={workspace.previewHtml}
            style={{
              width: workspace.doc.canvas.width,
              height: workspace.doc.canvas.height,
              transform: `scale(${viewport.scale})`
            }}
          />
        ) : (
          <>
            {workspace.doc.sections
              .filter((section) => section.visible !== false)
              .map((section) => (
                <div
                  className="canvas-section"
                  key={section.id}
                  style={{
                    left: section.bounds.x * viewport.scale,
                    top: section.bounds.y * viewport.scale,
                    width: section.bounds.width * viewport.scale,
                    height: section.bounds.height * viewport.scale
                  }}
                >
                  {showLabels ? <span className="section-badge">{section.name}</span> : null}
                </div>
              ))}
            {visibleLayers.map((layer) => (
              <CanvasLayer
                key={layer.id}
                layer={layer}
                assetUri={assetById.get(layer.assetId ?? "")?.uri}
                isSelected={workspace.selectedLayerId === layer.id}
                scale={viewport.scale}
                showLabels={showLabels}
                onSelect={() => onSelectLayer(layer.id)}
              />
            ))}
          </>
        )}
        {problemAreas.map((area) => (
          <div
            aria-label={`Verifier problem area ${area.label}`}
            className="problem-area-overlay"
            key={area.id}
            style={{
              left: area.bounds.x,
              top: area.bounds.y,
              width: area.bounds.width,
              height: area.bounds.height
            }}
          >
            <span>{area.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Inspector({
  workspace,
  onChange
}: {
  workspace: EditorWorkspace;
  onChange: (workspace: EditorWorkspace) => void;
}) {
  const [assetUploadError, setAssetUploadError] = useState<string | null>(null);
  const layer = selectedLayer(workspace);
  const section = selectedSection(workspace.doc, layer);
  const asset = workspace.doc.assets.find((candidate) => candidate.id === layer.assetId);
  const buttonAction = buttonActionForLayer(workspace.doc, layer);

  function patchStyle(style: LayerStyle) {
    onChange(updateSelectedLayerStyle(workspace, style));
  }

  function patchBound(key: "x" | "y" | "width" | "height", value: string) {
    const number = numberFromInput(value);
    if (Number.isFinite(number)) {
      onChange(updateSelectedBounds(workspace, { [key]: number }));
    }
  }

  async function replaceImageAsset(file: File) {
    try {
      const patch = await createImageAssetPatchFromFile(file, { readAsDataUrl: readBrowserFileAsDataUrl });
      setAssetUploadError(null);
      onChange(updateSelectedImageAsset(workspace, patch));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Image replacement failed.";
      setAssetUploadError(message);
    }
  }

  return (
    <aside className="inspector">
      <div className="panel-heading compact">
        <div>
          <h2>Selected Layer</h2>
          <p>{section ? `${section.name} section` : "Unsectioned layer"}</p>
        </div>
        <PanelRight size={18} />
      </div>

      <div className="inspector-id">
        <span>{layer.id}</span>
        <small>{layerKindLabel(layer)}</small>
      </div>

      <div className="field-group">
        <h3>Content</h3>
        {(layer.kind === "text" || layer.kind === "button") && (
          <label className="field">
            <span>Text</span>
            <input value={layer.content?.text ?? ""} onChange={(event) => onChange(updateSelectedText(workspace, event.target.value))} />
          </label>
        )}
        {layer.kind === "button" && (
          <label className="field">
            <span>Button action</span>
            <input
              data-contract-field="data-interaction-actions"
              value={buttonAction}
              onChange={(event) => onChange(updateSelectedButtonAction(workspace, event.target.value))}
            />
          </label>
        )}
        <label className="field">
          <span>Alt</span>
          <input
            value={layer.content?.alt ?? ""}
            onChange={(event) => (layer.kind === "image" ? onChange(updateSelectedImageAlt(workspace, event.target.value)) : undefined)}
            readOnly={layer.kind !== "image"}
          />
        </label>
      </div>

      <div className="field-group">
        <h3>Style</h3>
        <label className="field two-col">
          <span>Background</span>
          <input
            type="color"
            value={styleValue(layer.style, "backgroundColor", "#ffffff")}
            onChange={(event) => patchStyle({ backgroundColor: event.target.value })}
          />
        </label>
        <label className="field two-col">
          <span>Text color</span>
          <input
            type="color"
            value={styleValue(layer.style, "textColor", "#111827")}
            onChange={(event) => patchStyle({ textColor: event.target.value })}
          />
        </label>
        <label className="field two-col">
          <span>Border color</span>
          <input
            type="color"
            value={styleValue(layer.style, "borderColor", "#111827")}
            onChange={(event) => patchStyle({ borderColor: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Font family</span>
          <input
            value={styleValue(layer.style, "fontFamily", "")}
            onChange={(event) => patchStyle({ fontFamily: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Radius</span>
          <input
            type="number"
            min="0"
            value={styleValue(layer.style, "borderRadius", "0")}
            onChange={(event) => patchStyle({ borderRadius: numberFromInput(event.target.value) })}
          />
        </label>
        <label className="field">
          <span>Font size</span>
          <input
            type="number"
            min="1"
            value={styleValue(layer.style, "fontSize", "0")}
            onChange={(event) => patchStyle({ fontSize: numberFromInput(event.target.value) })}
          />
        </label>
        <label className="field">
          <span>Font weight</span>
          <input
            type="number"
            min="1"
            step="10"
            value={styleValue(layer.style, "fontWeight", "0")}
            onChange={(event) => patchStyle({ fontWeight: numberFromInput(event.target.value) })}
          />
        </label>
        <label className="field">
          <span>Line height</span>
          <input
            type="number"
            min="1"
            step="0.5"
            value={styleValue(layer.style, "lineHeight", "0")}
            onChange={(event) => patchStyle({ lineHeight: numberFromDecimalInput(event.target.value) })}
          />
        </label>
        <label className="field">
          <span>Letter spacing</span>
          <input
            type="number"
            step="0.1"
            value={styleValue(layer.style, "letterSpacing", "0")}
            onChange={(event) => patchStyle({ letterSpacing: numberFromDecimalInput(event.target.value) })}
          />
        </label>
        <label className="field">
          <span>Padding X</span>
          <input
            type="number"
            min="0"
            value={paddingValue(layer.style, "x")}
            onChange={(event) => patchStyle({ padding: { x: numberFromInput(event.target.value) } })}
          />
        </label>
        <label className="field">
          <span>Padding Y</span>
          <input
            type="number"
            min="0"
            value={paddingValue(layer.style, "y")}
            onChange={(event) => patchStyle({ padding: { y: numberFromInput(event.target.value) } })}
          />
        </label>
        <label className="field">
          <span>Gap</span>
          <input
            type="number"
            min="0"
            value={styleValue(layer.style, "gap", "0")}
            onChange={(event) => patchStyle({ gap: numberFromInput(event.target.value) })}
          />
        </label>
        <label className="field">
          <span>Opacity</span>
          <input
            type="number"
            min="0"
            max="1"
            step="0.05"
            value={styleValue(layer.style, "opacity", "1")}
            onChange={(event) => patchStyle({ opacity: numberFromDecimalInput(event.target.value) })}
          />
        </label>
      </div>

      <div className="field-group">
        <h3>Image</h3>
        {layer.kind === "image" ? (
          <label className="asset-upload-control">
            <input
              aria-label="Replace selected image asset"
              accept="image/*"
              type="file"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) {
                  void replaceImageAsset(file);
                  event.currentTarget.value = "";
                }
              }}
            />
            <Upload size={14} />
            Replace image
          </label>
        ) : null}
        <label className="field">
          <span>Asset URI</span>
          <input
            value={asset?.uri ?? ""}
            onChange={(event) =>
              layer.kind === "image" ? onChange(updateSelectedImageAsset(workspace, { uri: event.target.value, source: "uploaded" })) : undefined
            }
            readOnly={layer.kind !== "image"}
          />
        </label>
        {assetUploadError ? <div className="asset-upload-error">{assetUploadError}</div> : null}
        {asset?.uri ? <img className="asset-preview" src={asset.uri} alt={layer.content?.alt ?? ""} /> : <div className="asset-empty">No image asset</div>}
      </div>

      <div className="field-group">
        <h3>Bounds</h3>
        <div className="bounds-grid">
          {(["x", "y", "width", "height"] as const).map((key) => (
            <label className="field" key={key}>
              <span>{key === "width" ? "W" : key === "height" ? "H" : key.toUpperCase()}</span>
              <input type="number" value={layer.bounds[key]} onChange={(event) => patchBound(key, event.target.value)} />
            </label>
          ))}
        </div>
      </div>
    </aside>
  );
}

function SectionOrder({ workspace, onChange }: { workspace: EditorWorkspace; onChange: (workspace: EditorWorkspace, message?: string) => void }) {
  function regenerationPrompt(section: SectionNode): string {
    return `Regenerate the ${section.name} section while preserving its LayerDoc bounds, layer semantics, and project traceability.`;
  }

  return (
    <div className="section-order">
      <div className="sidebar-title">Sections</div>
      {workspace.doc.sections.map((section, index) => {
        const requestCount = workspace.doc.generation.sectionRequests.filter((request) => request.sectionId === section.id).length;

        return (
          <div className={`section-row ${section.visible === false ? "hidden" : ""}`} key={section.id}>
            <button type="button" onClick={() => onChange(moveWorkspaceSection(workspace, section.id, Math.max(0, index - 1)), "Section order updated")} aria-label={`Move ${section.name} up`}>
              Up
            </button>
            <button type="button" onClick={() => onChange(moveWorkspaceSection(workspace, section.id, index + 1), "Section order updated")} aria-label={`Move ${section.name} down`}>
              Down
            </button>
            <button
              className="section-visibility"
              type="button"
              onClick={() =>
                onChange(
                  updateWorkspaceSectionVisibility(workspace, section.id, section.visible === false),
                  `${section.name} ${section.visible === false ? "shown" : "hidden"}`
                )
              }
              aria-label={`${section.visible === false ? "Show" : "Hide"} ${section.name}`}
              aria-pressed={section.visible !== false}
            >
              {section.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
            <button
              className="section-regenerate"
              type="button"
              onClick={() =>
                onChange(
                  requestWorkspaceSectionRegeneration(workspace, section.id, regenerationPrompt(section)),
                  `${section.name} regeneration requested`
                )
              }
              aria-label={`Request ${section.name} regeneration`}
            >
              <WandSparkles size={13} />
            </button>
            <span>{section.name}</span>
            {requestCount > 0 ? <small>{requestCount}</small> : null}
          </div>
        );
      })}
    </div>
  );
}

function ProjectExportPanel({
  workspace,
  onDownload,
  onDownloadZip
}: {
  workspace: EditorWorkspace;
  onDownload: () => void;
  onDownloadZip: () => void;
}) {
  const auditStatus = workspace.audit.structure.valid && workspace.audit.assetCompliance.passed ? "ready" : "review";
  const assetCoverage = `${Math.round(workspace.audit.assetCompliance.assetCoverageRatio * 100)}%`;

  return (
    <div className="project-export-panel">
      <div className="sidebar-title">Project Package</div>
      <div className={`layerdoc-audit-card ${auditStatus}`}>
        <div className="layerdoc-audit-head">
          <span>LayerDoc Audit</span>
          <strong>{auditStatus}</strong>
        </div>
        <div className="layerdoc-audit-grid">
          <span>{workspace.audit.summary.editableLayers} editable</span>
          <span>{workspace.audit.summary.exportableComponents} components</span>
          <span>{assetCoverage} assets</span>
        </div>
        {workspace.audit.assetCompliance.findings[0] ? <small>{workspace.audit.assetCompliance.findings[0]}</small> : null}
      </div>
      <div className="export-package-head">
        <strong>{workspace.projectExport.manifest.packageName}</strong>
        <span>{workspace.projectExport.files.length} files</span>
      </div>
      <div className="export-package-actions">
        <button className="export-package-download primary" type="button" onClick={onDownloadZip}>
          <Download size={13} />
          Export ZIP
        </button>
        <button className="export-package-download" type="button" onClick={onDownload}>
          <Download size={13} />
          Export Project
        </button>
      </div>
      <div className="export-file-list">
        {workspace.projectExport.files.map((file) => (
          <div className="export-file-row" key={file.path}>
            {file.path}
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalysisPlanPanel({
  intake,
  onChange,
  onBuild,
  onDownloadPlan,
  onUploadPlan,
  onUploadFile,
  uploadError
}: {
  intake: IntakeWorkspace;
  onChange: (workspace: IntakeWorkspace) => void;
  onBuild: () => void | Promise<void>;
  onDownloadPlan: () => void;
  onUploadPlan: (file: File) => void;
  onUploadFile: (file: File) => void;
  uploadError: string | null;
}) {
  const section = selectedAnalysisSection(intake);
  const layer = selectedAnalysisLayer(intake);
  const cropBounds = layer?.asset?.cropBounds ?? layer?.bounds ?? { x: 0, y: 0, width: 1, height: 1 };
  const emptyAnalysisSectionNames = intake.analysisPlan.sections.filter((candidate) => candidate.layers.length === 0).map((candidate) => candidate.name);
  const canBuildLayerDoc = intake.ready && intake.layerCount > 0 && emptyAnalysisSectionNames.length === 0;

  function addLayer(kind: ManualAnalysisLayerKind) {
    onChange(addManualAnalysisLayer(intake, { kind }));
  }

  function patchLayerText(value: string) {
    if (!layer) {
      return;
    }

    onChange(updateManualAnalysisLayer(intake, layer.id, layer.kind === "image" ? { alt: value } : { text: value }));
  }

  function patchLayerBound(key: "x" | "y" | "width" | "height", value: string) {
    if (!layer) {
      return;
    }

    const number = numberFromInput(value);
    if (Number.isFinite(number)) {
      onChange(updateManualAnalysisLayer(intake, layer.id, { bounds: { ...layer.bounds, [key]: number } }));
    }
  }

  function patchLayerCropBound(key: "x" | "y" | "width" | "height", value: string) {
    if (!layer?.asset) {
      return;
    }

    const number = numberFromInput(value);
    if (Number.isFinite(number)) {
      onChange(
        updateManualAnalysisLayer(intake, layer.id, {
          asset: {
            ...layer.asset,
            cropBounds: { ...cropBounds, [key]: number }
          }
        })
      );
    }
  }

  return (
    <div className="analysis-panel">
      <div className="sidebar-title">Analysis Plan</div>
      <label className="upload-control">
        <input
          aria-label="Upload PNG"
          accept="image/png"
          type="file"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) {
              onUploadFile(file);
              event.currentTarget.value = "";
            }
          }}
        />
        Upload PNG
      </label>
      <div className="analysis-source">
        <FlaskConical size={16} />
        <div>
          <strong>{intake.sourceImage.uri}</strong>
          <span>
            {intake.sourceImage.width} x {intake.sourceImage.height}
          </span>
        </div>
      </div>
      <div className="analysis-stats">
        <span>{intake.analysisPlan.sections.length} sections</span>
        <span>{intake.layerCount} layers</span>
      </div>
      <div className="analysis-section-list">
        {intake.analysisPlan.sections.map((section) => (
          <button
            className={section.id === intake.selectedSectionId ? "selected" : ""}
            key={section.id}
            type="button"
            onClick={() => onChange(selectIntakeSection(intake, section.id))}
          >
            <span>{section.name}</span>
            <small>{section.layers.length}</small>
          </button>
        ))}
      </div>
      <div className="manual-layer-tools">
        <div className="manual-tool-head">
          <strong>{section?.name ?? "Section"}</strong>
          <span>{section?.bounds.width ?? 0} x {section?.bounds.height ?? 0}</span>
        </div>
        <div className="manual-add-grid" aria-label="Add analysis layers">
          <button type="button" onClick={() => addLayer("text")}>
            <Type size={13} />
            Text
          </button>
          <button type="button" onClick={() => addLayer("button")}>
            <MousePointer2 size={13} />
            Button
          </button>
          <button type="button" onClick={() => addLayer("image")}>
            <FileImage size={13} />
            Image
          </button>
        </div>
        <div className="analysis-layer-list">
          {(section?.layers ?? []).map((candidate) => (
            <button
              className={candidate.id === intake.selectedLayerId ? "selected" : ""}
              key={candidate.id}
              type="button"
              onClick={() => onChange(selectIntakeLayer(intake, candidate.id))}
            >
              <span>{candidate.id}</span>
              <small>{candidate.kind}</small>
            </button>
          ))}
          {section?.layers.length === 0 ? <div className="analysis-layer-empty">No layers in selected section</div> : null}
        </div>
        {layer ? (
          <div className="analysis-layer-editor">
            <label className="field">
              <span>{layer.kind === "image" ? "Alt" : "Text"}</span>
              <input value={planLayerContent(layer)} onChange={(event) => patchLayerText(event.target.value)} />
            </label>
            <div className="mini-bounds-grid">
              {(["x", "y", "width", "height"] as const).map((key) => (
                <label className="field" key={key}>
                  <span>{key === "width" ? "W" : key === "height" ? "H" : key.toUpperCase()}</span>
                  <input type="number" value={layer.bounds[key]} onChange={(event) => patchLayerBound(key, event.target.value)} />
                </label>
              ))}
            </div>
            {layer.kind === "image" ? (
              <div className="crop-editor">
                <div className="crop-title">Crop</div>
                <div className="mini-bounds-grid">
                  {(["x", "y", "width", "height"] as const).map((key) => (
                    <label className="field" key={key}>
                      <span>{key === "width" ? "W" : key === "height" ? "H" : key.toUpperCase()}</span>
                      <input type="number" value={cropBounds[key]} onChange={(event) => patchLayerCropBound(key, event.target.value)} />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="analysis-actions">
        <label className="analysis-file-action">
          <input
            aria-label="Load Analysis Plan JSON"
            accept="application/json,.json"
            className="file-input-hidden"
            type="file"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) {
                onUploadPlan(file);
                event.currentTarget.value = "";
              }
            }}
          />
          <Upload size={13} />
          Load Analysis Plan
        </label>
        <button type="button" onClick={onDownloadPlan}>
          <Download size={13} />
          Save Analysis Plan
        </button>
        <button type="button" onClick={() => onChange(seedHomepageAnnotations(intake))}>
          Seed homepage
        </button>
        <button type="button" onClick={() => onChange(addHeroAnnotationSet(intake))}>
          Add hero layers
        </button>
        <button type="button" disabled={!canBuildLayerDoc} onClick={() => void onBuild()}>
          Build LayerDoc
        </button>
      </div>
      {uploadError ? (
        <div className="analysis-issues">{uploadError}</div>
      ) : intake.issues.length > 0 ? (
        <div className="analysis-issues">{intake.issues.join(" ")}</div>
      ) : intake.layerCount === 0 ? (
        <div className="analysis-issues">Add layers before building</div>
      ) : emptyAnalysisSectionNames.length > 0 ? (
        <div className="analysis-issues">Add layers to: {emptyAnalysisSectionNames.join(", ")}</div>
      ) : (
        <div className="analysis-ready">Plan valid for intake</div>
      )}
    </div>
  );
}

function VerifierStrip({
  workspace,
  referenceName,
  verifierError,
  onReferenceFile,
  onDownloadReport
}: {
  workspace: EditorWorkspace;
  referenceName: string | null;
  verifierError: string | null;
  onReferenceFile: (file: File) => void;
  onDownloadReport: () => void;
}) {
  const visualDiff = workspace.report.visualDiff;
  const visualEvidence = workspace.report.evidence.visual;
  const candidateLabel = visualEvidence.kind === "layerdoc-raster" ? "LayerDoc raster fallback" : "HTML preview screenshot";
  const problemAreas = visualDiff?.problemAreas ?? [];
  const gateResult = evaluateVerificationGates(workspace.report, {}, {
    assetCompliance: workspace.audit.assetCompliance,
    editableCoverage: workspace.audit.editableCoverage
  });
  const scores = [
    ["visual_similarity", workspace.report.visualSimilarity, 85],
    ["structure_score", workspace.report.structureScore, 90],
    ["component_score", workspace.report.componentScore, 90],
    ["project_fit_score", workspace.report.projectFitScore, 85]
  ] as const;

  return (
    <footer className="verifier-strip">
      <div className="verifier-head">
        <div>
          <strong>Verifier</strong>
          <span>{visualDiff ? `${visualDiff.problemAreas.length} problem areas` : "Awaiting screenshot diff"}</span>
        </div>
        <button className="secondary-action" type="button" onClick={onDownloadReport}>
          View report
        </button>
      </div>
      <div className="verifier-inputs">
        <label className="verifier-upload">
          <input
            aria-label="Load verifier reference PNG"
            accept="image/png"
            type="file"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) {
                onReferenceFile(file);
                event.currentTarget.value = "";
              }
            }}
          />
          <span>Reference PNG</span>
          <strong>{referenceName ?? "not loaded"}</strong>
        </label>
        <div className="verifier-upload locked">
          <span>Candidate</span>
          <strong>{candidateLabel}</strong>
        </div>
        <div className={`verifier-evidence ${visualEvidence.kind}`}>
          <span>Evidence</span>
          <strong>{visualEvidence.label}</strong>
          <small>{visualEvidence.description}</small>
        </div>
        {verifierError ? <div className="verifier-error">{verifierError}</div> : null}
        <div className={`quality-gate-summary ${gateResult.passed ? "passed" : "blocked"}`}>
          <span>Quality gate</span>
          <strong>{gateResult.passed ? "passed" : "blocked"}</strong>
          {gateResult.failures.length > 0 ? <small>{gateResult.failures.slice(0, 2).join(" / ")}</small> : null}
        </div>
        {visualDiff ? (
          <div className="problem-area-list">
            <div className="problem-area-list-head">
              <span>Problem areas</span>
              <strong>{problemAreas.length}</strong>
            </div>
            {problemAreas.slice(0, 4).map((area, index) => (
              <div className="problem-area-row" key={`${area.x}-${area.y}-${area.width}-${area.height}-${index}`}>
                <span>#{index + 1}</span>
                <strong>
                  {area.x},{area.y} / {area.width}x{area.height}
                </strong>
              </div>
            ))}
            {problemAreas.length > 4 ? <div className="problem-area-more">+{problemAreas.length - 4} more</div> : null}
          </div>
        ) : null}
      </div>
      <div className="score-grid">
        {scores.map(([label, value, threshold]) => (
          <div className="score-card" key={label}>
            <span>{label}</span>
            <strong>{formatScore(value)}</strong>
            <div className="score-track">
              <i style={{ width: `${value ?? 0}%` }} />
            </div>
            <small>Threshold {">="} {threshold}</small>
          </div>
        ))}
      </div>
    </footer>
  );
}

export function App() {
  const [workspace, setWorkspace] = useState(() => createEditorWorkspace(createSampleHomepageLayerDoc()));
  const [intake, setIntake] = useState(() => createIntakeWorkspace({ uri: "homepage_source.png", width: 1440, height: 1760 }));
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [previewSurface, setPreviewSurface] = useState<PreviewSurface>("canvas");
  const [showLabels, setShowLabels] = useState(true);
  const [lastAction, setLastAction] = useState("Auto-saved LayerDoc state");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [verifierReference, setVerifierReference] = useState<VerifierSnapshot | null>(null);
  const [verifierError, setVerifierError] = useState<string | null>(null);
  const workflow = createWorkflowSummary({
    sourceUri: intake.sourceImage.uri,
    intakeSectionCount: intake.analysisPlan.sections.length,
    intakeLayerCount: intake.layerCount,
    layerDocSectionCount: workspace.doc.sections.length,
    layerDocLayerCount: workspace.doc.layers.length,
    exportFileName: workspace.reactExport.fileName,
    issueCount: workspace.report.issues.length
  });

  function updateWorkspace(next: EditorWorkspace, message = "LayerDoc updated") {
    setWorkspace(next);
    setWorkspaceError(null);
    setLastAction(message);
  }

  function updateIntake(next: IntakeWorkspace, message = "Analysis plan updated") {
    setIntake(next);
    setUploadError(null);
    setLastAction(message);
  }

  async function importPngFile(file: File) {
    try {
      const nextIntake = await createIntakeWorkspaceFromBrowserFile(file);
      setIntake(nextIntake);
      setUploadError(null);
      setLastAction(`Loaded PNG: ${file.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to import PNG.";
      setUploadError(message);
      setLastAction("PNG import failed");
    }
  }

  async function importLayerDocFile(file: File) {
    try {
      const nextWorkspace = createWorkspaceFromLayerDocJson(await file.text());
      setWorkspace(nextWorkspace);
      setWorkspaceError(null);
      setLastAction(`Loaded LayerDoc: ${file.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to import LayerDoc.";
      setWorkspaceError(message);
      setLastAction("LayerDoc import failed");
    }
  }

  async function importAnalysisPlanFile(file: File) {
    try {
      const nextIntake = createIntakeWorkspaceFromAnalysisPlanJson(intake.sourceImage, await file.text());
      setIntake(nextIntake);
      setUploadError(null);
      setLastAction(`Loaded Analysis Plan: ${file.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to import Analysis Plan.";
      setUploadError(message);
      setLastAction("Analysis Plan import failed");
    }
  }

  function downloadArtifact(artifact: LayerDocDownloadArtifact) {
    triggerBrowserDownload(artifact);
  }

  function saveLayerDocFile() {
    const artifact = createLayerDocDownload(workspace.doc);
    downloadArtifact(artifact);
    setLastAction(`Saved ${artifact.fileName}`);
  }

  function saveAnalysisPlanFile() {
    const artifact = createAnalysisPlanDownload(intake.analysisPlan);
    downloadArtifact(artifact);
    setLastAction(`Saved ${artifact.fileName}`);
  }

  function exportReactFile() {
    const artifact = createReactExportDownload(workspace);
    downloadArtifact(artifact);
    setLastAction(`Exported ${artifact.fileName}`);
  }

  function exportProjectPackage() {
    const artifact = createProjectPackageDownload(workspace);
    downloadArtifact(artifact);
    setLastAction(`Exported ${artifact.fileName}`);
  }

  function exportProjectZip() {
    const artifact = createProjectPackageZipDownload(workspace);
    downloadArtifact(artifact);
    setLastAction(`Exported ${artifact.fileName}`);
  }

  function downloadVerifierReport(sourceWorkspace = workspace) {
    const artifact = createVerificationReportDownload(sourceWorkspace);
    downloadArtifact(artifact);
    setLastAction(`Saved ${artifact.fileName}`);
  }

  async function importVerifierSnapshot(file: File) {
    try {
      const snapshot = await createVerifierSnapshot(file);
      setVerifierReference(snapshot);
      setVerifierError(null);
      setLastAction(`Loaded reference snapshot: ${file.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load verifier PNG.";
      setVerifierError(message);
      setLastAction("Verifier snapshot import failed");
    }
  }

  async function runVerifierReport() {
    if (!verifierReference) {
      setVerifierError("Load a reference PNG before running screenshot diff.");
      setLastAction("Verifier needs a reference PNG");
      return;
    }

    try {
      setLastAction("Rendering HTML preview screenshot for verifier");
      const nextWorkspace = await runWorkspacePreviewVerification(workspace, {
        reference: verifierReference.image,
        visualEvidence: verificationVisualEvidence.htmlScreenshot,
        renderCandidate: ({ previewHtml, canvas }) => renderHtmlPreviewSnapshot({ html: previewHtml, canvas })
      });
      setWorkspace(nextWorkspace);
      setVerifierError(null);
      downloadVerifierReport(nextWorkspace);
      setLastAction(`Verifier ran: ${formatScore(nextWorkspace.report.visualSimilarity)} visual similarity`);
    } catch (error) {
      try {
        setLastAction("HTML screenshot unavailable; rendering LayerDoc raster fallback");
        const nextWorkspace = await runWorkspacePreviewVerification(workspace, {
          reference: verifierReference.image,
          visualEvidence: verificationVisualEvidence.layerDocRaster,
          renderCandidate: ({ doc }) => renderLayerDocSnapshot(doc)
        });
        setWorkspace(nextWorkspace);
        setVerifierError(`HTML screenshot unavailable; used LayerDoc raster fallback. ${messageFromError(error)}`);
        downloadVerifierReport(nextWorkspace);
        setLastAction(`Verifier ran with LayerDoc raster fallback: ${formatScore(nextWorkspace.report.visualSimilarity)} visual similarity`);
      } catch (fallbackError) {
        const message = fallbackError instanceof Error ? fallbackError.message : "Unable to run verifier.";
        setVerifierError(message);
        setLastAction("Verifier run failed");
      }
    }
  }

  async function buildFromAnalysisPlan() {
    try {
      setLastAction("Materializing reference crops");
      const materializedIntake = await materializeReferenceCropAssets(intake, cropBrowserReferenceAsset);
      const nextWorkspace = buildWorkspaceFromIntake(materializedIntake);
      setIntake(materializedIntake);
      setWorkspace(nextWorkspace);
      setUploadError(null);
      setLastAction(`LayerDoc built from ${materializedIntake.layerCount} planned layers`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to build LayerDoc.";
      setUploadError(message);
      setLastAction("LayerDoc build failed");
    }
  }

  return (
    <main className="studio-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Layers3 size={20} />
          </div>
          <span>LayerDoc Studio</span>
        </div>
        <div className="project-switcher">
          <span>Project</span>
          <strong>Production Homepage</strong>
          <small>v0.1.0 saved</small>
        </div>
        <div className="top-actions">
          <button className="ghost-action" type="button" onClick={() => updateWorkspace(createEditorWorkspace(createSampleHomepageLayerDoc()), "Reset to sample LayerDoc")}>
            <RefreshCw size={16} />
            Reset
          </button>
          <label className="ghost-action">
            <input
              aria-label="Load LayerDoc JSON"
              accept="application/json,.json"
              className="file-input-hidden"
              type="file"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) {
                  void importLayerDocFile(file);
                  event.currentTarget.value = "";
                }
              }}
            />
            <Upload size={16} />
            Load LayerDoc
          </label>
          <button className="secondary-action" type="button" onClick={() => void runVerifierReport()}>
            <Play size={16} />
            Run Verifier
          </button>
          <button className="secondary-action" type="button" onClick={saveLayerDocFile}>
            <Download size={16} />
            Save LayerDoc
          </button>
          <button className="primary-action" type="button" onClick={exportReactFile}>
            <Code2 size={16} />
            Export React
          </button>
        </div>
      </header>

      <aside className="workflow-sidebar">
        <div className="sidebar-title">Workflow</div>
        {workflow.map((item, index) => (
          <WorkspaceStep item={item} index={index} key={item.label} />
        ))}
        <AnalysisPlanPanel
          intake={intake}
          onChange={updateIntake}
          onBuild={buildFromAnalysisPlan}
          onDownloadPlan={saveAnalysisPlanFile}
          onUploadPlan={(file) => void importAnalysisPlanFile(file)}
          onUploadFile={(file) => void importPngFile(file)}
          uploadError={uploadError}
        />
        <ProjectExportPanel workspace={workspace} onDownload={exportProjectPackage} onDownloadZip={exportProjectZip} />
        <SectionOrder workspace={workspace} onChange={updateWorkspace} />
      </aside>

      <section className="studio-main">
        <div className="main-controls">
          <div className={`status-pill ${workspaceError ? "error" : ""}`}>
            <WandSparkles size={15} />
            {workspaceError ?? lastAction}
          </div>
          <label className="toggle">
            <input type="checkbox" checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} />
            <span>Show labels</span>
          </label>
        </div>
        <CanvasPreview
          previewMode={previewMode}
          previewSurface={previewSurface}
          workspace={workspace}
          showLabels={showLabels}
          onPreviewModeChange={(mode) => {
            setPreviewMode(mode);
            setLastAction(`${mode === "mobile" ? "Mobile" : "Desktop"} preview selected`);
          }}
          onPreviewSurfaceChange={(surface) => {
            setPreviewSurface(surface);
            setLastAction(`${surface === "html" ? "HTML preview" : "Canvas preview"} selected`);
          }}
          onSelectLayer={(layerId) => updateWorkspace(selectWorkspaceLayer(workspace, layerId), `Selected ${layerId}`)}
        />
      </section>

      <Inspector workspace={workspace} onChange={(next) => updateWorkspace(next)} />
      <VerifierStrip
        workspace={workspace}
        referenceName={verifierReference?.fileName ?? null}
        verifierError={verifierError}
        onReferenceFile={(file) => void importVerifierSnapshot(file)}
        onDownloadReport={downloadVerifierReport}
      />
    </main>
  );
}
