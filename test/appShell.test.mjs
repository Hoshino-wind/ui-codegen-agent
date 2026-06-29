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
