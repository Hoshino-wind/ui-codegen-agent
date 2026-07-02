#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import process from "node:process";

import { PNG } from "pngjs";

import { createHomepageAnalysisPlanJsonSchema } from "../importers/homepageAnalysisPlan.js";
import { createHomepageAnalysisTask } from "../importers/homepageAnalysisTask.js";
import { CliError, readOptionValue } from "./shared.js";

interface CreateAnalysisTaskCliOptions {
  inputPath: string;
  outputDir: string;
  name?: string;
}

interface ParsedArgs {
  options?: CreateAnalysisTaskCliOptions;
  help: boolean;
}

const taskFileName = "analysis-task.json";
const schemaFileName = "analysis-plan.schema.json";

const usage = `Usage: layerdoc-create-analysis-task --input <homepage.png> --out <directory> [--name <name>]

Options:
  --input <homepage.png>  Source AI-generated homepage PNG.
  --out <directory>      Output directory for analysis-task.json and analysis-plan.schema.json.
  --name <name>          Optional task name. Defaults to the PNG file name.
  -h, --help             Show this help.
`;

function parseArgs(args: string[]): ParsedArgs {
  const values: Partial<CreateAnalysisTaskCliOptions> = {};
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

    if (arg === "--out" || arg.startsWith("--out=")) {
      const option = readOptionValue(args, index, "--out");
      values.outputDir = option.value;
      index = option.nextIndex;
      continue;
    }

    if (arg === "--name" || arg.startsWith("--name=")) {
      const option = readOptionValue(args, index, "--name");
      values.name = option.value;
      index = option.nextIndex;
      continue;
    }

    throw new CliError(`Unknown argument: ${arg}.`, true);
  }

  const inputPath = values.inputPath;
  const outputDir = values.outputDir;
  if (!inputPath || !outputDir) {
    const missing = [
      inputPath ? null : "--input <homepage.png>",
      outputDir ? null : "--out <directory>"
    ].filter((value): value is string => Boolean(value));
    throw new CliError(`Missing required argument(s): ${missing.join(", ")}.`, true);
  }

  return {
    help: false,
    options: {
      inputPath,
      outputDir,
      name: values.name
    }
  };
}

function readPngCanvas(path: string): { width: number; height: number } {
  // The intake step only records canvas facts; section/layer semantics are
  // supplied later by a vision worker or controlled manual review.
  const png = PNG.sync.read(readFileSync(path));
  return {
    width: png.width,
    height: png.height
  };
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function runCreateAnalysisTaskCli(args: string[]): number {
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
    const outputDir = resolve(options.outputDir);
    const canvas = readPngCanvas(inputPath);
    const task = createHomepageAnalysisTask({
      name: options.name ?? basename(inputPath),
      sourceImage: {
        uri: inputPath,
        ...canvas
      },
      outputSchemaFile: schemaFileName
    });
    const taskPath = join(outputDir, taskFileName);
    const schemaPath = join(outputDir, schemaFileName);

    mkdirSync(outputDir, { recursive: true });
    writeJson(taskPath, task);
    writeJson(schemaPath, createHomepageAnalysisPlanJsonSchema());

    process.stdout.write(`${JSON.stringify({
      created: true,
      kind: task.kind,
      name: task.name,
      sourceImage: task.sourceImage,
      paths: {
        task: taskPath,
        schema: schemaPath
      },
      outputContract: task.outputContract
    }, null, 2)}\n`);

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    if (error instanceof CliError && error.showUsage) {
      process.stderr.write(`\n${usage}`);
    }
    return 1;
  }
}

process.exitCode = runCreateAnalysisTaskCli(process.argv.slice(2));
