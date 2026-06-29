#!/usr/bin/env node
import { resolve } from "node:path";
import process from "node:process";

import { createProjectExportPackage } from "../exporters/projectPackage.js";
import { writeProjectExportPackage } from "../exporters/projectPackageWriter.js";
import { CliError, readLayerDocFile, readOptionValue } from "./shared.js";

interface ExportProjectCliOptions {
  inputPath: string;
  outputDir: string;
  componentName: string;
  packageName?: string;
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

interface ParsedArgs {
  options?: ExportProjectCliOptions;
  help: boolean;
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
    const doc = readLayerDocFile(inputPath);
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
