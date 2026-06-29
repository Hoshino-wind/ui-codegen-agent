#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

import { runLayerDocPreviewVerification } from "../verifier/previewRun.js";
import { runLayerDocVerification, type VerificationGates } from "../verifier/run.js";
import { CliError, readLayerDocFile, readOptionValue } from "./shared.js";

interface VerifyLayerDocCliOptions {
  inputPath: string;
  referencePath: string;
  outputDir: string;
  candidatePath?: string;
  browserExecutablePath?: string;
  threshold?: number;
  includeAA?: boolean;
  gates?: Partial<VerificationGates>;
}

interface ParsedArgs {
  options?: VerifyLayerDocCliOptions;
  help: boolean;
}

const usage = `Usage: layerdoc-verify --input <layerdoc.json> --reference <reference.png> --out <directory> [--candidate <candidate.png>]

Options:
  --input <layerdoc.json>        LayerDoc JSON file to verify.
  --reference <reference.png>    Original AI visual or target PNG.
  --out <directory>              Directory for report.json, diff.png, and preview artifacts.
  --candidate <candidate.png>    Optional pre-rendered candidate PNG. If omitted, Playwright renders preview.html.
  --browser <executable>         Optional browser executable path for Playwright preview rendering.
  --threshold <0-1>              Pixelmatch threshold. Defaults to 0.1.
  --include-aa                   Include anti-aliased pixels in visual diff.
  --visual-gate <0-100>          Required visual_similarity score.
  --structure-gate <0-100>       Required structure_score.
  --component-gate <0-100>       Required component_score.
  --project-fit-gate <0-100>     Required project_fit_score.
  -h, --help                     Show this help.
`;

function parseNumber(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new CliError(`${name} must be a finite number.`);
  }
  return parsed;
}

function parseArgs(args: string[]): ParsedArgs {
  const values: Partial<VerifyLayerDocCliOptions> = {};
  const gates: Partial<VerificationGates> = {};
  let index = 0;

  while (index < args.length) {
    const arg = args[index];
    if (arg === "-h" || arg === "--help") {
      return { help: true };
    }

    if (arg === "--include-aa") {
      values.includeAA = true;
      index += 1;
      continue;
    }

    if (arg === "--input" || arg.startsWith("--input=")) {
      const option = readOptionValue(args, index, "--input");
      values.inputPath = option.value;
      index = option.nextIndex;
      continue;
    }

    if (arg === "--reference" || arg.startsWith("--reference=")) {
      const option = readOptionValue(args, index, "--reference");
      values.referencePath = option.value;
      index = option.nextIndex;
      continue;
    }

    if (arg === "--out" || arg.startsWith("--out=")) {
      const option = readOptionValue(args, index, "--out");
      values.outputDir = option.value;
      index = option.nextIndex;
      continue;
    }

    if (arg === "--candidate" || arg.startsWith("--candidate=")) {
      const option = readOptionValue(args, index, "--candidate");
      values.candidatePath = option.value;
      index = option.nextIndex;
      continue;
    }

    if (arg === "--browser" || arg.startsWith("--browser=")) {
      const option = readOptionValue(args, index, "--browser");
      values.browserExecutablePath = option.value;
      index = option.nextIndex;
      continue;
    }

    if (arg === "--threshold" || arg.startsWith("--threshold=")) {
      const option = readOptionValue(args, index, "--threshold");
      values.threshold = parseNumber(option.value, "--threshold");
      index = option.nextIndex;
      continue;
    }

    if (arg === "--visual-gate" || arg.startsWith("--visual-gate=")) {
      const option = readOptionValue(args, index, "--visual-gate");
      gates.visualSimilarity = parseNumber(option.value, "--visual-gate");
      index = option.nextIndex;
      continue;
    }

    if (arg === "--structure-gate" || arg.startsWith("--structure-gate=")) {
      const option = readOptionValue(args, index, "--structure-gate");
      gates.structureScore = parseNumber(option.value, "--structure-gate");
      index = option.nextIndex;
      continue;
    }

    if (arg === "--component-gate" || arg.startsWith("--component-gate=")) {
      const option = readOptionValue(args, index, "--component-gate");
      gates.componentScore = parseNumber(option.value, "--component-gate");
      index = option.nextIndex;
      continue;
    }

    if (arg === "--project-fit-gate" || arg.startsWith("--project-fit-gate=")) {
      const option = readOptionValue(args, index, "--project-fit-gate");
      gates.projectFitScore = parseNumber(option.value, "--project-fit-gate");
      index = option.nextIndex;
      continue;
    }

    throw new CliError(`Unknown argument: ${arg}.`, true);
  }

  const inputPath = values.inputPath;
  const referencePath = values.referencePath;
  const outputDir = values.outputDir;
  if (!inputPath || !referencePath || !outputDir) {
    const missing = [
      !inputPath && "--input <layerdoc.json>",
      !referencePath && "--reference <reference.png>",
      !outputDir && "--out <directory>"
    ].filter(Boolean);
    throw new CliError(`Missing required argument(s): ${missing.join(", ")}.`, true);
  }

  return {
    help: false,
    options: {
      inputPath,
      referencePath,
      outputDir,
      candidatePath: values.candidatePath,
      browserExecutablePath: values.browserExecutablePath,
      threshold: values.threshold,
      includeAA: values.includeAA,
      gates: Object.keys(gates).length > 0 ? gates : undefined
    }
  };
}

function scoresFor(run: Awaited<ReturnType<typeof runLayerDocPreviewVerification>> | ReturnType<typeof runLayerDocVerification>) {
  return {
    visualSimilarity: run.report.visualSimilarity,
    structureScore: run.report.structureScore,
    componentScore: run.report.componentScore,
    projectFitScore: run.report.projectFitScore
  };
}

export async function runVerifyLayerDocCli(args: string[]): Promise<number> {
  try {
    const parsed = parseArgs(args);
    if (parsed.help) {
      process.stdout.write(usage);
      return 0;
    }

    const options = parsed.options;
    if (!options) {
      throw new CliError("Missing CLI options.", true);
    }

    const inputPath = resolve(options.inputPath);
    const referencePath = resolve(options.referencePath);
    const outputDir = resolve(options.outputDir);
    const reportPath = join(outputDir, "report.json");
    const diffPath = join(outputDir, "diff.png");
    const doc = readLayerDocFile(inputPath);
    mkdirSync(outputDir, { recursive: true });

    const run = options.candidatePath
      ? runLayerDocVerification({
        doc,
        referencePath,
        candidatePath: resolve(options.candidatePath),
        diffPath,
        threshold: options.threshold,
        includeAA: options.includeAA,
        gates: options.gates
      })
      : await runLayerDocPreviewVerification({
        doc,
        referencePath,
        outputDir,
        diffPath,
        browserExecutablePath: options.browserExecutablePath ? resolve(options.browserExecutablePath) : undefined,
        threshold: options.threshold,
        includeAA: options.includeAA,
        gates: options.gates
      });

    writeFileSync(reportPath, `${JSON.stringify(run, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({
      passed: run.passed,
      reportPath,
      scores: scoresFor(run),
      failures: run.failures,
      artifacts: run.artifacts
    }, null, 2)}\n`);

    return run.passed ? 0 : 2;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    if (error instanceof CliError && error.showUsage) {
      process.stderr.write(`\n${usage}`);
    }
    return 1;
  }
}

process.exitCode = await runVerifyLayerDocCli(process.argv.slice(2));
