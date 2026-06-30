import type { AssetNode, InteractionNode, LayerDoc, LayerNode, LayerStyle, Rect, SectionNode } from "../layerdoc/types.js";

export type LayerBoundsPatch = Partial<Rect>;
export type ImageAssetPatch = Pick<Partial<AssetNode>, "uri" | "source">;
export interface SectionRegenerationRequestInput {
  prompt: string;
  requestedAt?: string;
}

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
    metadata: {
      ...doc.metadata,
      ...(doc.metadata.sourceImage ? { sourceImage: { ...doc.metadata.sourceImage } } : {})
    },
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
    generation: {
      sectionRequests: doc.generation.sectionRequests.map((request) => ({ ...request }))
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

function buttonClickInteractionId(layerId: string, interactions: InteractionNode[]): string {
  const baseId = `${layerId}-click`;
  if (!interactions.some((interaction) => interaction.id === baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (interactions.some((interaction) => interaction.id === `${baseId}-${suffix}`)) {
    suffix += 1;
  }
  return `${baseId}-${suffix}`;
}

function belongsToSection(layer: LayerNode, section: SectionNode): boolean {
  return layer.sectionId === section.id || section.layerIds.includes(layer.id);
}

function reflowSectionStack(doc: LayerDoc): void {
  let nextY = 0;

  for (const section of doc.sections) {
    const previousY = section.bounds.y;
    const deltaY = nextY - previousY;

    section.bounds = { ...section.bounds, y: nextY };
    for (const layer of doc.layers) {
      if (belongsToSection(layer, section)) {
        layer.bounds = { ...layer.bounds, y: layer.bounds.y + deltaY };
      }
    }
    nextY += section.bounds.height;
  }

  doc.canvas.height = Math.max(doc.canvas.height, nextY);
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
 * Create, update, or clear the controlled click action for an editable button.
 * Button behavior is stored as LayerDoc interaction metadata so preview,
 * React export, and project contracts can verify the same object graph.
 */
export function updateButtonAction(doc: LayerDoc, layerId: string, action: string): LayerDoc {
  const next = cloneDoc(doc);
  const layer = findEditableLayer(next, layerId);

  if (layer.kind !== "button") {
    throw new Error(`Layer "${layerId}" is "${layer.kind}", not a button.`);
  }

  const trimmedAction = action.trim();
  const clickInteractions = next.interactions.filter((interaction) => interaction.layerId === layerId && interaction.event === "click");

  if (!trimmedAction) {
    next.interactions = next.interactions.filter((interaction) => !(interaction.layerId === layerId && interaction.event === "click"));
    return next;
  }

  if (clickInteractions.length === 0) {
    next.interactions.push({
      id: buttonClickInteractionId(layerId, next.interactions),
      layerId,
      event: "click",
      action: trimmedAction
    });
    return next;
  }

  const [primaryInteraction, ...duplicateInteractions] = clickInteractions;
  const duplicateInteractionIds = new Set(duplicateInteractions.map((interaction) => interaction.id));
  next.interactions = next.interactions
    .filter((interaction) => !duplicateInteractionIds.has(interaction.id))
    .map((interaction) => (interaction.id === primaryInteraction.id ? { ...interaction, action: trimmedAction } : interaction));
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
 * Update editable image metadata that survives HTML preview and React export.
 * Alt text belongs to the layer content rather than the asset file so one crop
 * can be reused with different project-facing semantics.
 */
export function updateImageLayerAlt(doc: LayerDoc, layerId: string, alt: string): LayerDoc {
  const next = cloneDoc(doc);
  const layer = findEditableLayer(next, layerId);

  if (layer.kind !== "image") {
    throw new Error(`Layer "${layerId}" is "${layer.kind}", not image.`);
  }

  layer.content = { ...(layer.content ?? {}), alt };
  return next;
}

/**
 * Move a section to a new position in the document order.
 * The homepage MVP treats sections as a vertical stack, so reordering must
 * also translate section and layer bounds in the same LayerDoc edit.
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
  reflowSectionStack(next);
  return next;
}

/**
 * Toggle whether a page module participates in preview and exported code.
 * The section and its layers stay in LayerDoc so an operator can restore or
 * revise the module without losing editable structure.
 */
export function setSectionVisibility(doc: LayerDoc, sectionId: string, visible: boolean): LayerDoc {
  const next = cloneDoc(doc);
  const section = next.sections.find((candidate) => candidate.id === sectionId);

  if (!section) {
    throw new Error(`Section "${sectionId}" was not found.`);
  }

  section.visible = visible;
  return next;
}

/**
 * Queue a controlled request for an AI worker to regenerate a section later.
 * The current section remains intact until a generated candidate is reviewed
 * and applied, which keeps LayerDoc editable and auditable at every step.
 */
export function requestSectionRegeneration(doc: LayerDoc, sectionId: string, input: SectionRegenerationRequestInput): LayerDoc {
  const next = cloneDoc(doc);
  const section = next.sections.find((candidate) => candidate.id === sectionId);
  const prompt = input.prompt.trim();

  if (!section) {
    throw new Error(`Section "${sectionId}" was not found.`);
  }
  if (!prompt) {
    throw new Error("Regeneration prompt must not be empty.");
  }

  const nextIndex = next.generation.sectionRequests.filter((request) => request.sectionId === sectionId).length + 1;
  next.generation.sectionRequests.push({
    id: `regen-${sectionId}-${nextIndex}`,
    sectionId,
    prompt,
    status: "requested",
    requestedAt: input.requestedAt ?? new Date().toISOString()
  });
  return next;
}
