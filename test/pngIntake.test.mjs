import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { PNG } from "pngjs";

import { createImageManifestFromPng, createLayerDocFromImageManifest, validateLayerDoc } from "../dist/index.js";

function writeSourcePng(path) {
  const png = new PNG({ width: 80, height: 80 });

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (png.width * y + x) << 2;
      const inHeroAsset = x >= 40 && x < 60 && y >= 8 && y < 28;
      png.data[index] = inHeroAsset ? 20 : 248;
      png.data[index + 1] = inHeroAsset ? 184 : 250;
      png.data[index + 2] = inHeroAsset ? 166 : 252;
      png.data[index + 3] = 255;
    }
  }

  writeFileSync(path, PNG.sync.write(png));
}

function section(index) {
  return {
    id: `section-${index}`,
    name: `Section ${index}`,
    bounds: { x: 0, y: index * 10, width: 80, height: 10 },
    layers: [
      {
        id: `section-${index}-title`,
        kind: "text",
        bounds: { x: 4, y: index * 10 + 2, width: 30, height: 4 },
        text: `Title ${index}`
      }
    ]
  };
}

test("createImageManifestFromPng reads PNG dimensions and crops referenced image assets", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-png-intake-"));
  const sourcePngPath = join(directory, "homepage.png");
  const assetOutputDir = join(directory, "assets");
  writeSourcePng(sourcePngPath);

  const manifest = createImageManifestFromPng({
    name: "Imported homepage",
    sourcePngPath,
    assetOutputDir,
    publicAssetBaseUri: "/assets/imported",
    sections: [
      {
        id: "hero",
        name: "Hero",
        bounds: { x: 0, y: 0, width: 80, height: 10 },
        layers: [
          {
            id: "hero-title",
            kind: "text",
            bounds: { x: 4, y: 2, width: 30, height: 4 },
            text: "Imported hero"
          },
          {
            id: "hero-image",
            kind: "image",
            bounds: { x: 40, y: 1, width: 20, height: 8 },
            alt: "Hero crop",
            asset: {
              id: "hero-crop",
              fileName: "hero-crop.png",
              cropBounds: { x: 40, y: 8, width: 20, height: 20 }
            }
          }
        ]
      },
      ...Array.from({ length: 7 }, (_, index) => section(index + 1))
    ]
  });

  const cropPath = join(assetOutputDir, "hero-crop.png");
  const crop = PNG.sync.read(readFileSync(cropPath));
  const doc = createLayerDocFromImageManifest(manifest);

  assert.equal(manifest.sourceImage.width, 80);
  assert.equal(manifest.sourceImage.height, 80);
  assert.equal(manifest.sections.length, 8);
  assert.equal(manifest.sections[0].layers[1].asset.uri, "/assets/imported/hero-crop.png");
  assert.equal(existsSync(cropPath), true);
  assert.equal(crop.width, 20);
  assert.equal(crop.height, 20);
  assert.deepEqual([...crop.data.slice(0, 4)], [20, 184, 166, 255]);
  assert.equal(validateLayerDoc(doc).valid, true);
});

test("createImageManifestFromPng rejects crop bounds outside the source PNG", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-png-intake-"));
  const sourcePngPath = join(directory, "homepage.png");
  writeSourcePng(sourcePngPath);

  assert.throws(
    () =>
      createImageManifestFromPng({
        name: "Bad crop",
        sourcePngPath,
        assetOutputDir: join(directory, "assets"),
        sections: [
          {
            id: "hero",
            name: "Hero",
            bounds: { x: 0, y: 0, width: 80, height: 10 },
            layers: [
              {
                id: "hero-image",
                kind: "image",
                bounds: { x: 70, y: 0, width: 20, height: 20 },
                asset: { id: "bad-crop", cropBounds: { x: 70, y: 0, width: 20, height: 20 } }
              }
            ]
          },
          ...Array.from({ length: 7 }, (_, index) => section(index + 1))
        ]
      }),
    /Crop bounds for asset "bad-crop" must stay inside the source PNG/
  );
});

test("createImageManifestFromPng enforces the homepage MVP section range", () => {
  const directory = mkdtempSync(join(tmpdir(), "layerdoc-png-intake-"));
  const sourcePngPath = join(directory, "homepage.png");
  writeSourcePng(sourcePngPath);

  assert.throws(
    () =>
      createImageManifestFromPng({
        name: "Too few sections",
        sourcePngPath,
        sections: [section(1), section(2)]
      }),
    /Homepage PNG intake expects 8-15 sections/
  );
});
