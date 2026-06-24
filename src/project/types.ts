import type { FrameworkTarget } from "../ir/types.js";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun" | "unknown";

export type StyleSystem =
  | "css"
  | "css-modules"
  | "tailwind"
  | "styled-components"
  | "emotion"
  | "unknown";

export interface ProjectComponent {
  name: string;
  importPath: string;
  kind?: string;
  props?: Record<string, string>;
}

export interface ProjectProfile {
  rootDir: string;
  framework: FrameworkTarget;
  packageManager: PackageManager;
  styleSystem: StyleSystem;
  sourceRoots: string[];
  routeRoots: string[];
  uiLibraries: string[];
  components: ProjectComponent[];
  tokenFiles: string[];
  verificationCommands: string[];
}

