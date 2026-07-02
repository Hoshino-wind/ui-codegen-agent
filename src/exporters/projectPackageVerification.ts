import { spawnSync } from "node:child_process";
import { delimiter, resolve } from "node:path";
import process from "node:process";

export interface ProjectVerifierResult {
  command: string;
  status: number | null;
  result: unknown;
}

export interface ProjectVerificationChainResult {
  mode: "structure" | "quality" | "preview";
  results: ProjectVerifierResult[];
}

export interface ProjectPreviewVerificationOptions {
  candidatePath?: string;
  referencePath?: string;
  previewOutDir?: string;
  previewThreshold?: string;
  browserPath?: string;
  includeAA?: boolean;
}

export const structureVerificationScripts = [
  "scripts/verify-production-manifest.mjs",
  "scripts/verify-handoff.mjs",
  "scripts/verify-analysis-plan.mjs",
  "scripts/verify-image-manifest.mjs",
  "scripts/verify-layerdoc.mjs",
  "scripts/verify-contract.mjs"
];

export const qualityVerificationScripts = [
  ...structureVerificationScripts,
  "scripts/verify-gates.mjs"
];

export const previewVerificationScripts = [
  "scripts/verify-preview.mjs",
  ...qualityVerificationScripts
];

function projectVerifierEnv(): NodeJS.ProcessEnv {
  const nodePath = [resolve("node_modules"), process.env.NODE_PATH].filter(Boolean).join(delimiter);
  return {
    ...process.env,
    NODE_PATH: nodePath
  };
}

export function runProjectVerifier(rootDir: string, scriptPath: string, scriptArgs: string[] = []): ProjectVerifierResult {
  const command = ["node", scriptPath, ...scriptArgs].join(" ");
  const result = spawnSync(process.execPath, [scriptPath, ...scriptArgs], {
    cwd: rootDir,
    encoding: "utf8",
    env: projectVerifierEnv()
  });

  if (result.status !== 0) {
    throw new Error(`Materialized project verification failed for ${command}:\n${result.stderr || result.stdout}`);
  }

  return {
    command,
    status: result.status,
    result: JSON.parse(result.stdout)
  };
}

export function verifyProjectHandoff(rootDir: string): ProjectVerifierResult {
  return runProjectVerifier(rootDir, "scripts/verify-handoff.mjs");
}

export function verifyProjectStructure(rootDir: string): ProjectVerificationChainResult {
  return {
    mode: "structure",
    results: structureVerificationScripts.map((scriptPath) => runProjectVerifier(rootDir, scriptPath))
  };
}

export function verifyProjectQuality(rootDir: string): ProjectVerificationChainResult {
  return {
    mode: "quality",
    results: qualityVerificationScripts.map((scriptPath) => runProjectVerifier(rootDir, scriptPath))
  };
}

function previewArgsFor(options: ProjectPreviewVerificationOptions): string[] {
  const args: string[] = [];

  if (options.candidatePath) {
    args.push("--candidate", resolve(options.candidatePath));
  }
  if (options.referencePath) {
    args.push("--reference", resolve(options.referencePath));
  }
  if (options.previewOutDir) {
    args.push("--out", options.previewOutDir);
  }
  if (options.previewThreshold) {
    args.push("--threshold", options.previewThreshold);
  }
  if (options.browserPath) {
    args.push("--browser", resolve(options.browserPath));
  }
  if (options.includeAA) {
    args.push("--include-aa");
  }

  return args;
}

export function verifyProjectPreview(rootDir: string, options: ProjectPreviewVerificationOptions = {}): ProjectVerificationChainResult {
  return {
    mode: "preview",
    results: previewVerificationScripts.map((scriptPath) =>
      runProjectVerifier(rootDir, scriptPath, scriptPath === "scripts/verify-preview.mjs" ? previewArgsFor(options) : [])
    )
  };
}
