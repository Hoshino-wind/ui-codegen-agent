import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { ProjectExportPackage } from "./projectPackage.js";

export interface WrittenProjectExportFile {
  relativePath: string;
  absolutePath: string;
}

export interface WrittenProjectExportPackage {
  rootDir: string;
  files: WrittenProjectExportFile[];
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
