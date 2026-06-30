import type { Rect } from "../layerdoc/types.js";

export interface ProblemAreaAnnotation {
  id: string;
  label: string;
  bounds: Rect;
}

export interface ProblemAreaAnnotationOptions {
  scale: number;
  minimumDisplaySize?: number;
}

function scaledDimension(value: number, scale: number, minimumDisplaySize: number): number {
  return Math.max(value * scale, minimumDisplaySize);
}

/**
 * Convert verifier pixel-space mismatch rectangles into preview-space markers.
 * Tiny one-pixel diffs stay visible so the operator can still locate them.
 */
export function createProblemAreaAnnotations(problemAreas: Rect[], options: ProblemAreaAnnotationOptions): ProblemAreaAnnotation[] {
  const minimumDisplaySize = options.minimumDisplaySize ?? 6;

  return problemAreas.map((area, index) => ({
    id: `problem-area-${index + 1}`,
    label: `#${index + 1} ${area.x},${area.y} ${area.width}x${area.height}`,
    bounds: {
      x: area.x * options.scale,
      y: area.y * options.scale,
      width: scaledDimension(area.width, options.scale, minimumDisplaySize),
      height: scaledDimension(area.height, options.scale, minimumDisplaySize)
    }
  }));
}
