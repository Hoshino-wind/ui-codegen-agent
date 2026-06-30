import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const rootDir = process.cwd();

test("index.html references an existing favicon asset", () => {
  const html = readFileSync(join(rootDir, "index.html"), "utf8");

  assert.match(html, /rel="icon"/);
  assert.match(html, /href="\/favicon\.svg"/);
  assert.equal(existsSync(join(rootDir, "public", "favicon.svg")), true);
});

test("app shell exposes LayerDoc load and save actions", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /Load LayerDoc/);
  assert.match(source, /Save LayerDoc/);
  assert.match(source, /accept="application\/json,\.json"/);
});

test("app shell exposes a project package export action", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /Export Project/);
  assert.match(source, /createProjectPackageDownload/);
});

test("app shell exposes verifier problem areas in the editor surface", () => {
  const source = readFileSync(join(rootDir, "src", "app", "App.tsx"), "utf8");

  assert.match(source, /createProblemAreaAnnotations/);
  assert.match(source, /problem-area-overlay/);
  assert.match(source, /Problem areas/);
});
