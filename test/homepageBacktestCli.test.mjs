import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const rootDir = process.cwd();
const cliPath = join(rootDir, "dist", "cli", "homepageBacktest.js");

test("homepage backtest CLI generates a mock visual and verifies the full production chain", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-homepage-backtest-"));
  const outputDir = join(directory, "backtest");

  const result = spawnSync(process.execPath, [
    cliPath,
    "--out",
    outputDir,
    "--component",
    "BacktestHomepage",
    "--name",
    "Backtest Homepage"
  ], { cwd: rootDir, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  const report = JSON.parse(readFileSync(join(outputDir, "backtest-report.json"), "utf8"));
  const pipelineReport = JSON.parse(readFileSync(join(outputDir, "pipeline", "pipeline-report.json"), "utf8"));
  const productionManifest = JSON.parse(readFileSync(join(outputDir, "pipeline", "project", "production-manifest.json"), "utf8"));

  assert.equal(summary.scenario, "mock-homepage-e2e");
  assert.equal(summary.passed, true);
  assert.equal(summary.paths.backtestReport, join(outputDir, "backtest-report.json"));
  assert.equal(summary.paths.pipelineReport, join(outputDir, "pipeline", "pipeline-report.json"));
  assert.equal(summary.paths.project, join(outputDir, "pipeline", "project"));
  assert.equal(report.scenario, "mock-homepage-e2e");
  assert.equal(report.pipeline.exitCode, 0);
  assert.equal(report.pipeline.summary.passed, true);
  assert.equal(report.project.verification.passed, true);
  assert.equal(report.project.verification.commands.includes("node scripts/verify-production-manifest.mjs"), true);
  assert.equal(pipelineReport.project.verification.results.some((entry) => entry.command === "node scripts/verify-production-manifest.mjs"), true);
  assert.equal(productionManifest.role, "project_integration_manifest");
  assert.equal(productionManifest.generated.react.component, "BacktestHomepage");
  assert.equal(existsSync(join(outputDir, "source.png")), true);
  assert.equal(existsSync(join(outputDir, "candidate.png")), true);
  assert.equal(existsSync(join(outputDir, "pipeline", "intake", "layerdoc.json")), true);
  assert.equal(existsSync(join(outputDir, "pipeline", "project", "src", "BacktestHomepage.tsx")), true);
  assert.equal(existsSync(join(outputDir, "pipeline", "project", "scripts", "verify-production-manifest.mjs")), true);
});

test("homepage backtest CLI rejects missing output directory with usage guidance", () => {
  const result = spawnSync(process.execPath, [cliPath], { cwd: rootDir, encoding: "utf8" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage: layerdoc-backtest-homepage/);
  assert.match(result.stderr, /--out <directory>/);
});

test("package scripts expose the homepage backtest entrypoint", () => {
  const packageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));

  assert.equal(packageJson.scripts["backtest:homepage"], "node dist/cli/homepageBacktest.js");
});
