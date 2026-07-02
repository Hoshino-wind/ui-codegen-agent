import type { LayerDoc, ProjectFitScore, Rect } from "./types.js";

function area(rect: Rect | undefined): number {
  if (!rect) {
    return 0;
  }
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

function roundRatio(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Score whether a LayerDoc is on a path toward project-ready code.
 * This is deliberately separate from pixel similarity: a bitmap can look
 * perfect and still be a poor engineering asset.
 */
export function scoreProjectFit(doc: LayerDoc): ProjectFitScore {
  const canvasArea = Math.max(1, doc.canvas.width * doc.canvas.height);
  const assetCoverageRatio = roundRatio(doc.assets.reduce((sum, asset) => sum + area(asset.bounds), 0) / canvasArea);
  const largestAssetRatio = Math.max(0, ...doc.assets.map((asset) => area(asset.bounds) / canvasArea));
  const exportableComponents = doc.components.filter((component) => component.exportable).length;
  const editableComponentLayers = doc.layers.filter((layer) => layer.track === "component" && layer.editable).length;
  const fullPageBitmapRisk = assetCoverageRatio > 0.6 || largestAssetRatio > 0.5;
  const baseScore = 50;
  const exportableComponentScore = Math.min(30, exportableComponents * 15);
  const editableComponentLayerScore = Math.min(10, editableComponentLayers * 5);
  const bitmapRiskPenalty = fullPageBitmapRisk ? -40 : 0;

  let score = baseScore;
  score += exportableComponentScore;
  score += editableComponentLayerScore;
  score += bitmapRiskPenalty;

  return {
    projectFitScore: Math.max(0, Math.min(100, score)),
    assetCoverageRatio,
    fullPageBitmapRisk,
    baseScore,
    exportableComponents,
    editableComponentLayers,
    contributions: [
      {
        id: "base",
        label: "LayerDoc project-ready baseline",
        delta: baseScore
      },
      {
        id: "exportable-components",
        label: "Exportable components",
        delta: exportableComponentScore,
        count: exportableComponents,
        maximum: 30
      },
      {
        id: "editable-component-layers",
        label: "Editable component layers",
        delta: editableComponentLayerScore,
        count: editableComponentLayers,
        maximum: 10
      },
      {
        id: "full-page-bitmap-risk",
        label: "Full-page bitmap risk",
        delta: bitmapRiskPenalty,
        triggered: fullPageBitmapRisk
      }
    ]
  };
}
