import assert from "node:assert/strict";
import test from "node:test";

import { createForeignObjectSnapshotSvg, inlineHtmlImageSources } from "../dist/app/htmlPreviewSnapshot.js";
import { createEditorWorkspace } from "../dist/app/editorWorkspace.js";
import { createSampleHomepageLayerDoc } from "../dist/app/sampleDocument.js";

test("createForeignObjectSnapshotSvg wraps HTML preview markup in a fixed-size SVG capture surface", () => {
  const workspace = createEditorWorkspace(createSampleHomepageLayerDoc());
  const svg = createForeignObjectSnapshotSvg({
    html: workspace.previewHtml,
    canvas: workspace.doc.canvas
  });

  assert.match(svg, /^<svg /);
  assert.match(svg, /width="1440"/);
  assert.match(svg, /height="1760"/);
  assert.match(svg, /<foreignObject /);
  assert.match(svg, /xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/);
  assert.match(svg, /data-layerdoc="0\.1\.0"/);
  assert.match(svg, /data-layer-id="hero-title"/);
});

test("inlineHtmlImageSources replaces preview image src values before SVG rasterization", async () => {
  const html = '<main><img data-layer-id="hero-image" src="/assets/hero-reference.svg" alt="Hero" /></main>';

  const result = await inlineHtmlImageSources(html, async (source) => `data:image/mock;base64,${Buffer.from(source).toString("base64")}`);

  assert.match(result, /src="data:image\/mock;base64/);
  assert.doesNotMatch(result, /src="\/assets\/hero-reference\.svg"/);
  assert.match(result, /data-layer-id="hero-image"/);
});
