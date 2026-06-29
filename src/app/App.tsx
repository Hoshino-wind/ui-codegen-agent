import {
  CheckCircle2,
  Code2,
  Download,
  Eye,
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
  WandSparkles
} from "lucide-react";
import { useMemo, useState } from "react";

import type { LayerNode, LayerStyle, SectionNode } from "../layerdoc/types.js";
import {
  createEditorWorkspace,
  moveWorkspaceSection,
  selectWorkspaceLayer,
  selectedLayer,
  updateSelectedBounds,
  updateSelectedImageAsset,
  updateSelectedLayerStyle,
  updateSelectedText,
  type EditorWorkspace
} from "./editorWorkspace.js";
import { createIntakeWorkspaceFromBrowserFile } from "./imageFileIntake.js";
import { addHeroAnnotationSet, buildWorkspaceFromIntake, createIntakeWorkspace, selectIntakeSection, type IntakeWorkspace } from "./intakeWorkspace.js";
import { createSampleHomepageLayerDoc } from "./sampleDocument.js";
import { createWorkflowSummary, type WorkflowSummaryItem } from "./workflowSummary.js";

const canvasScale = 0.46;

const workflowIcons = {
  Image: FileImage,
  LayerDoc: Layers3,
  Editor: SquareDashedMousePointer,
  Preview: Eye,
  Export: Code2,
  Verifier: CheckCircle2
};

function formatScore(value: number | null): string {
  return value === null ? "n/a" : String(value);
}

