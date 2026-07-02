import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { PNG } from "pngjs";

function writeSourcePng(path) {
  const png = new PNG({ width: 320, height: 960 });
  for (let index = 0; index < png.data.length; index += 4) {
    png.data[index] = 248;
    png.data[index + 1] = 250;
    png.data[index + 2] = 252;
    png.data[index + 3] = 255;
  }
  writeFileSync(path, PNG.sync.write(png));
}

test("analysis task CLI writes a model-ready homepage decomposition package", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-analysis-task-"));
  const inputPath = join(directory, "homepage.png");
  const outputDir = join(directory, "task");
  writeSourcePng(inputPath);

  const result = spawnSync(
    process.execPath,
    ["dist/cli/createAnalysisTask.js", "--input", inputPath, "--out", outputDir, "--name", "Generated homepage"],
    { encoding: "utf8" }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"kind": "homepage-png-analysis"/);
  assert.equal(existsSync(join(outputDir, "analysis-task.json")), true);
  assert.equal(existsSync(join(outputDir, "analysis-plan.schema.json")), true);

  const task = JSON.parse(readFileSync(join(outputDir, "analysis-task.json"), "utf8"));
  const schema = JSON.parse(readFileSync(join(outputDir, "analysis-plan.schema.json"), "utf8"));

  assert.equal(task.name, "Generated homepage");
  assert.deepEqual(task.sourceImage, { uri: inputPath, width: 320, height: 960 });
  assert.equal(task.outputContract.schemaFile, "analysis-plan.schema.json");
  assert.equal(task.outputContract.minSections, 8);
  assert.equal(task.outputContract.maxSections, 15);
  assert.equal(task.constraints.includes("Do not use the full PNG as one page-sized bitmap layer."), true);
  assert.equal(schema.title, "HomepageAnalysisPlan 0.1.0");
});

test("analysis task CLI rejects missing required arguments with usage guidance", () => {
  const result = spawnSync(process.execPath, ["dist/cli/createAnalysisTask.js"], { encoding: "utf8" });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing required argument/);
  assert.match(result.stderr, /--input <homepage.png>/);
  assert.match(result.stderr, /--out <directory>/);
});
