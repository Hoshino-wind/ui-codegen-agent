import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { PNG } from "pngjs";

import type { AssetNode, LayerKind, LayerStyle, Rect } from "../layerdoc/types.js";
import { assertHomepageSectionCoverage, type ImageAnalysisManifest, type ImageManifestSectionInput } from "./imageManifest.js";

export interface PngIntakeAssetPlan {
  id: string;
  fileName?: string;
  cropBounds?: Rect;
  uri?: string;
  source?: AssetNode["source"];
  type?: AssetNode["type"];
}

export interface PngIntakeLayerPlan {
  id: string;
  kind: LayerKind;
  bounds: Rect;
  text?: string;
  alt?: string;
  style?: LayerStyle;
  editable?: boolean;
  asset?: PngIntakeAssetPlan;
}

export interface PngIntakeSectionPlan {
  id: string;
  name: string;
  bounds: Rect;
  layers: PngIntakeLayerPlan[];
}

export interface PngIntakeInput {
  name: string;
  sourcePngPath: string;
  sections: PngIntakeSectionPlan[];
  assetOutputDir?: string;
  publicAssetBaseUri?: string;
  canvasBackground?: string;
}

function readPng(path: string): PNG {
  return PNG.sync.read(readFileSync(path));
}

function assertHomepageSectionRange(sections: PngIntakeSectionPlan[]): void {
  if (sections.length < 8 || sections.length > 15) {
    throw new Error(`Homepage PNG intake expects 8-15 sections, received ${sections.length}.`);
  }
}

function assertPositiveRect(rect: Rect, label: string): void {
  if (rect.width <= 0 || rect.height <= 0) {
    throw new Error(`${label} must have positive width and height.`);
  }
}

function assertRectInsideSource(rect: Rect, source: PNG, assetId: string): void {
  assertPositiveRect(rect, `Crop bounds for asset "${assetId}"`);

  if (rect.x < 0 || rect.y < 0 || rect.x + rect.width > source.width || rect.y + rect.height > source.height) {
    throw new Error(`Crop bounds for asset "${assetId}" must stay inside the source PNG.`);
  }
}

function cropPng(source: PNG, bounds: Rect): PNG {
  const crop = new PNG({ width: bounds.width, height: bounds.height });

  for (let y = 0; y < bounds.height; y += 1) {
    for (let x = 0; x < bounds.width; x += 1) {
      const sourceIndex = (source.width * (bounds.y + y) + bounds.x + x) << 2;
      const targetIndex = (bounds.width * y + x) << 2;
      crop.data[targetIndex] = source.data[sourceIndex];
      crop.data[targetIndex + 1] = source.data[sourceIndex + 1];
      crop.data[targetIndex + 2] = source.data[sourceIndex + 2];
      crop.data[targetIndex + 3] = source.data[sourceIndex + 3];
    }
  }

  return crop;
}

function assetFileName(asset: PngIntakeAssetPlan): string {
  return asset.fileName ?? `${asset.id}.png`;
}

function assetUri(baseUri: string | undefined, fileName: string): string {
  if (!baseUri) {
    return fileName;
  }
  return `${baseUri.replace(/\/$/, "")}/${fileName}`;
}

function cropAsset(source: PNG, layer: PngIntakeLayerPlan, input: PngIntakeInput): PngIntakeLayerPlan {
  if (!layer.asset) {
    return layer;
  }

  const cropBounds = layer.asset.cropBounds ?? layer.bounds;
  assertRectInsideSource(cropBounds, source, layer.asset.id);

  const fileName = assetFileName(layer.asset);
  if (input.assetOutputDir) {
    mkdirSync(input.assetOutputDir, { recursive: true });
    writeFileSync(join(input.assetOutputDir, fileName), PNG.sync.write(cropPng(source, cropBounds)));
  }

  return {
    ...layer,
    asset: {
      id: layer.asset.id,
      type: layer.asset.type ?? "image",
      source: layer.asset.source ?? "reference-crop",
      uri: assetUri(input.publicAssetBaseUri, fileName)
    }
  };
}

function cloneLayerStyle(style: LayerStyle | undefined): LayerStyle | undefined {
  return style
    ? {
        ...style,
        ...(style.padding ? { padding: { ...style.padding } } : {})
      }
    : undefined;
}

function createManifestSection(source: PNG, section: PngIntakeSectionPlan, input: PngIntakeInput): ImageManifestSectionInput {
  return {
    id: section.id,
    name: section.name,
    bounds: { ...section.bounds },
    layers: section.layers.map((layer) => {
      const cropped = cropAsset(source, layer, input);
      return {
        id: cropped.id,
        kind: cropped.kind,
        bounds: { ...cropped.bounds },
        text: cropped.text,
        alt: cropped.alt,
        style: cloneLayerStyle(cropped.style),
        editable: cropped.editable,
        asset: cropped.asset
      };
    })
  };
}

/**
 * Convert a real PNG plus an analysis plan into the ImageAnalysisManifest
 * boundary. This is intentionally not computer vision: a model, human review,
 * or detector supplies section/layer semantics while this module owns image
 * dimensions and deterministic reference-crop assets.
 */
export function createImageManifestFromPng(input: PngIntakeInput): ImageAnalysisManifest {
  assertHomepageSectionRange(input.sections);
  assertHomepageSectionCoverage(input.sections, "Homepage PNG intake");
  const source = readPng(input.sourcePngPath);

  return {
    name: input.name,
    sourceImage: {
      uri: basename(input.sourcePngPath),
      width: source.width,
      height: source.height
    },
    canvas: {
      width: source.width,
      height: source.height,
      background: input.canvasBackground
    },
    sections: input.sections.map((section) => createManifestSection(source, section, input))
  };
}
