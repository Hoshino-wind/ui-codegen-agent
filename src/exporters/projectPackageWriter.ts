import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { base64ToBytes } from "../shared/base64.js";
import type { ProjectExportFile, ProjectExportManifest, ProjectExportPackage } from "./projectPackage.js";

export interface WrittenProjectExportFile {
  relativePath: string;
  absolutePath: string;
}

export interface WrittenProjectExportPackage {
  rootDir: string;
  files: WrittenProjectExportFile[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function assertSafeProjectPath(path: string): void {
  const segments = path.split("/");
  if (
    path.length === 0 ||
    path.startsWith("/") ||
    path.includes("\\") ||
    /^[A-Za-z]:/.test(path) ||
    segments.some((segment) => segment === ".." || segment.length === 0)
  ) {
    throw new Error(`Project package file path "${path}" must stay inside the project root.`);
  }
}

function parseJsonProjectFile(value: unknown): ProjectExportFile {
  if (!isRecord(value) || typeof value.path !== "string") {
    throw new Error("Project package files must include a string path.");
  }
  assertSafeProjectPath(value.path);

  if (typeof value.contents === "string") {
    return { path: value.path, contents: value.contents };
  }

  if (value.contentEncoding === "base64" && typeof value.contentsBase64 === "string") {
    try {
      return { path: value.path, contents: base64ToBytes(value.contentsBase64) };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid base64.";
      throw new Error(`Project package file "${value.path}" has invalid base64 contents: ${message}`);
    }
  }

  throw new Error(`Project package file "${value.path}" must include text contents or base64 binary contents.`);
}

function assertManifestFilesMatch(manifestFiles: string[], files: ProjectExportFile[]): void {
  const actual = files.map((file) => file.path).sort();
  const expected = [...manifestFiles].sort();

  if (actual.length !== expected.length || actual.some((path, index) => path !== expected[index])) {
    throw new Error("Project package manifest files must match the file payload paths.");
  }
}

export function parseProjectExportPackageJson(contents: string): ProjectExportPackage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON.";
    throw new Error(`Project package JSON could not be parsed: ${message}`);
  }

  if (!isRecord(parsed) || !isRecord(parsed.manifest) || !Array.isArray(parsed.files)) {
    throw new Error("Input file is not a project export package.");
  }
  if (!isStringArray(parsed.manifest.files)) {
    throw new Error("Project package manifest must include a files array.");
  }

  const files = parsed.files.map(parseJsonProjectFile);
  assertManifestFilesMatch(parsed.manifest.files, files);

  return {
    manifest: parsed.manifest as unknown as ProjectExportManifest,
    files
  };
}

export function writeProjectExportPackage(projectPackage: ProjectExportPackage, targetDir: string): WrittenProjectExportPackage {
  const files = projectPackage.files.map((file) => {
    const absolutePath = join(targetDir, file.path);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, file.contents);
    return {
      relativePath: file.path,
      absolutePath
    };
  });

  return {
    rootDir: targetDir,
    files
  };
}
