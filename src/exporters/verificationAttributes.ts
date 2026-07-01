import type { LayerDoc } from "../layerdoc/types.js";

function scoreAttributeValue(value: number | null | undefined): string {
  return value === null || value === undefined ? "n/a" : String(value);
}

/**
 * Keep verification state visible on rendered/exported root surfaces so a DOM
 * capture can be traced back to the LayerDoc quality report that produced it.
 */
export function verificationDataAttributes(doc: LayerDoc): Record<string, string> {
  return {
    "data-verification-visual-similarity": scoreAttributeValue(doc.verification.scores.visualSimilarity),
    "data-verification-structure-score": scoreAttributeValue(doc.verification.scores.structureScore),
    "data-verification-component-score": scoreAttributeValue(doc.verification.scores.componentScore),
    "data-verification-project-fit-score": scoreAttributeValue(doc.verification.scores.projectFitScore),
    "data-verification-issues": String(doc.verification.issues.length)
  };
}
