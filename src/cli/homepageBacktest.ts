#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

import { PNG } from "pngjs";

import { CliError, readOptionValue } from "./shared.js";

interface HomepageBacktestCliOptions {
  outputDir: string;
  componentName: string;
  name: string;
  packageName?: string;
  width: number;
  height: number;
}

interface ParsedArgs {
  options?: HomepageBacktestCliOptions;
  help: boolean;
}

const usage = `Usage: layerdoc-backtest-homepage --out <directory>

Options:
  --out <directory>            Output root for source PNG, candidate PNG, pipeline artifacts, and backtest-report.json.
  --component <ComponentName>  PascalCase React component name. Defaults to ProductionHomepage.
  --name <name>                Mock homepage name. Defaults to Mock Homepage Backtest.
  --package <package-name>     Optional package name written to the exported project manifest.
  --width <pixels>             Mock visual width. Defaults to 960.
  --height <pixels>            Mock visual height. Defaults to 1200.
  -h, --help                   Show this help.
`;

function parsePositiveInteger(value: string, optionName: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || String(parsed) !== value) {
    throw new CliError(`${optionName} must be a positive integer.`, true);
  }
  return parsed;
}

function parseArgs(args: string[]): ParsedArgs {
  const values: Partial<HomepageBacktestCliOptions> = {};
  let index = 0;

  while (index < args.length) {
    const arg = args[index];
    if (arg === "-h" || arg === "--help") {
      return { help: true };
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

    if (arg === "--name" || arg.startsWith("--name=")) {
      const option = readOptionValue(args, index, "--name");
      values.name = option.value;
      index = option.nextIndex;
      continue;
    }

    if (arg === "--package" || arg.startsWith("--package=")) {
      const option = readOptionValue(args, index, "--package");
      values.packageName = option.value;
      index = option.nextIndex;
      continue;
    }

    if (arg === "--width" || arg.startsWith("--width=")) {
      const option = readOptionValue(args, index, "--width");
      values.width = parsePositiveInteger(option.value, "--width");
      index = option.nextIndex;
      continue;
    }

    if (arg === "--height" || arg.startsWith("--height=")) {
      const option = readOptionValue(args, index, "--height");
      values.height = parsePositiveInteger(option.value, "--height");
      index = option.nextIndex;
      continue;
    }

    throw new CliError(`Unknown argument: ${arg}.`, true);
  }

  if (!values.outputDir) {
    throw new CliError("Missing required argument(s): --out <directory>.", true);
  }

  return {
    help: false,
    options: {
      outputDir: values.outputDir,
      componentName: values.componentName ?? "ProductionHomepage",
      name: values.name ?? "Mock Homepage Backtest",
      packageName: values.packageName,
      width: values.width ?? 960,
      height: values.height ?? 1200
    }
  };
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function setPixel(png: PNG, x: number, y: number, color: [number, number, number, number]): void {
  const index = (png.width * y + x) << 2;
  png.data[index] = color[0];
  png.data[index + 1] = color[1];
  png.data[index + 2] = color[2];
  png.data[index + 3] = color[3];
}

function fillRect(png: PNG, x: number, y: number, width: number, height: number, color: [number, number, number, number]): void {
  const startX = Math.max(0, Math.floor(x));
  const startY = Math.max(0, Math.floor(y));
  const endX = Math.min(png.width, Math.ceil(x + width));
  const endY = Math.min(png.height, Math.ceil(y + height));

  for (let yy = startY; yy < endY; yy += 1) {
    for (let xx = startX; xx < endX; xx += 1) {
      setPixel(png, xx, yy, color);
    }
  }
}

function writeMockHomepagePng(path: string, width: number, height: number): void {
  const png = new PNG({ width, height });
  const sectionHeight = height / 8;

  // The backtest visual is intentionally deterministic: it gives the pipeline
  // a stable "AI visual" without depending on a network image model.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const vertical = y / Math.max(1, height - 1);
      const horizontal = x / Math.max(1, width - 1);
      const band = Math.floor(y / sectionHeight);
      const warmBand = band % 2 === 0;
      setPixel(png, x, y, [
        clampChannel((warmBand ? 246 : 235) - vertical * 18 + horizontal * 10),
        clampChannel((warmBand ? 248 : 243) - vertical * 10),
        clampChannel((warmBand ? 250 : 247) + horizontal * 4),
        255
      ]);
    }
  }

  for (let section = 0; section < 8; section += 1) {
    const y = Math.round(section * sectionHeight);
    const gutter = Math.max(24, Math.round(width * 0.065));
    const blockWidth = Math.round(width * (section === 0 ? 0.43 : 0.34));
    fillRect(png, gutter, y + Math.round(sectionHeight * 0.24), blockWidth, 14, [30, 42, 62, 255]);
    fillRect(png, gutter, y + Math.round(sectionHeight * 0.42), Math.round(blockWidth * 0.82), 8, [96, 113, 136, 255]);
    fillRect(png, gutter, y + Math.round(sectionHeight * 0.55), Math.round(blockWidth * 0.55), 8, [122, 137, 158, 255]);

    const cardX = width - gutter - Math.round(width * 0.28);
    const cardY = y + Math.round(sectionHeight * 0.16);
    fillRect(png, cardX, cardY, Math.round(width * 0.28), Math.round(sectionHeight * 0.62), [255, 255, 255, 255]);
    fillRect(png, cardX + 16, cardY + 18, Math.round(width * 0.18), 10, [20, 184, 166, 255]);
    fillRect(png, cardX + 16, cardY + 42, Math.round(width * 0.21), 8, [35, 52, 74, 255]);
    fillRect(png, cardX + 16, cardY + 64, Math.round(width * 0.15), 8, [142, 156, 178, 255]);
  }

  writeFileSync(path, PNG.sync.write(png));
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function runPipeline(args: string[]) {
  const pipelineCliPath = fileURLToPath(new URL("./homepagePipeline.js", import.meta.url));
  return spawnSync(process.execPath, [pipelineCliPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
}

export function runHomepageBacktestCli(args: string[]): number {
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

    const outputDir = resolve(options.outputDir);
    const sourcePath = join(outputDir, "source.png");
    const candidatePath = join(outputDir, "candidate.png");
    const pipelineDir = join(outputDir, "pipeline");
    const backtestReportPath = join(outputDir, "backtest-report.json");
    mkdirSync(outputDir, { recursive: true });
    writeMockHomepagePng(sourcePath, options.width, options.height);
    writeMockHomepagePng(candidatePath, options.width, options.height);

    const pipelineArgs = [
      "--input",
      sourcePath,
      "--candidate",
      candidatePath,
      "--out",
      pipelineDir,
      "--name",
      options.name,
      "--component",
      options.componentName,
      "--verify-project"
    ];
    if (options.packageName) {
      pipelineArgs.push("--package", options.packageName);
    }

    const pipeline = runPipeline(pipelineArgs);
    if (pipeline.status !== 0) {
      throw new Error(`Homepage pipeline backtest failed:\n${pipeline.stderr || pipeline.stdout}`);
    }

    const pipelineSummary = JSON.parse(pipeline.stdout) as { passed: boolean };
    const pipelineReportPath = join(pipelineDir, "pipeline-report.json");
    const pipelineReport = readJson(pipelineReportPath) as {
      project?: {
        rootDir?: string;
        verification?: {
          results?: Array<{ command: string; status: number | null }>;
        };
      };
    };
    const verificationResults = pipelineReport.project?.verification?.results ?? [];
    const projectVerificationPassed = verificationResults.length > 0 && verificationResults.every((entry) => entry.status === 0);
    const report = {
      scenario: "mock-homepage-e2e",
      source: {
        kind: "deterministic-mock-png",
        sourcePath,
        candidatePath,
        width: options.width,
        height: options.height
      },
      pipeline: {
        exitCode: pipeline.status,
        args: pipelineArgs,
        summary: pipelineSummary,
        reportPath: pipelineReportPath
      },
      project: {
        rootDir: pipelineReport.project?.rootDir ?? join(pipelineDir, "project"),
        verification: {
          passed: projectVerificationPassed,
          commands: verificationResults.map((entry) => entry.command)
        }
      },
      passed: pipelineSummary.passed && projectVerificationPassed
    };
    writeJson(backtestReportPath, report);

    process.stdout.write(`${JSON.stringify({
      scenario: report.scenario,
      passed: report.passed,
      paths: {
        backtestReport: backtestReportPath,
        sourcePng: sourcePath,
        candidatePng: candidatePath,
        pipelineReport: pipelineReportPath,
        project: report.project.rootDir
      },
      projectVerification: report.project.verification
    }, null, 2)}\n`);
    return report.passed ? 0 : 2;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    if (error instanceof CliError && error.showUsage) {
      process.stderr.write(`\n${usage}`);
    }
    return 1;
  }
}

process.exitCode = runHomepageBacktestCli(process.argv.slice(2));