function styleValue(style: LayerStyle | undefined, key: keyof LayerStyle, fallback = ""): string {
  const value = style?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function selectedSection(doc: EditorWorkspace["doc"], layer: LayerNode): SectionNode | undefined {
  return doc.sections.find((section) => section.id === layer.sectionId);
}

function numberFromInput(value: string): number {
  return Number.parseInt(value, 10);
}

function layerKindLabel(layer: LayerNode): string {
  return `${layer.kind} / ${layer.track}`;
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
  showLabels,
  onSelect
}: {
  layer: LayerNode;
  assetUri?: string;
  isSelected: boolean;
  showLabels: boolean;
  onSelect: () => void;
}) {
  const style = {
    left: layer.bounds.x * canvasScale,
    top: layer.bounds.y * canvasScale,
    width: layer.bounds.width * canvasScale,
    height: layer.bounds.height * canvasScale,
    backgroundColor: layer.style?.backgroundColor,
    color: layer.style?.textColor,
    borderRadius: layer.style?.borderRadius ? layer.style.borderRadius * canvasScale : undefined
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
  workspace,
  showLabels,
  onSelectLayer
}: {
  workspace: EditorWorkspace;
  showLabels: boolean;
  onSelectLayer: (layerId: string) => void;
}) {
  const assetById = useMemo(() => new Map(workspace.doc.assets.map((asset) => [asset.id, asset])), [workspace.doc.assets]);

  return (
    <section className="canvas-panel">
      <div className="panel-heading">
        <div>
          <h2>Canvas Preview</h2>
          <p>LayerDoc renders real editable objects, not a flattened screenshot.</p>
        </div>
        <div className="canvas-toolbar" aria-label="Canvas toolbar">
          <button className="tool active" type="button" aria-label="Select">
            <MousePointer2 size={16} />
          </button>
          <button className="tool" type="button" aria-label="Desktop preview">
            <Monitor size={16} />
          </button>
          <button className="tool" type="button" aria-label="Mobile preview">
            <Smartphone size={16} />
          </button>
          <span className="zoom-chip">{Math.round(canvasScale * 100)}%</span>
        </div>
      </div>

      <div className="canvas-rulers">
        <span>0</span>
        <span>480</span>
        <span>960</span>
        <span>1440</span>
      </div>
      <div
        className="layerdoc-canvas"
        style={{
          width: workspace.doc.canvas.width * canvasScale,
          height: workspace.doc.canvas.height * canvasScale,
          background: workspace.doc.canvas.background ?? "#ffffff"
        }}
      >
        {workspace.doc.sections.map((section) => (
          <div
            className="canvas-section"
            key={section.id}
            style={{
              left: section.bounds.x * canvasScale,
              top: section.bounds.y * canvasScale,
              width: section.bounds.width * canvasScale,
              height: section.bounds.height * canvasScale
            }}
          >
            {showLabels ? <span className="section-badge">{section.name}</span> : null}
          </div>
        ))}
        {workspace.doc.layers.map((layer) => (
          <CanvasLayer
            key={layer.id}
            layer={layer}
            assetUri={assetById.get(layer.assetId ?? "")?.uri}
            isSelected={workspace.selectedLayerId === layer.id}
            showLabels={showLabels}
            onSelect={() => onSelectLayer(layer.id)}
          />
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
  const layer = selectedLayer(workspace);
  const section = selectedSection(workspace.doc, layer);
  const asset = workspace.doc.assets.find((candidate) => candidate.id === layer.assetId);

  function patchStyle(style: LayerStyle) {
    onChange(updateSelectedLayerStyle(workspace, style));
  }

  function patchBound(key: "x" | "y" | "width" | "height", value: string) {
    const number = numberFromInput(value);
    if (Number.isFinite(number)) {
      onChange(updateSelectedBounds(workspace, { [key]: number }));
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
        <label className="field">
          <span>Alt</span>
          <input value={layer.content?.alt ?? ""} readOnly />
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
        <label className="field">
          <span>Radius</span>
          <input
            type="number"
            min="0"
            value={styleValue(layer.style, "borderRadius", "0")}
            onChange={(event) => patchStyle({ borderRadius: numberFromInput(event.target.value) })}
          />
        </label>
      </div>

      <div className="field-group">
        <h3>Image</h3>
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

function SectionOrder({ workspace, onChange }: { workspace: EditorWorkspace; onChange: (workspace: EditorWorkspace) => void }) {
  return (
    <div className="section-order">
      <div className="sidebar-title">Sections</div>
      {workspace.doc.sections.map((section, index) => (
        <div className="section-row" key={section.id}>
          <button type="button" onClick={() => onChange(moveWorkspaceSection(workspace, section.id, Math.max(0, index - 1)))} aria-label={`Move ${section.name} up`}>
            Up
          </button>
          <button type="button" onClick={() => onChange(moveWorkspaceSection(workspace, section.id, index + 1))} aria-label={`Move ${section.name} down`}>
            Down
          </button>
          <span>{section.name}</span>
        </div>
      ))}
    </div>
  );
}

function AnalysisPlanPanel({
  intake,
  onChange,
  onBuild,
  onUploadFile,
  uploadError
}: {
  intake: IntakeWorkspace;
  onChange: (workspace: IntakeWorkspace) => void;
  onBuild: () => void;
  onUploadFile: (file: File) => void;
  uploadError: string | null;
}) {
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
      <div className="analysis-actions">
        <button type="button" onClick={() => onChange(addHeroAnnotationSet(intake))}>
          Add hero layers
        </button>
        <button type="button" onClick={onBuild}>
          Build LayerDoc
        </button>
      </div>
      {uploadError ? (
        <div className="analysis-issues">{uploadError}</div>
      ) : intake.issues.length > 0 ? (
        <div className="analysis-issues">{intake.issues.join(" ")}</div>
      ) : (
        <div className="analysis-ready">Plan valid for intake</div>
      )}
    </div>
  );
}

function VerifierStrip({ workspace }: { workspace: EditorWorkspace }) {
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
          <span>Fresh LayerDoc report</span>
        </div>
        <button className="secondary-action" type="button">
          View report
        </button>
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
  const [showLabels, setShowLabels] = useState(true);
  const [lastAction, setLastAction] = useState("Auto-saved LayerDoc state");
  const [uploadError, setUploadError] = useState<string | null>(null);
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

  function buildFromAnalysisPlan() {
    const nextWorkspace = buildWorkspaceFromIntake(intake);
    setWorkspace(nextWorkspace);
    setLastAction(`LayerDoc built from ${intake.layerCount} planned layers`);
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
          <button className="secondary-action" type="button" onClick={() => setLastAction("Verifier report regenerated")}>
            <Play size={16} />
            Run Verifier
          </button>
          <button className="primary-action" type="button" onClick={() => setLastAction(`Export ready: ${workspace.reactExport.fileName}`)}>
            <Download size={16} />
            Export React
          </button>
        </div>
      </header>

      <aside className="workflow-sidebar">
        <div className="sidebar-title">Workflow</div>
        {workflow.map((item, index) => (
          <WorkspaceStep item={item} index={index} key={item.label} />
        ))}
        <AnalysisPlanPanel intake={intake} onChange={updateIntake} onBuild={buildFromAnalysisPlan} onUploadFile={(file) => void importPngFile(file)} uploadError={uploadError} />
        <SectionOrder workspace={workspace} onChange={(next) => updateWorkspace(next, "Section order updated")} />
      </aside>

      <section className="studio-main">
        <div className="main-controls">
          <div className="status-pill">
            <WandSparkles size={15} />
            {lastAction}
          </div>
          <label className="toggle">
            <input type="checkbox" checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} />
            <span>Show labels</span>
          </label>
        </div>
        <CanvasPreview
          workspace={workspace}
          showLabels={showLabels}
          onSelectLayer={(layerId) => updateWorkspace(selectWorkspaceLayer(workspace, layerId), `Selected ${layerId}`)}
        />
      </section>

      <Inspector workspace={workspace} onChange={(next) => updateWorkspace(next)} />
      <VerifierStrip workspace={workspace} />
    </main>
  );
}
