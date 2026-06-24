import type { CodegenPlan } from "../codegen/types.js";
import type { DesignIR } from "../ir/types.js";
import type { ProjectProfile } from "../project/types.js";

export interface PipelineInput {
  metadataPath: string;
  previewImagePath?: string;
  targetProjectDir: string;
  finalDir: string;
}

export interface PipelineResult {
  design: DesignIR;
  project: ProjectProfile;
  plan: CodegenPlan;
}

export interface PipelineStage<TInput, TOutput> {
  name: string;
  run(input: TInput): Promise<TOutput>;
}

