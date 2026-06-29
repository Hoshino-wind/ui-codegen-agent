import assert from "node:assert/strict";
import test from "node:test";

import { createLayerDocDownload, createReactExportDownload, createWorkspaceFromLayerDocJson } from "../dist/app/layerDocFile.js";
import { createSampleHomepageLayerDoc } from "../dist/app/sampleDocument.js";

test("createWorkspaceFromLayerDocJson imports a valid LayerDoc into the editor workspace", () => {
  const doc = createSampleHomepageLayerDoc();
  const workspace = createWorkspaceFromLayerDocJson(JSON.stringify(doc));

  assert.equal(workspace.doc.metadata.name, doc.metadata.name);
  assert.equal(workspace.doc.layers.length, doc.layers.length);
  assert.equal(workspace.selectedLayerId, "hero-title");
  assert.match(workspace.previewHtml, /data-layer-id="hero-title"/);
  assert.match(workspace.reactExport.code, /export function ProductionHomepage/);
});

test("createWorkspaceFromLayerDocJson rejects malformed or invalid LayerDoc JSON", () => {
  assert.throws(() => createWorkspaceFromLayerDocJson("{bad json"), /LayerDoc JSON could not be parsed/);
  assert.throws(() => createWorkspaceFromLayerDocJson(JSON.stringify({ schema: "html" })), /Input file is not a LayerDoc 0.1.0 document/);

  const invalid = createSampleHomepageLayerDoc();
  invalid.layers[0] = {
    ...invalid.layers[0],
    bounds: { ...invalid.layers[0].bounds, width: -1 }
  };
  assert.throws(() => createWorkspaceFromLayerDocJson(JSON.stringify(invalid)), /LayerDoc validation failed/);
});

test("createLayerDocDownload serializes the current editable LayerDoc as a stable JSON artifact", () => {
  const doc = createSampleHomepageLayerDoc();
  const artifact = createLayerDocDownload(doc);
  const parsed = JSON.parse(artifact.contents);

  assert.equal(artifact.fileName, "layerdoc.json");
  assert.equal(artifact.mimeType, "application/json");
  assert.equal(parsed.schema, "layerdoc");
  assert.equal(parsed.layers.length, doc.layers.length);
  assert.match(artifact.contents, /"schema": "layerdoc"/);
  assert.equal(artifact.contents.endsWith("\n"), true);
});

test("createReactExportDownload serializes the current React Tailwind export as a TSX artifact", () => {
  const workspace = createWorkspaceFromLayerDocJson(JSON.stringify(createSampleHomepageLayerDoc()));
  const artifact = createReactExportDownload(workspace);

  assert.equal(artifact.fileName, "ProductionHomepage.tsx");
  assert.equal(artifact.mimeType, "text/plain;charset=utf-8");
  assert.match(artifact.contents, /export function ProductionHomepage/);
  assert.match(artifact.contents, /data-layerdoc-version/);
  assert.equal(artifact.contents.endsWith("\n"), true);
});
