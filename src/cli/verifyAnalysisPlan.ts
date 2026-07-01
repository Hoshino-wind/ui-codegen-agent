#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

import { PNG } from "pngjs";

import {
  createHomepageAnalysisPlanAudit,
  parseHomepageAnalysisPlanJson,
  type HomepageAnalysisPlan
} from "../importers/homepageAnalysisPlan.js";
import { CliError, readOptionValue } from "./shared.js";

interface VerifyAnalysisPlanCliOptions {
  inputPath: string;
  outputDir?: string;
  sourcePngPath?: string;
}

interface ParsedArgs {
  options?: VerifyAnalysisPlanCliOptions;
  help: boolean;
}

const usage = `Usage: layerdoc-verify-analysis-plan --input <analysis-plan.json> [--source <homepage.png>] [--out <directory>]

Options:
  --input <analysis-plan.json>  Homepage Analysis Plan JSON to verify.
  --source <homepage.png>       Optional source PNG; canvas must match plan canvas.
  --out <directory>             Optional directory for analysis-plan-audit.json.
  -h, --help                    Show this help.
`;

function parseArgs(args: string[]): ParsedArgs {
  const values: Partial<VerifyAnalysisPlanCliOptions> = {};
  let index = 0;

  while (index < args.length) {
    const arg = args[index];
    if (arg === "-h" || arg === "--help") {
      return { help: true };
    }

    if (arg === "--input" || arg.startsWith("--input=")) {
      const option = readOptionValue(args, index, "--input");
      values.inputPath = option.value;
      index = option.nextIndex;
      continue;
    }

    if (arg === "--source" || arg.startsWith("--source=")) {
      const option = readOptionValue(args, index, "--source");
      values.sourcePngPath = option.value;
      index = option.nextIndex;
      continue;
    }

    if (arg === "--out" || arg.startsWith("--out=")) {
      const option = readOptionValue(args, index, "--out");
      values.outputDir = option.value;
      index = option.nextIndex;
      continue;
    }

    throw new CliError(`Unknown argument: ${arg}.`, true);
  }

  const inputPath = values.inputPath;
  if (!inputPath) {
    throw new CliError("Missing required argument(s): --input <analysis-plan.json>.", true);
  }

  return {
    help: false,
    options: {
      inputPath,
      outputDir: values.outputDir,
      sourcePngPath: values.sourcePngPath
    }
  };
}

function readAnalysisPlan(path: string): HomepageAnalysisPlan {
  return parseHomepageAnalysisPlanJson(readFileSync(path, "utf8"));
}

function readPngCanvas(path: string): { width: number; height: number } {
  const png = PNG.sync.read(readFileSync(path));
  return {
    width: png.width,
    height: png.height
  };
}

function assertPlanCanvasMatchesSource(plan: HomepageAnalysisPlan, canvas: { width: number; height: number }): void {
  if (plan.canvas.width !== canvas.width || plan.canvas.height !== canvas.height) {
    throw new Error(`Analysis Plan canvas ${plan.canvas.width}x${plan.canvas.height} must match source PNG ${canvas.width}x${canvas.height}.`);
  }
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function runVerifyAnalysisPlanCli(args: string[]): number {
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
    const sourcePngPath = options.sourcePngPath ? resolve(options.sourcePngPath) : undefined;
    const outputDir = options.outputDir ? resolve(options.outputDir) : undefined;
    const auditPath = outputDir ? join(outputDir, "analysis-plan-audit.json") : undefined;
    const plan = readAnalysisPlan(inputPath);

    if (sourcePngPath) {
      assertPlanCanvasMatchesSource(plan, readPngCanvas(sourcePngPath));
    }

    const audit = createHomepageAnalysisPlanAudit(plan);
    if (outputDir && auditPath) {
      mkdirSync(outputDir, { recursive: true });
      writeJson(auditPath, audit);
    }

    const passed = audit.readiness.readyForLayerDoc;
    process.stdout.write(`${JSON.stringify({
      passed,
      name: plan.name,
      inputPath,
      ...(sourcePngPath ? { sourcePngPath } : {}),
      ...(auditPath ? { paths: { audit: auditPath } } : {}),
      sectionCount: audit.summary.sections,
      layerCount: audit.summary.layers,
      tracks: audit.tracks,
      blockers: audit.readiness.blockers
    }, null, 2)}\n`);

    return passed ? 0 : 2;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    if (error instanceof CliError && error.showUsage) {
      process.stderr.write(`\n${usage}`);
    }
    return 1;
  }
}

process.exitCode = runVerifyAnalysisPlanCli(process.argv.slice(2));
