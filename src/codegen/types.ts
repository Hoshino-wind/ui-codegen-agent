import type { ComponentNode, DesignIR } from "../ir/types.js";
import type { ProjectProfile } from "../project/types.js";

export type WriteActionKind = "create" | "update" | "copy-asset";

export interface WriteAction {
  kind: WriteActionKind;
  path: string;
  reason: string;
  ownerComponentId?: string;
}

export interface ComponentMapping {
  componentId: string;
  target: "reuse" | "extend" | "create";
  importPath?: string;
  targetPath?: string;
  propsContract: Record<string, string>;
}

export interface CodegenPlan {
  designId: string;
  projectRoot: string;
  framework: ProjectProfile["framework"];
  componentMappings: ComponentMapping[];
  writeActions: WriteAction[];
  blockedComponents: ComponentNode[];
  verificationCommands: string[];
}

export interface CodegenPlanner {
  plan(input: { design: DesignIR; project: ProjectProfile }): CodegenPlan;
}

