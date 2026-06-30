import assert from "node:assert/strict";
import test from "node:test";

import { createForeignObjectSnapshotSvg, inlineHtmlImageSources, renderHtmlPreviewSnapshot } from "../dist/app/htmlPreviewSnapshot.js";
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

test("renderHtmlPreviewSnapshot rasterizes the deterministic HTML preview through an SVG image", async () => {
  const drawnImages = [];
  const createdUrls = [];
  const revokedUrls = [];
  const pixels = new Uint8ClampedArray([255, 255, 255, 255, 8, 148, 118, 255]);

  const snapshot = await renderHtmlPreviewSnapshot(
    {
      html: '<body><main data-layerdoc="0.1.0"><h1>HTML candidate</h1></main></body>',
      canvas: { width: 2, height: 1, background: "#ffffff" }
    },
    {
      createImage: () => {
        const image = {};
        Object.defineProperty(image, "src", {
          set(value) {
            image.assignedSource = value;
            queueMicrotask(() => image.onload?.());
          }
        });
        return image;
      },
      createCanvas: (width, height) => ({
        width,
        height,
        getContext: () => ({
          drawImage: (image, x, y) => drawnImages.push({ image, x, y }),
          getImageData: () => ({ width, height, data: pixels })
        })
      }),
      createObjectUrl: (blob) => {
        createdUrls.push(blob);
        return "blob:html-preview";
      },
      revokeObjectUrl: (url) => revokedUrls.push(url)
    }
  );

  assert.equal(snapshot.width, 2);
  assert.equal(snapshot.height, 1);
  assert.deepEqual([...snapshot.data], [...pixels]);
  assert.equal(drawnImages.length, 1);
  assert.equal(drawnImages[0].image.assignedSource, "blob:html-preview");
  assert.equal(createdUrls.length, 1);
  assert.equal(createdUrls[0].type, "image/svg+xml;charset=utf-8");
  assert.deepEqual(revokedUrls, ["blob:html-preview"]);
});

test("renderHtmlPreviewSnapshot reports browser canvas security failures clearly", async () => {
  await assert.rejects(
    () =>
      renderHtmlPreviewSnapshot(
        {
          html: '<body><main data-layerdoc="0.1.0"><h1>HTML candidate</h1></main></body>',
          canvas: { width: 1, height: 1, background: "#ffffff" }
        },
        {
          createImage: () => {
            const image = {};
            Object.defineProperty(image, "src", {
              set() {
                queueMicrotask(() => image.onload?.());
              }
            });
            return image;
          },
          createCanvas: (width, height) => ({
            width,
            height,
            getContext: () => ({
              drawImage: () => undefined,
              getImageData: () => {
                throw new DOMException("The canvas has been tainted by cross-origin data.", "SecurityError");
              }
            })
          }),
          createObjectUrl: () => "blob:tainted-html-preview",
          revokeObjectUrl: () => undefined
        }
      ),
    /HTML preview screenshot cannot be read/
  );
});
