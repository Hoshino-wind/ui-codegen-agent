#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import process from "node:process";

import { createProjectExportPackage } from "../exporters/projectPackage.js";
import { writeProjectExportPackage } from "../exporters/projectPackageWriter.js";
import { parseHomepageAnalysisPlanJson, type HomepageAnalysisPlan } from "../importers/homepageAnalysisPlan.js";
import { createHomepageLayerDocFromPng } from "../importers/homepagePngPipeline.js";
import { runLayerDocPreviewVerification } from "../verifier/previewRun.js";
import { runLayerDocVerification } from "../verifier/run.js";
import { CliError, readOptionValue } from "./shared.js";

interface HomepagePipelineCliOptions {
  inputPath: string;
  outputDir: string;
  componentName: string;
  name?: string;
  packageName?: string;
  analysisPlanPath?: string;
  candidatePath?: string;
  browserExecutablePath?: string;
  failOnQuality?: boolean;
}

interface ParsedArgs {
  options?: HomepagePipelineCliOptions;
  help: boolean;
}

const usage = `Usage: layerdoc-run-homepage --input <homepage.png> --out <directory> --component <ComponentName> [--candidate <candidate.png>]

Options:
  --input <homepage.png>       Source AI-generated homepage PNG.
  --out <directory>            Output root for intake, verification, project, and pipeline-report.json.
  --component <ComponentName>  PascalCase React component name for project export.
  --name <name>                Optional LayerDoc/import name. Defaults to the PNG file name.
  --package <package-name>     Optional package name written to project/manifest.json.
  --analysis-plan <plan.json>  Optional confirmed homepage Analysis Plan from a model, editor, or human review.
  --candidate <candidate.png>  Optional rendered candidate PNG. If omitted, Playwright renders preview.html.
  --browser <executable>       Optional browser executable path for Playwright preview rendering.
  --fail-on-quality            Exit 2 when verifier quality gates fail.
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
  const values: Partial<HomepagePipelineCliOptions> = {};
  let index = 0;

  while (index < args.length) {
    const arg = args[index];
    if (arg === "-h" || arg === "--help") {
      return { help: true };
    }

    if (arg === "--fail-on-quality") {
      values.failOnQuality = true;
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

    if (arg === "--analysis-plan" || arg.startsWith("--analysis-plan=")) {
      const option = readOptionValue(args, index, "--analysis-plan");
      values.analysisPlanPath = option.value;
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

    throw new CliError(`Unknown argument: ${arg}.`, true);
  }

  const inputPath = values.inputPath;
  const outputDir = values.outputDir;
  const componentName = values.componentName;
  if (!inputPath || !outputDir || !componentName) {
    const missing = [
      !inputPath && "--input <homepage.png>",
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
      name: values.name,
      packageName: values.packageName,
      analysisPlanPath: values.analysisPlanPath,
      candidatePath: values.candidatePath,
      browserExecutablePath: values.browserExecutablePath,
      failOnQuality: values.failOnQuality
    }
  };
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readAnalysisPlan(path: string): HomepageAnalysisPlan {
  return parseHomepageAnalysisPlanJson(readFileSync(path, "utf8"));
}

function copyDirectory(sourceDir: string, targetDir: string): string[] {
  if (!existsSync(sourceDir)) {
    return [];
  }

  const copied: string[] = [];
  mkdirSync(targetDir, { recursive: true });

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);
    if (entry.isDirectory()) {
      for (const nested of copyDirectory(sourcePath, targetPath)) {
        copied.push(join(entry.name, nested));
      }
      continue;
    }

    copyFileSync(sourcePath, targetPath);
    copied.push(entry.name);
  }

  return copied;
}

function verificationScores(run: Awaited<ReturnType<typeof runLayerDocPreviewVerification>> | ReturnType<typeof runLayerDocVerification>) {
  return {
    visualSimilarity: run.report.visualSimilarity,
    structureScore: run.report.structureScore,
    componentScore: run.report.componentScore,
    projectFitScore: run.report.projectFitScore
  };
}

export async function runHomepagePipelineCli(args: string[]): Promise<number> {
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
    const sourceAnalysisPlanPath = options.analysisPlanPath ? resolve(options.analysisPlanPath) : undefined;
    const sourceAnalysisPlan = sourceAnalysisPlanPath ? readAnalysisPlan(sourceAnalysisPlanPath) : undefined;
    const intakeDir = join(outputDir, "intake");
    const intakeAssetDir = join(intakeDir, "assets");
    const verificationDir = join(outputDir, "verification");
    const projectDir = join(outputDir, "project");
    const projectReferencePath = join(projectDir, "reference.png");
    const projectAssetDir = join(projectDir, "assets");
    const projectPublicAssetDir = join(projectDir, "public", "assets");
    const pipelineReportPath = join(outputDir, "pipeline-report.json");
    const analysisPlanPath = join(intakeDir, "analysis-plan.json");
    const imageManifestPath = join(intakeDir, "image-manifest.json");
    const layerDocPath = join(intakeDir, "layerdoc.json");
    const verificationReportPath = join(verificationDir, "report.json");
    const diffPath = join(verificationDir, "diff.png");

    const intake = createHomepageLayerDocFromPng({
      name: options.name ?? sourceAnalysisPlan?.name ?? defaultNameFor(inputPath),
      sourcePngPath: inputPath,
      analysisPlan: sourceAnalysisPlan,
      analysisPlanUri: sourceAnalysisPlanPath,
      assetOutputDir: intakeAssetDir,
      publicAssetBaseUri: "assets"
    });
    mkdirSync(intakeDir, { recursive: true });
    writeJson(analysisPlanPath, intake.analysisPlan);
    writeJson(imageManifestPath, intake.imageManifest);
    writeJson(layerDocPath, intake.layerDoc);

    mkdirSync(verificationDir, { recursive: true });
    const verification = options.candidatePath
      ? runLayerDocVerification({
        doc: intake.layerDoc,
        referencePath: inputPath,
        candidatePath: resolve(options.candidatePath),
        diffPath
      })
      : await runLayerDocPreviewVerification({
        doc: intake.layerDoc,
        referencePath: inputPath,
        outputDir: verificationDir,
        diffPath,
        browserExecutablePath: options.browserExecutablePath ? resolve(options.browserExecutablePath) : undefined
      });
    writeJson(verificationReportPath, verification);

    const projectPackage = createProjectExportPackage(intake.layerDoc, {
      componentName: options.componentName,
      packageName: options.packageName,
      report: verification.report
    });
    const writtenProject = writeProjectExportPackage(projectPackage, projectDir);
    copyFileSync(inputPath, projectReferencePath);
    const previewAssets = copyDirectory(intakeAssetDir, projectAssetDir).map((file) => join("assets", file));
    const publicAssets = copyDirectory(intakeAssetDir, projectPublicAssetDir).map((file) => join("public", "assets", file));
    const copiedAssets = [...previewAssets, ...publicAssets];

    const pipelineReport = {
      name: intake.layerDoc.metadata.name,
      sourcePngPath: inputPath,
      outputDir,
      intake: {
        analysisPlanPath,
        imageManifestPath,
        layerDocPath,
        assetDir: intakeAssetDir,
        analysisPlanSource: sourceAnalysisPlanPath ? "provided" : "seeded",
        ...(sourceAnalysisPlanPath ? { sourceAnalysisPlanPath } : {}),
        sectionCount: intake.layerDoc.sections.length,
        layerCount: intake.layerDoc.layers.length,
        assetCount: intake.layerDoc.assets.length,
        analysisPlanAudit: intake.analysisPlanAudit
      },
      verification: {
        reportPath: verificationReportPath,
        passed: verification.passed,
        scores: verificationScores(verification),
        failures: verification.failures,
        artifacts: verification.artifacts
      },
      project: {
        rootDir: writtenProject.rootDir,
        referencePath: projectReferencePath,
        files: writtenProject.files.map((file) => file.relativePath),
        copiedAssets
      }
    };
    writeJson(pipelineReportPath, pipelineReport);

    process.stdout.write(`${JSON.stringify({
      name: pipelineReport.name,
      passed: verification.passed,
      paths: {
        pipelineReport: pipelineReportPath,
        layerDoc: layerDocPath,
        project: projectDir,
        verificationReport: verificationReportPath
      },
      scores: pipelineReport.verification.scores
    }, null, 2)}\n`);

    return options.failOnQuality && !verification.passed ? 2 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    if (error instanceof CliError && error.showUsage) {
      process.stderr.write(`\n${usage}`);
    }
    return 1;
  }
}

process.exitCode = await runHomepagePipelineCli(process.argv.slice(2));
