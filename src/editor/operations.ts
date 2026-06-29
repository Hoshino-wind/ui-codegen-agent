import type { LayerDoc, LayerNode, SectionNode } from "../layerdoc/types.js";

function cloneLayer(layer: LayerNode): LayerNode {
  return {
    ...layer,
    bounds: { ...layer.bounds },
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

/**
 * Update an editable text layer while preserving the original document.
 * Editor operations are pure so preview, undo, verifier, and code export can
 * all consume the same LayerDoc state without hidden side effects.
 */
export function updateTextLayer(doc: LayerDoc, layerId: string, text: string): LayerDoc {
  const next = cloneDoc(doc);
  const layer = next.layers.find((candidate) => candidate.id === layerId);

  if (!layer) {
    throw new Error(`Layer "${layerId}" was not found.`);
  }
  if (layer.kind !== "text") {
    throw new Error(`Layer "${layerId}" is "${layer.kind}", not text.`);
  }
  if (!layer.editable) {
    throw new Error(`Layer "${layerId}" is not editable.`);
  }

  layer.content = { ...(layer.content ?? {}), text };
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
