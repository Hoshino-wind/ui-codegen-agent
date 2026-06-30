import type { LayerNode, Rect } from "../layerdoc/types.js";

type ProblemAreaLayer = Pick<LayerNode, "id" | "bounds" | "editable">;

export interface ProblemAreaAnnotation {
  id: string;
  label: string;
  bounds: Rect;
  affectedLayerId?: string | null;
  affectedLayerLabel?: string | null;
}

export interface ProblemAreaAnnotationOptions {
  scale: number;
  minimumDisplaySize?: number;
  layers?: ProblemAreaLayer[];
}

function scaledDimension(value: number, scale: number, minimumDisplaySize: number): number {
  return Math.max(value * scale, minimumDisplaySize);
}

function rectArea(rect: Rect): number {
  return rect.width * rect.height;
}

function intersectionArea(a: Rect, b: Rect): number {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);

  if (right <= left || bottom <= top) {
    return 0;
  }

  return (right - left) * (bottom - top);
}

function affectedLayerForProblemArea(area: Rect, layers: ProblemAreaLayer[] | undefined): ProblemAreaLayer | null {
  if (!layers || layers.length === 0) {
    return null;
  }

  const ranked = layers
    .map((layer) => ({
      layer,
      overlap: intersectionArea(area, layer.bounds),
      layerArea: rectArea(layer.bounds)
    }))
    .filter((candidate) => candidate.overlap > 0)
    .sort((a, b) => {
      if (b.overlap !== a.overlap) {
        return b.overlap - a.overlap;
      }
      if (a.layer.editable !== b.layer.editable) {
        return a.layer.editable ? -1 : 1;
      }
      return a.layerArea - b.layerArea;
    });

  return ranked[0]?.layer ?? null;
}

/**
 * Convert verifier pixel-space mismatch rectangles into preview-space markers.
 * Tiny one-pixel diffs stay visible so the operator can still locate them.
 */
export function createProblemAreaAnnotations(problemAreas: Rect[], options: ProblemAreaAnnotationOptions): ProblemAreaAnnotation[] {
  const minimumDisplaySize = options.minimumDisplaySize ?? 6;

  return problemAreas.map((area, index) => {
    const affectedLayer = affectedLayerForProblemArea(area, options.layers);
    const annotation: ProblemAreaAnnotation = {
      id: `problem-area-${index + 1}`,
      label: `#${index + 1} ${area.x},${area.y} ${area.width}x${area.height}`,
      bounds: {
        x: area.x * options.scale,
        y: area.y * options.scale,
        width: scaledDimension(area.width, options.scale, minimumDisplaySize),
        height: scaledDimension(area.height, options.scale, minimumDisplaySize)
      }
    };

    if (options.layers) {
      annotation.affectedLayerId = affectedLayer?.id ?? null;
      annotation.affectedLayerLabel = affectedLayer?.id ?? null;
    }

    return annotation;
  });
}
