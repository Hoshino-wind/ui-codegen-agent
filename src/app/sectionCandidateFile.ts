import type { SectionRegenerationCandidateInput } from "../editor/operations.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalArray<T>(value: unknown, fieldName: string): T[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`Section candidate ${fieldName} must be an array.`);
  }
  return value as T[];
}

/**
 * Import a reviewed regeneration result from JSON before applying it to
 * LayerDoc. Deeper graph validation stays in the LayerDoc operation so the
 * browser import path and programmatic API share the same production checks.
 */
export function parseSectionRegenerationCandidateJson(json: string): SectionRegenerationCandidateInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Section candidate JSON is not valid.");
  }

  if (!isRecord(parsed)) {
    throw new Error("Section candidate JSON must contain an object.");
  }
  if (!isRecord(parsed.section)) {
    throw new Error("Section candidate section must be an object.");
  }
  if (!Array.isArray(parsed.layers)) {
    throw new Error("Section candidate layers must be an array.");
  }

  const requestId = typeof parsed.requestId === "string" && parsed.requestId.trim() ? parsed.requestId : undefined;
  return {
    requestId,
    section: parsed.section as unknown as SectionRegenerationCandidateInput["section"],
    layers: parsed.layers as unknown as SectionRegenerationCandidateInput["layers"],
    assets: optionalArray(parsed.assets, "assets"),
    components: optionalArray(parsed.components, "components"),
    interactions: optionalArray(parsed.interactions, "interactions"),
    responsiveRules: optionalArray(parsed.responsiveRules, "responsiveRules")
  };
}
