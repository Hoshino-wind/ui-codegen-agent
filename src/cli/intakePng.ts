#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import process from "node:process";

import { createHomepageLayerDocFromPng } from "../importers/homepagePngPipeline.js";
import { CliError, readOptionValue } from "./shared.js";

interface IntakePngCliOptions {
  inputPath: string;
  outputDir: string;
  name?: string;
  publicAssetBaseUri?: string;
  canvasBackground?: string;
  seedAnnotations?: boolean;
}

interface ParsedArgs {
  options?: IntakePngCliOptions;
  help: boolean;
}

const usage = `Usage: layerdoc-intake-png --input <homepage.png> --out <directory> [--name <name>]

Options:
  --input <homepage.png>       Source AI-generated homepage PNG.
  --out <directory>            Output directory for analysis-plan.json, image-manifest.json, layerdoc.json, and assets.
  --name <name>                Optional LayerDoc/import name. Defaults to the PNG file name.
  --public-assets <uri>        Asset URI prefix written into LayerDoc. Defaults to assets.
  --background <css-color>     Optional canvas background token.
  --no-seed                    Emit only the 8-section scaffold without default layers.
  -h, --help                   Show this help.
`;

function defaultNameFor(inputPath: string): string {
  const file = basename(inputPath, extname(inputPath));
  return file
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Imported Homepage";
}

function parseArgs(args: string[]): ParsedArgs {
  const values: Partial<IntakePngCliOptions> = {};
  let index = 0;

  while (index < args.length) {
    const arg = args[index];
    if (arg === "-h" || arg === "--help") {
      return { help: true };
    }

    if (arg === "--no-seed") {
      values.seedAnnotations = false;
      index += 1;
      continue;
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

    if (arg === "--public-assets" || arg.startsWith("--public-assets=")) {
      const option = readOptionValue(args, index, "--public-assets");
      values.publicAssetBaseUri = option.value;
      index = option.nextIndex;
      continue;
    }

    if (arg === "--background" || arg.startsWith("--background=")) {
      const option = readOptionValue(args, index, "--background");
      values.canvasBackground = option.value;
      index = option.nextIndex;
      continue;
    }

    throw new CliError(`Unknown argument: ${arg}.`, true);
  }

  const inputPath = values.inputPath;
  const outputDir = values.outputDir;
  if (!inputPath || !outputDir) {
    const missing = [
      !inputPath && "--input <homepage.png>",
      !outputDir && "--out <directory>"
    ].filter(Boolean);
    throw new CliError(`Missing required argument(s): ${missing.join(", ")}.`, true);
  }

  return {
    help: false,
    options: {
      inputPath,
      outputDir,
      name: values.name,
      publicAssetBaseUri: values.publicAssetBaseUri,
      canvasBackground: values.canvasBackground,
      seedAnnotations: values.seedAnnotations
    }
  };
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function runIntakePngCli(args: string[]): number {
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
    const assetDir = join(outputDir, "assets");
    const analysisPlanPath = join(outputDir, "analysis-plan.json");
    const imageManifestPath = join(outputDir, "image-manifest.json");
    const layerDocPath = join(outputDir, "layerdoc.json");
    const result = createHomepageLayerDocFromPng({
      name: options.name ?? defaultNameFor(inputPath),
      sourcePngPath: inputPath,
      assetOutputDir: assetDir,
      publicAssetBaseUri: options.publicAssetBaseUri ?? "assets",
      canvasBackground: options.canvasBackground,
      seedAnnotations: options.seedAnnotations
    });

    mkdirSync(outputDir, { recursive: true });
    writeJson(analysisPlanPath, result.analysisPlan);
    writeJson(imageManifestPath, result.imageManifest);
    writeJson(layerDocPath, result.layerDoc);

    process.stdout.write(`${JSON.stringify({
      name: result.layerDoc.metadata.name,
      sourcePngPath: inputPath,
      outputDir,
      analysisPlanPath,
      imageManifestPath,
      layerDocPath,
      assetDir,
      sectionCount: result.layerDoc.sections.length,
      layerCount: result.layerDoc.layers.length,
      assetCount: result.layerDoc.assets.length
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

process.exitCode = runIntakePngCli(process.argv.slice(2));
