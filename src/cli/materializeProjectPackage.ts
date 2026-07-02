#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

import {
  verifyProjectHandoff,
  verifyProjectPreview,
  verifyProjectQuality,
  verifyProjectStructure
} from "../exporters/projectPackageVerification.js";
import { parseProjectExportPackageJson, writeProjectExportPackage } from "../exporters/projectPackageWriter.js";
import { CliError, readOptionValue } from "./shared.js";

interface MaterializeProjectPackageCliOptions {
  inputPath: string;
  outputDir: string;
  verifyHandoff: boolean;
  verifyStructure: boolean;
  verifyQuality: boolean;
  verifyPreview: boolean;
  candidatePath?: string;
  referencePath?: string;
  previewOutDir?: string;
  previewThreshold?: string;
  browserPath?: string;
  includeAA: boolean;
}

const usage = `Usage: layerdoc-materialize-project --input <project-package.json> --out <directory>

Options:
  --input <project-package.json>  Studio JSON handoff package to materialize.
  --out <directory>              Target directory for the project package.
  --verify-handoff               Run scripts/verify-handoff.mjs after writing files.
  --verify-structure             Run production manifest, handoff, source, LayerDoc, and contract verifiers.
  --verify-quality               Run structure verifiers and generated quality gates.
  --verify-preview               Run preview visual diff, structure verifiers, and quality gates.
  --candidate <candidate.png>    Candidate PNG for --verify-preview; omitted values use Playwright.
  --reference <reference.png>    Optional reference PNG override for --verify-preview.
  --preview-out <directory>      Optional preview artifact directory inside the project.
  --threshold <0-1>              Optional preview pixelmatch threshold.
  --browser <executable>         Optional Playwright browser executable for screenshot capture.
  --include-aa                   Include anti-aliased pixels in preview diff.
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

    if (arg === "--verify-structure") {
      values.verifyStructure = true;
      index += 1;
      continue;
    }

    if (arg === "--verify-quality") {
      values.verifyQuality = true;
      index += 1;
      continue;
    }

    if (arg === "--verify-preview") {
      values.verifyPreview = true;
      index += 1;
      continue;
    }

    if (arg === "--candidate" || arg.startsWith("--candidate=")) {
      const option = readOptionValue(args, index, "--candidate");
      values.candidatePath = option.value;
      index = option.nextIndex;
      continue;
    }

    if (arg === "--reference" || arg.startsWith("--reference=")) {
      const option = readOptionValue(args, index, "--reference");
      values.referencePath = option.value;
      index = option.nextIndex;
      continue;
    }

    if (arg === "--preview-out" || arg.startsWith("--preview-out=")) {
      const option = readOptionValue(args, index, "--preview-out");
      values.previewOutDir = option.value;
      index = option.nextIndex;
      continue;
    }

    if (arg === "--threshold" || arg.startsWith("--threshold=")) {
      const option = readOptionValue(args, index, "--threshold");
      values.previewThreshold = option.value;
      index = option.nextIndex;
      continue;
    }

    if (arg === "--browser" || arg.startsWith("--browser=")) {
      const option = readOptionValue(args, index, "--browser");
      values.browserPath = option.value;
      index = option.nextIndex;
      continue;
    }

    if (arg === "--include-aa") {
      values.includeAA = true;
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
    options: {
      inputPath,
      outputDir,
      verifyHandoff: values.verifyHandoff ?? false,
      verifyStructure: values.verifyStructure ?? false,
      verifyQuality: values.verifyQuality ?? false,
      verifyPreview: values.verifyPreview ?? false,
      candidatePath: values.candidatePath,
      referencePath: values.referencePath,
      previewOutDir: values.previewOutDir,
      previewThreshold: values.previewThreshold,
      browserPath: values.browserPath,
      includeAA: values.includeAA ?? false
    }
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
    const verification = options.verifyPreview
      ? verifyProjectPreview(outputDir, options)
      : options.verifyQuality
      ? verifyProjectQuality(outputDir)
      : options.verifyStructure
        ? verifyProjectStructure(outputDir)
        : options.verifyHandoff
          ? verifyProjectHandoff(outputDir)
          : undefined;

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
