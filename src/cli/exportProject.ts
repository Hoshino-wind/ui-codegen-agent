#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

import { createProjectExportPackage } from "../exporters/projectPackage.js";
import { writeProjectExportPackage } from "../exporters/projectPackageWriter.js";
import type { LayerDoc } from "../layerdoc/types.js";
import { validateLayerDoc } from "../layerdoc/validation.js";

interface ExportProjectCliOptions {
  inputPath: string;
  outputDir: string;
  componentName: string;
  packageName?: string;
}

interface ParsedArgs {
  options?: ExportProjectCliOptions;
  help: boolean;
}

class CliError extends Error {
  constructor(message: string, readonly showUsage = false) {
    super(message);
  }
}

const usage = `Usage: layerdoc-export-project --input <layerdoc.json> --out <directory> --component <ComponentName> [--package <package-name>]

Options:
  --input <layerdoc.json>   LayerDoc JSON file to export.
  --out <directory>         Target directory for the project package.
  --component <ComponentName>
                             PascalCase React component name.
  --package <package-name>  Optional package name written to manifest.json.
  -h, --help                Show this help.
`;

function readOptionValue(args: string[], index: number, name: string): { value: string; nextIndex: number } {
  const equalsPrefix = `${name}=`;
  const current = args[index];
  if (current.startsWith(equalsPrefix)) {
    return { value: current.slice(equalsPrefix.length), nextIndex: index + 1 };
  }

  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new CliError(`Missing value for ${name}.`, true);
  }

  return { value, nextIndex: index + 2 };
}

function parseArgs(args: string[]): ParsedArgs {
  const values: Partial<ExportProjectCliOptions> = {};
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

    if (arg === "--component" || arg.startsWith("--component=")) {
      const option = readOptionValue(args, index, "--component");
      values.componentName = option.value;
      index = option.nextIndex;
      continue;
    }

    if (arg === "--package" || arg.startsWith("--package=")) {
      const option = readOptionValue(args, index, "--package");
      values.packageName = option.value;
      index = option.nextIndex;
      continue;
    }

    throw new CliError(`Unknown argument: ${arg}.`, true);
  }

  const inputPath = values.inputPath;
  const outputDir = values.outputDir;
  const componentName = values.componentName;

  if (!inputPath || !outputDir || !componentName) {
    const missing = [
      !inputPath && "--input <layerdoc.json>",
      !outputDir && "--out <directory>",
      !componentName && "--component <ComponentName>"
    ].filter(Boolean);
    throw new CliError(`Missing required argument(s): ${missing.join(", ")}.`, true);
  }

  return {
    help: false,
    options: {
      inputPath,
      outputDir,
      componentName,
      packageName: values.packageName
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLayerDocCandidate(value: unknown): value is LayerDoc {
  return (
    isRecord(value) &&
    value.schema === "layerdoc" &&
    value.version === "0.1.0" &&
    isRecord(value.canvas) &&
    Array.isArray(value.sections) &&
    Array.isArray(value.layers) &&
    Array.isArray(value.assets) &&
    Array.isArray(value.components) &&
    Array.isArray(value.interactions) &&
    isRecord(value.responsive) &&
    isRecord(value.verification)
  );
}

function readLayerDoc(inputPath: string): LayerDoc {
  const raw = readFileSync(inputPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (!isLayerDocCandidate(parsed)) {
    throw new CliError("Input file is not a LayerDoc 0.1.0 document.");
  }

  const validation = validateLayerDoc(parsed);
  if (!validation.valid) {
    const messages = validation.issues.map((issue) => `- ${issue.path}: ${issue.message}`).join("\n");
    throw new CliError(`LayerDoc validation failed:\n${messages}`);
  }

  return parsed;
}

export function runExportProjectCli(args: string[]): number {
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
    const doc = readLayerDoc(inputPath);
    const projectPackage = createProjectExportPackage(doc, {
      componentName: options.componentName,
      packageName: options.packageName
    });
    const written = writeProjectExportPackage(projectPackage, outputDir);

    process.stdout.write(`${JSON.stringify({
      packageName: projectPackage.manifest.packageName,
      componentName: projectPackage.manifest.componentName,
      rootDir: written.rootDir,
      files: written.files.map((file) => file.relativePath)
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

process.exitCode = runExportProjectCli(process.argv.slice(2));
