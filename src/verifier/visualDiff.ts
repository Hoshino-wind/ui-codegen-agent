import { readFileSync, writeFileSync } from "node:fs";

import { PNG } from "pngjs";

import type { Rect } from "../layerdoc/types.js";
import { compareImageDataSnapshots } from "./imageDataDiff.js";

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

/**
 * Compare two rendered PNG snapshots and optionally emit a diff image.
 * This module is intentionally file-based so Playwright, a crop workbench, or
 * any future renderer can feed the verifier without changing LayerDoc itself.
 */
export function comparePngSnapshots(input: PngSnapshotComparisonInput): PngSnapshotComparisonResult {
  const reference = readPng(input.referencePath);
  const candidate = readPng(input.candidatePath);
  const comparison = compareImageDataSnapshots({
    reference: {
      width: reference.width,
      height: reference.height,
      data: reference.data
    },
    candidate: {
      width: candidate.width,
      height: candidate.height,
      data: candidate.data
    },
    threshold: input.threshold,
    includeAA: input.includeAA
  });

  if (input.diffPath) {
    const diff = new PNG({
      width: comparison.dimensions.width,
      height: comparison.dimensions.height
    });
    diff.data = Buffer.from(comparison.diffData);
    writeFileSync(input.diffPath, PNG.sync.write(diff));
  }

  return {
    visualSimilarity: comparison.visualSimilarity,
    mismatchedPixels: comparison.mismatchedPixels,
    comparedPixels: comparison.comparedPixels,
    dimensions: comparison.dimensions,
    mismatchBounds: comparison.mismatchBounds,
    problemAreas: comparison.problemAreas,
    diffPath: input.diffPath ?? null,
    threshold: comparison.threshold
  };
}
