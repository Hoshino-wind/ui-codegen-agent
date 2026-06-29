import pixelmatch from "pixelmatch";

import type { Rect } from "../layerdoc/types.js";

export interface ImageDataSnapshot {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

export interface ImageDataSnapshotComparisonInput {
  reference: ImageDataSnapshot;
  candidate: ImageDataSnapshot;
  threshold?: number;
  includeAA?: boolean;
}

export interface ImageDataSnapshotComparisonResult {
  visualSimilarity: number;
  mismatchedPixels: number;
  comparedPixels: number;
  dimensions: {
    width: number;
    height: number;
  };
  mismatchBounds: Rect | null;
  problemAreas: Rect[];
  diffData: Uint8Array;
  threshold: number;
}

function assertSameDimensions(reference: ImageDataSnapshot, candidate: ImageDataSnapshot): void {
  if (reference.width !== candidate.width || reference.height !== candidate.height) {
    throw new Error(
      `ImageData dimensions must match for visual comparison: reference ${reference.width}x${reference.height}, candidate ${candidate.width}x${candidate.height}.`
    );
  }
}

function assertRgbaLength(snapshot: ImageDataSnapshot, label: string): void {
  const expectedLength = snapshot.width * snapshot.height * 4;
  if (snapshot.data.length !== expectedLength) {
    throw new Error(`${label} ImageData must contain ${expectedLength} RGBA values for ${snapshot.width}x${snapshot.height}.`);
  }
}

function roundPercentage(value: number): number {
  return Math.round(value * 100) / 100;
}

function isPixelmatchDifference(diffData: Uint8Array, width: number, x: number, y: number): boolean {
  const index = (width * y + x) << 2;
  const red = diffData[index];
  const green = diffData[index + 1];
  const blue = diffData[index + 2];

  return red === 255 && green === 0 && blue === 0;
}

function boundsFromPoints(points: Rect[]): Rect | null {
  if (points.length === 0) {
    return null;
  }

  const left = Math.min(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y));
  const right = Math.max(...points.map((point) => point.x + point.width));
  const bottom = Math.max(...points.map((point) => point.y + point.height));

  return { x: left, y: top, width: right - left, height: bottom - top };
}

function collectProblemAreas(diffData: Uint8Array, width: number, height: number): Rect[] {
  const visited = new Uint8Array(width * height);
  const areas: Rect[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const startIndex = width * y + x;
      if (visited[startIndex] || !isPixelmatchDifference(diffData, width, x, y)) {
        continue;
      }

      let left = x;
      let top = y;
      let right = x;
      let bottom = y;
      const stack: Array<[number, number]> = [[x, y]];
      visited[startIndex] = 1;

      while (stack.length > 0) {
        const [currentX, currentY] = stack.pop() as [number, number];
        left = Math.min(left, currentX);
        top = Math.min(top, currentY);
        right = Math.max(right, currentX);
        bottom = Math.max(bottom, currentY);

        for (const [nextX, nextY] of [
          [currentX + 1, currentY],
          [currentX - 1, currentY],
          [currentX, currentY + 1],
          [currentX, currentY - 1]
        ] as const) {
          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) {
            continue;
          }

          const nextIndex = width * nextY + nextX;
          if (!visited[nextIndex] && isPixelmatchDifference(diffData, width, nextX, nextY)) {
            visited[nextIndex] = 1;
            stack.push([nextX, nextY]);
          }
        }
      }

      areas.push({ x: left, y: top, width: right - left + 1, height: bottom - top + 1 });
    }
  }

  return areas;
}

/**
 * Compare raw RGBA snapshots. Keeping this DOM-free lets Node PNG files and a
 * future browser Canvas verifier share identical scoring and problem-area math.
 */
export function compareImageDataSnapshots(input: ImageDataSnapshotComparisonInput): ImageDataSnapshotComparisonResult {
  assertSameDimensions(input.reference, input.candidate);
  assertRgbaLength(input.reference, "reference");
  assertRgbaLength(input.candidate, "candidate");

  const width = input.reference.width;
  const height = input.reference.height;
  const comparedPixels = width * height;
  const threshold = input.threshold ?? 0.1;
  const diffData = new Uint8Array(width * height * 4);

  const mismatchedPixels = pixelmatch(input.reference.data, input.candidate.data, diffData, width, height, {
    threshold,
    includeAA: input.includeAA ?? false
  });
  const problemAreas = collectProblemAreas(diffData, width, height);
  const mismatchBounds = boundsFromPoints(problemAreas);

  return {
    visualSimilarity: roundPercentage(100 - (mismatchedPixels / comparedPixels) * 100),
    mismatchedPixels,
    comparedPixels,
    dimensions: { width, height },
    mismatchBounds,
    problemAreas,
    diffData,
    threshold
  };
}
