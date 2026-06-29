import { readFileSync, writeFileSync } from "node:fs";

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

import type { Rect } from "../layerdoc/types.js";

export interface PngSnapshotComparisonInput {
  referencePath: string;
  candidatePath: string;
  diffPath?: string;
  threshold?: number;
  includeAA?: boolean;
}

export interface PngSnapshotComparisonResult {
  visualSimilarity: number;
  mismatchedPixels: number;
  comparedPixels: number;
  dimensions: {
    width: number;
    height: number;
  };
  mismatchBounds: Rect | null;
  problemAreas: Rect[];
  diffPath: string | null;
  threshold: number;
}

function readPng(path: string): PNG {
  return PNG.sync.read(readFileSync(path));
}

function assertSameDimensions(reference: PNG, candidate: PNG): void {
  if (reference.width !== candidate.width || reference.height !== candidate.height) {
    throw new Error(
      `PNG dimensions must match for visual comparison: reference ${reference.width}x${reference.height}, candidate ${candidate.width}x${candidate.height}.`
    );
  }
}

function roundPercentage(value: number): number {
  return Math.round(value * 100) / 100;
}

function isPixelmatchDifference(diff: PNG, x: number, y: number): boolean {
  const index = (diff.width * y + x) << 2;
  const red = diff.data[index];
  const green = diff.data[index + 1];
  const blue = diff.data[index + 2];

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

function collectProblemAreas(diff: PNG): Rect[] {
  const visited = new Uint8Array(diff.width * diff.height);
  const areas: Rect[] = [];

  for (let y = 0; y < diff.height; y += 1) {
    for (let x = 0; x < diff.width; x += 1) {
      const startIndex = diff.width * y + x;
      if (visited[startIndex] || !isPixelmatchDifference(diff, x, y)) {
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
          if (nextX < 0 || nextY < 0 || nextX >= diff.width || nextY >= diff.height) {
            continue;
          }

          const nextIndex = diff.width * nextY + nextX;
          if (!visited[nextIndex] && isPixelmatchDifference(diff, nextX, nextY)) {
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
 * Compare two rendered PNG snapshots and optionally emit a diff image.
 * This module is intentionally file-based so Playwright, a crop workbench, or
 * any future renderer can feed the verifier without changing LayerDoc itself.
 */
export function comparePngSnapshots(input: PngSnapshotComparisonInput): PngSnapshotComparisonResult {
  const reference = readPng(input.referencePath);
  const candidate = readPng(input.candidatePath);
  assertSameDimensions(reference, candidate);

  const width = reference.width;
  const height = reference.height;
  const comparedPixels = width * height;
  const threshold = input.threshold ?? 0.1;
  const diff = new PNG({ width, height });

  const mismatchedPixels = pixelmatch(reference.data, candidate.data, diff.data, width, height, {
    threshold,
    includeAA: input.includeAA ?? false
  });
  const problemAreas = collectProblemAreas(diff);
  const mismatchBounds = boundsFromPoints(problemAreas);

  if (input.diffPath) {
    writeFileSync(input.diffPath, PNG.sync.write(diff));
  }

  return {
    visualSimilarity: roundPercentage(100 - (mismatchedPixels / comparedPixels) * 100),
    mismatchedPixels,
    comparedPixels,
    dimensions: { width, height },
    mismatchBounds,
    problemAreas,
    diffPath: input.diffPath ?? null,
    threshold
  };
}
