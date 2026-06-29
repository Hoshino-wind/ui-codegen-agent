import { readFileSync, writeFileSync } from "node:fs";

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

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
  const diff = input.diffPath ? new PNG({ width, height }) : undefined;

  const mismatchedPixels = pixelmatch(reference.data, candidate.data, diff?.data, width, height, {
    threshold,
    includeAA: input.includeAA ?? false
  });

  if (input.diffPath && diff) {
    writeFileSync(input.diffPath, PNG.sync.write(diff));
  }

  return {
    visualSimilarity: roundPercentage(100 - (mismatchedPixels / comparedPixels) * 100),
    mismatchedPixels,
    comparedPixels,
    dimensions: { width, height },
    diffPath: input.diffPath ?? null,
    threshold
  };
}
