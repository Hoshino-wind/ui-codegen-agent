import type { AssetNode, LayerDoc, LayerNode, LayerStyle, Rect, SectionNode } from "../layerdoc/types.js";

export type LayerBoundsPatch = Partial<Rect>;
export type ImageAssetPatch = Pick<Partial<AssetNode>, "uri" | "source">;

function cloneLayer(layer: LayerNode): LayerNode {
  return {
    ...layer,
    bounds: { ...layer.bounds },
    style: layer.style ? { ...layer.style, padding: layer.style.padding ? { ...layer.style.padding } : undefined } : undefined,
    content: layer.content ? { ...layer.content } : undefined
  };
}

function cloneSection(section: SectionNode): SectionNode {
  return {
    ...section,
    bounds: { ...section.bounds },
    layerIds: [...section.layerIds]
  };
}

function cloneDoc(doc: LayerDoc): LayerDoc {
  return {
    ...doc,
    canvas: { ...doc.canvas },
    tokens: {
      colors: { ...doc.tokens.colors },
      typography: { ...doc.tokens.typography },
      spacing: { ...doc.tokens.spacing },
      radii: { ...doc.tokens.radii }
    },
    sections: doc.sections.map(cloneSection),
    layers: doc.layers.map(cloneLayer),
    assets: doc.assets.map((asset) => ({ ...asset, bounds: asset.bounds ? { ...asset.bounds } : undefined })),
    components: doc.components.map((component) => ({ ...component, layerIds: [...component.layerIds] })),
    interactions: doc.interactions.map((interaction) => ({ ...interaction })),
    responsive: {
      breakpoints: { ...doc.responsive.breakpoints },
      rules: doc.responsive.rules.map((rule) => ({ ...rule, changes: { ...rule.changes } }))
    },
    verification: {
      scores: { ...doc.verification.scores },
      issues: doc.verification.issues.map((issue) => ({ ...issue }))
    }
  };
}

function findEditableLayer(doc: LayerDoc, layerId: string): LayerNode {
  const layer = doc.layers.find((candidate) => candidate.id === layerId);

  if (!layer) {
    throw new Error(`Layer "${layerId}" was not found.`);
  }
  if (!layer.editable) {
    throw new Error(`Layer "${layerId}" is not editable.`);
  }

  return layer;
}

/**
 * Update an editable text layer while preserving the original document.
 * Editor operations are pure so preview, undo, verifier, and code export can
 * all consume the same LayerDoc state without hidden side effects.
 */
export function updateTextLayer(doc: LayerDoc, layerId: string, text: string): LayerDoc {
  const next = cloneDoc(doc);
  const layer = findEditableLayer(next, layerId);

  if (layer.kind !== "text" && layer.kind !== "button") {
    throw new Error(`Layer "${layerId}" is "${layer.kind}", not editable copy.`);
  }

  layer.content = { ...(layer.content ?? {}), text };
  return next;
}

/**
 * Patch a layer's controlled visual style.
 * The editor exposes named fields rather than arbitrary CSS so exported code
 * can stay auditable and verifier-friendly.
 */
export function updateLayerStyle(doc: LayerDoc, layerId: string, style: LayerStyle): LayerDoc {
  const next = cloneDoc(doc);
  const layer = findEditableLayer(next, layerId);

  layer.style = {
    ...(layer.style ?? {}),
    ...style,
    padding: style.padding ? { ...(layer.style?.padding ?? {}), ...style.padding } : layer.style?.padding
  };
  return next;
}

/**
 * Patch the bounds of an editable layer for controlled spacing and sizing UI.
 * Invalid geometry is rejected here so broken LayerDoc states do not reach the
 * preview, exporter, or verifier.
 */
export function updateLayerBounds(doc: LayerDoc, layerId: string, bounds: LayerBoundsPatch): LayerDoc {
  const next = cloneDoc(doc);
  const layer = findEditableLayer(next, layerId);
  const nextBounds = { ...layer.bounds, ...bounds };

  if (nextBounds.width <= 0 || nextBounds.height <= 0) {
    throw new Error(`Layer "${layerId}" bounds must have positive width and height.`);
  }
  if (
    nextBounds.x < 0 ||
    nextBounds.y < 0 ||
    nextBounds.x + nextBounds.width > next.canvas.width ||
    nextBounds.y + nextBounds.height > next.canvas.height
  ) {
    throw new Error(`Layer "${layerId}" bounds must stay within the canvas.`);
  }

  layer.bounds = nextBounds;
  return next;
}

/**
 * Replace the asset behind an editable image layer without changing the layer
 * identity. This keeps references stable for selection, history, and verifier
 * annotations while allowing the operator to swap imagery.
 */
export function updateImageLayerAsset(doc: LayerDoc, layerId: string, asset: ImageAssetPatch): LayerDoc {
  const next = cloneDoc(doc);
  const layer = findEditableLayer(next, layerId);

  if (layer.kind !== "image") {
    throw new Error(`Layer "${layerId}" is "${layer.kind}", not image.`);
  }
  if (!layer.assetId) {
    throw new Error(`Layer "${layerId}" does not reference an asset.`);
  }

  const target = next.assets.find((candidate) => candidate.id === layer.assetId);
  if (!target) {
    throw new Error(`Asset "${layer.assetId}" was not found.`);
  }

  if (asset.uri !== undefined) {
    target.uri = asset.uri;
  }
  if (asset.source !== undefined) {
    target.source = asset.source;
  }
  return next;
}

/**
 * Move a section to a new position in the document order.
 * This operation intentionally moves only the section reference; layer
 * membership stays attached to the section and can be re-laid out later.
 */
export function moveSection(doc: LayerDoc, sectionId: string, targetIndex: number): LayerDoc {
  const next = cloneDoc(doc);
  const currentIndex = next.sections.findIndex((section) => section.id === sectionId);

  if (currentIndex === -1) {
    throw new Error(`Section "${sectionId}" was not found.`);
  }

  const [section] = next.sections.splice(currentIndex, 1);
  const boundedIndex = Math.max(0, Math.min(targetIndex, next.sections.length));
  next.sections.splice(boundedIndex, 0, section);
  return next;
}
