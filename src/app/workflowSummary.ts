export interface WorkflowSummaryInput {
  sourceUri: string;
  intakeSectionCount: number;
  intakeLayerCount: number;
  layerDocSectionCount: number;
  layerDocLayerCount: number;
  exportFileName: string;
  issueCount: number;
}

export interface WorkflowSummaryItem {
  label: "Image" | "LayerDoc" | "Editor" | "Preview" | "Export" | "Verifier";
  detail: string;
  done?: boolean;
  active?: boolean;
}

export function createWorkflowSummary(input: WorkflowSummaryInput): WorkflowSummaryItem[] {
  return [
    { label: "Image", detail: input.sourceUri, done: true },
    { label: "LayerDoc", detail: `${input.layerDocSectionCount} sections / ${input.layerDocLayerCount} layers`, done: true },
    { label: "Editor", detail: "Fix and refine layers", active: true },
    { label: "Preview", detail: "Compare output" },
    { label: "Export", detail: input.exportFileName },
    { label: "Verifier", detail: `${input.issueCount} issues` }
  ];
}
