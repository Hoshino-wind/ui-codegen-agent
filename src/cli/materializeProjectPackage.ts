#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

import { parseProjectExportPackageJson, writeProjectExportPackage } from "../exporters/projectPackageWriter.js";
import { CliError, readOptionValue } from "./shared.js";

interface MaterializeProjectPackageCliOptions {
  inputPath: string;
  outputDir: string;
  verifyHandoff: boolean;
}

const usage = `Usage: layerdoc-materialize-project --input <project-package.json> --out <directory>

Options:
  --input <project-package.json>  Studio JSON handoff package to materialize.
  --out <directory>              Target directory for the project package.
  --verify-handoff               Run scripts/verify-handoff.mjs after writing files.
  -h, --help                     Show this help.
`;

interface ParsedArgs {
  options?: MaterializeProjectPackageCliOptions;
  help: boolean;
}

function parseArgs(args: string[]): ParsedArgs {
  const values: Partial<MaterializeProjectPackageCliOptions> = {};
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

    if (arg === "--verify-handoff") {
      values.verifyHandoff = true;
      index += 1;
      continue;
    }

    throw new CliError(`Unknown argument: ${arg}.`, true);
  }

  const inputPath = values.inputPath;
  const outputDir = values.outputDir;
  if (!inputPath || !outputDir) {
    const missing = [
      !inputPath && "--input <project-package.json>",
      !outputDir && "--out <directory>"
    ].filter(Boolean);
    throw new CliError(`Missing required argument(s): ${missing.join(", ")}.`, true);
  }

  return {
    help: false,
    options: { inputPath, outputDir, verifyHandoff: values.verifyHandoff ?? false }
  };
}

function verifyHandoff(rootDir: string) {
  const command = "node scripts/verify-handoff.mjs";
  const result = spawnSync(process.execPath, ["scripts/verify-handoff.mjs"], {
    cwd: rootDir,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(`Materialized project handoff verification failed:\n${result.stderr || result.stdout}`);
  }

  return {
    command,
    status: result.status,
    result: JSON.parse(result.stdout)
  };
}

export function runMaterializeProjectPackageCli(args: string[]): number {
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
    const projectPackage = parseProjectExportPackageJson(readFileSync(inputPath, "utf8"));
    const written = writeProjectExportPackage(projectPackage, outputDir);
    const verification = options.verifyHandoff ? verifyHandoff(outputDir) : undefined;

    process.stdout.write(`${JSON.stringify({
      packageName: projectPackage.manifest.packageName,
      componentName: projectPackage.manifest.componentName,
      rootDir: written.rootDir,
      files: written.files.map((file) => file.relativePath),
      ...(verification ? { verification } : {})
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

process.exitCode = runMaterializeProjectPackageCli(process.argv.slice(2));
