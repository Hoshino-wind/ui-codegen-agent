export interface WorkflowSummaryInput {
  sourceUri: string | null;
  intakeSectionCount: number;
  intakeLayerCount: number;
  layerDocSectionCount: number;
  layerDocLayerCount: number;
  editableLayerCount: number;
  previewReady: boolean;
  exportFileName: string | null;
  visualSimilarity: number | null;
  structuralIssueCount: number;
  qualityGatePassed: boolean;
}

export interface WorkflowSummaryItem {
  label: "Image" | "LayerDoc" | "Editor" | "Preview" | "Export" | "Verifier";
  detail: string;
  done?: boolean;
  active?: boolean;
}

// The sidebar tracks the first incomplete production stage instead of acting as
// a static wizard; each status is derived from generated artifacts or gates.
function status(done: boolean, activeIndex: number, index: number): Pick<WorkflowSummaryItem, "done" | "active"> {
  return {
    ...(done ? { done: true } : {}),
    ...(!done && activeIndex === index ? { active: true } : {})
  };
}

function scoreLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function createWorkflowSummary(input: WorkflowSummaryInput): WorkflowSummaryItem[] {
  const imageDone = Boolean(input.sourceUri);
  const layerDocDone = imageDone && input.layerDocSectionCount > 0 && input.layerDocLayerCount > 0;
  const editorDone = layerDocDone && input.editableLayerCount > 0;
  const previewDone = editorDone && input.previewReady;
  const exportDone = previewDone && Boolean(input.exportFileName);
  const verifierDone = exportDone && input.visualSimilarity !== null && input.qualityGatePassed;
  const doneStates = [imageDone, layerDocDone, editorDone, previewDone, exportDone, verifierDone];
  const activeIndex = doneStates.findIndex((done) => !done);

  const verifierDetail = (() => {
    if (!exportDone) {
      return "Waiting for export";
    }
    if (input.visualSimilarity === null) {
      return "Awaiting screenshot diff";
    }
    if (input.qualityGatePassed) {
      return `Gate passed / ${scoreLabel(input.visualSimilarity)} similarity`;
    }
    return `Gate blocked / ${scoreLabel(input.visualSimilarity)} similarity / ${input.structuralIssueCount} blockers`;
  })();

  return [
    { label: "Image", detail: input.sourceUri ?? "Upload PNG", ...status(imageDone, activeIndex, 0) },
    {
      label: "LayerDoc",
      detail: layerDocDone
        ? `${input.layerDocSectionCount} sections / ${input.layerDocLayerCount} layers`
        : `${input.intakeSectionCount} sections / ${input.intakeLayerCount} planned layers`,
      ...status(layerDocDone, activeIndex, 1)
    },
    {
      label: "Editor",
      detail: layerDocDone ? `${input.editableLayerCount} editable layers` : "Waiting for LayerDoc",
      ...status(editorDone, activeIndex, 2)
    },
    {
      label: "Preview",
      detail: editorDone ? (input.previewReady ? "HTML preview ready" : "Waiting for HTML preview") : "Waiting for editor",
      ...status(previewDone, activeIndex, 3)
    },
    {
      label: "Export",
      detail: previewDone ? (input.exportFileName ?? "Waiting for React export") : "Waiting for preview",
      ...status(exportDone, activeIndex, 4)
    },
    {
      label: "Verifier",
      detail: verifierDetail,
      ...status(verifierDone, activeIndex, 5)
    }
  ];
}
