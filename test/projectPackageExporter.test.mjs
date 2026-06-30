import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createLayerDoc,
  createProjectExportPackage,
  writeProjectExportPackage
} from "../dist/index.js";

function createExportDoc() {
  return createLayerDoc({
    name: "Production Homepage",
    canvas: { width: 1440, height: 900, background: "#ffffff" },
    sections: [{ id: "hero", name: "Hero", bounds: { x: 0, y: 0, width: 1440, height: 900 }, layerIds: ["headline", "cta"] }],
    components: [{ id: "HeroSection", layerIds: ["headline", "cta"], exportable: true }],
    layers: [
      {
        id: "headline",
        sectionId: "hero",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 120, y: 120, width: 620, height: 96 },
        content: { text: "LayerDoc first" }
      },
      {
        id: "cta",
        sectionId: "hero",
        kind: "button",
        track: "component",
        editable: true,
        bounds: { x: 120, y: 260, width: 180, height: 48 },
        content: { text: "Export React" }
      }
    ]
  });
}

test("createProjectExportPackage returns project-ready files derived from one LayerDoc", () => {
  const doc = createExportDoc();
  const output = createProjectExportPackage(doc, { componentName: "ProductionHomepage" });
  const paths = output.files.map((file) => file.path).sort();

  assert.equal(output.manifest.packageName, "production-homepage");
  assert.equal(output.manifest.componentName, "ProductionHomepage");
  assert.deepEqual(paths, [
    "README.md",
    "index.html",
    "layerdoc.json",
    "manifest.json",
    "package.json",
    "preview.html",
    "src/App.tsx",
    "src/index.css",
    "src/main.tsx",
    "src/ProductionHomepage.tsx",
    "tsconfig.json",
    "vite.config.ts"
  ].sort());
  assert.deepEqual(output.manifest.files.sort(), paths);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"scripts"/);
  assert.match(output.files.find((file) => file.path === "package.json").contents, /"dev": "vite"/);
  assert.match(output.files.find((file) => file.path === "src\/main.tsx").contents, /createRoot/);
  assert.match(output.files.find((file) => file.path === "src\/App.tsx").contents, /<ProductionHomepage \/>/);
  assert.match(output.files.find((file) => file.path === "src\/index.css").contents, /@import "tailwindcss"/);
  assert.match(output.files.find((file) => file.path === "vite.config.ts").contents, /@vitejs\/plugin-react/);
  assert.match(output.files.find((file) => file.path === "tsconfig.json").contents, /"jsx": "react-jsx"/);
  assert.match(output.files.find((file) => file.path === "src/ProductionHomepage.tsx").contents, /export function ProductionHomepage/);
  assert.match(output.files.find((file) => file.path === "layerdoc.json").contents, /"schema": "layerdoc"/);
  assert.match(output.files.find((file) => file.path === "preview.html").contents, /data-layerdoc="0.1.0"/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm install/);
  assert.match(output.files.find((file) => file.path === "README.md").contents, /npm run dev/);
});

test("writeProjectExportPackage writes every package file under the target directory", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-project-export-"));
  const output = createProjectExportPackage(createExportDoc(), { componentName: "ProductionHomepage" });

  const written = writeProjectExportPackage(output, directory);

  assert.equal(written.files.length, 12);
  assert.equal(existsSync(join(directory, "src", "ProductionHomepage.tsx")), true);
  assert.equal(existsSync(join(directory, "src", "main.tsx")), true);
  assert.equal(existsSync(join(directory, "package.json")), true);
  assert.equal(existsSync(join(directory, "vite.config.ts")), true);
  assert.equal(existsSync(join(directory, "manifest.json")), true);
  assert.match(readFileSync(join(directory, "src", "ProductionHomepage.tsx"), "utf8"), /LayerDoc first/);
  assert.match(readFileSync(join(directory, "src", "App.tsx"), "utf8"), /ProductionHomepage/);
  assert.deepEqual(
    written.files.map((file) => file.relativePath).sort(),
    output.files.map((file) => file.path).sort()
  );
});
