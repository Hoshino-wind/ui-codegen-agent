import { classifyLayer } from "../layerdoc/classification.js";
import { createLayerDoc } from "../layerdoc/factory.js";
import type {
  AssetNode,
  Canvas,
  ComponentNode,
  LayerDoc,
  LayerKind,
  LayerNode,
  Rect,
  SectionNode
} from "../layerdoc/types.js";

export interface ImageManifestAssetInput {
  id: string;
  uri?: string;
  source?: AssetNode["source"];
  type?: AssetNode["type"];
}

export interface ImageManifestLayerInput {
  id: string;
  kind: LayerKind;
  bounds: Rect;
  text?: string;
  alt?: string;
  editable?: boolean;
  asset?: ImageManifestAssetInput;
}

export interface ImageManifestSectionInput {
  id: string;
  name: string;
  bounds: Rect;
  layers: ImageManifestLayerInput[];
}

export interface ImageAnalysisManifest {
  name: string;
  sourceImage: {
    uri: string;
    width: number;
    height: number;
  };
  canvas?: Canvas;
  sections: ImageManifestSectionInput[];
}

export interface ImageManifestImportOptions {
  enforceHomepageRange?: boolean;
}

function toPascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function createAsset(layer: ImageManifestLayerInput): AssetNode | undefined {
  if (!layer.asset) {
    return undefined;
  }

  return {
    id: layer.asset.id,
    type: layer.asset.type ?? "image",
    source: layer.asset.source ?? "reference-crop",
    uri: layer.asset.uri,
    bounds: { ...layer.bounds }
  };
}

function createLayer(section: ImageManifestSectionInput, layer: ImageManifestLayerInput): LayerNode {
  const asset = createAsset(layer);

  return {
    id: layer.id,
    sectionId: section.id,
    kind: layer.kind,
    track: classifyLayer(layer),
    editable: layer.editable ?? true,
    bounds: { ...layer.bounds },
    assetId: asset?.id,
    content: {
      ...(layer.text ? { text: layer.text } : {}),
      ...(layer.alt ? { alt: layer.alt } : {})
    }
  };
}

function createSection(section: ImageManifestSectionInput): SectionNode {
  return {
    id: section.id,
    name: section.name,
    bounds: { ...section.bounds },
    layerIds: section.layers.map((layer) => layer.id)
  };
}

function createComponent(section: ImageManifestSectionInput): ComponentNode {
  return {
    id: `${toPascalCase(section.id || section.name)}Section`,
    layerIds: section.layers.filter((layer) => classifyLayer(layer) === "component").map((layer) => layer.id),
    exportable: true
  };
}

function assertHomepageRange(sections: ImageManifestSectionInput[]): void {
  if (sections.length < 8 || sections.length > 15) {
    throw new Error(`Homepage MVP expects 8-15 sections, received ${sections.length}.`);
  }
}

/**
 * Convert an image-analysis manifest into LayerDoc.
 * The manifest is the boundary between visual analysis and production assets:
 * image models, crop tools, or human review can all feed this shape while the
 * editor/exporter/verifier continue to depend only on LayerDoc.
 */
export function createLayerDocFromImageManifest(
  manifest: ImageAnalysisManifest,
  options: ImageManifestImportOptions = {}
): LayerDoc {
  if (options.enforceHomepageRange ?? true) {
    assertHomepageRange(manifest.sections);
  }

  const layers = manifest.sections.flatMap((section) => section.layers.map((layer) => createLayer(section, layer)));
  const assets = manifest.sections.flatMap((section) => section.layers.map(createAsset).filter((asset): asset is AssetNode => Boolean(asset)));

  return createLayerDoc({
    name: manifest.name,
    canvas: manifest.canvas ?? {
      width: manifest.sourceImage.width,
      height: manifest.sourceImage.height
    },
    sections: manifest.sections.map(createSection),
    layers,
    assets,
    components: manifest.sections.map(createComponent).filter((component) => component.layerIds.length > 0)
  });
}
