import type { LayerKind, LayerTrack } from "./types.js";

const componentKinds = new Set<LayerKind>(["text", "button", "nav", "card", "form", "input", "list", "table"]);
const assetKinds = new Set<LayerKind>(["image", "icon", "background"]);
const approximationKinds = new Set<LayerKind>(["chart", "map", "scene3d"]);
const layoutKinds = new Set<LayerKind>(["section", "group"]);

/**
 * Classify a visual object into the production track that owns it.
 * This keeps generation honest: charts/maps are not treated as hand-coded DOM,
 * and raster assets are not mistaken for editable component structure.
 */
export function classifyLayer(input: { kind: LayerKind }): LayerTrack {
  if (componentKinds.has(input.kind)) {
    return "component";
  }
  if (assetKinds.has(input.kind)) {
    return "asset";
  }
  if (approximationKinds.has(input.kind)) {
    return "approximation";
  }
  if (layoutKinds.has(input.kind)) {
    return "layout";
  }

  // The union should make this unreachable, but the fallback keeps runtime JSON safe.
  return "component";
}
