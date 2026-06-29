import { readFileSync } from "node:fs";

import type { LayerDoc } from "../layerdoc/types.js";
import { validateLayerDoc } from "../layerdoc/validation.js";

export class CliError extends Error {
  constructor(message: string, readonly showUsage = false) {
    super(message);
  }
}

export function readOptionValue(args: string[], index: number, name: string): { value: string; nextIndex: number } {
  const equalsPrefix = `${name}=`;
  const current = args[index];
  if (current.startsWith(equalsPrefix)) {
    return { value: current.slice(equalsPrefix.length), nextIndex: index + 1 };
  }

  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new CliError(`Missing value for ${name}.`, true);
  }

  return { value, nextIndex: index + 2 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLayerDocCandidate(value: unknown): value is LayerDoc {
  return (
    isRecord(value) &&
    value.schema === "layerdoc" &&
    value.version === "0.1.0" &&
    isRecord(value.canvas) &&
    Array.isArray(value.sections) &&
    Array.isArray(value.layers) &&
    Array.isArray(value.assets) &&
    Array.isArray(value.components) &&
    Array.isArray(value.interactions) &&
    isRecord(value.responsive) &&
    isRecord(value.verification)
  );
}

export function readLayerDocFile(inputPath: string): LayerDoc {
  const raw = readFileSync(inputPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (!isLayerDocCandidate(parsed)) {
    throw new CliError("Input file is not a LayerDoc 0.1.0 document.");
  }

  const validation = validateLayerDoc(parsed);
  if (!validation.valid) {
    const messages = validation.issues.map((issue) => `- ${issue.path}: ${issue.message}`).join("\n");
    throw new CliError(`LayerDoc validation failed:\n${messages}`);
  }

  return parsed;
}
