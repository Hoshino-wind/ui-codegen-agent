import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { renderHtmlPreview } from "../exporters/htmlPreview.js";
import type { LayerDoc } from "../layerdoc/types.js";
import { runLayerDocVerification, type LayerDocVerificationRun, type VerificationGates } from "./run.js";
import { verificationVisualEvidence } from "./report.js";

export interface PreviewViewport {
  width: number;
  height: number;
}

export interface PreviewSnapshotRenderInput {
  htmlPath: string;
  screenshotPath: string;
  viewport: PreviewViewport;
  browserExecutablePath?: string;
}

export type PreviewSnapshotRenderer = (input: PreviewSnapshotRenderInput) => Promise<void> | void;

export interface RunLayerDocPreviewVerificationInput {
  doc: LayerDoc;
  referencePath: string;
  outputDir: string;
  renderer?: PreviewSnapshotRenderer;
  previewHtmlPath?: string;
  candidatePath?: string;
  diffPath?: string;
  browserExecutablePath?: string;
  threshold?: number;
  includeAA?: boolean;
  gates?: Partial<VerificationGates>;
}

export interface LayerDocPreviewVerificationRun extends LayerDocVerificationRun {
  artifacts: LayerDocVerificationRun["artifacts"] & {
    previewHtmlPath: string;
  };
}

async function renderPreviewWithPlaywright(input: PreviewSnapshotRenderInput): Promise<void> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch(input.browserExecutablePath ? { executablePath: input.browserExecutablePath } : undefined);

  try {
    const page = await browser.newPage({
      viewport: input.viewport,
      deviceScaleFactor: 1
    });
    await page.goto(pathToFileURL(input.htmlPath).href, { waitUntil: "networkidle" });
    await page.screenshot({ path: input.screenshotPath });
  } finally {
    await browser.close();
  }
}

/**
 * Render LayerDoc's deterministic HTML preview to a PNG candidate and run the
 * screenshot verifier. Tests can inject a renderer; production uses Playwright.
 */
export async function runLayerDocPreviewVerification(input: RunLayerDocPreviewVerificationInput): Promise<LayerDocPreviewVerificationRun> {
  mkdirSync(input.outputDir, { recursive: true });

  const previewHtmlPath = input.previewHtmlPath ?? join(input.outputDir, "preview.html");
  const candidatePath = input.candidatePath ?? join(input.outputDir, "candidate.png");
  const diffPath = input.diffPath ?? join(input.outputDir, "diff.png");
  const renderer = input.renderer ?? renderPreviewWithPlaywright;

  writeFileSync(previewHtmlPath, renderHtmlPreview(input.doc));
  await renderer({
    htmlPath: previewHtmlPath,
    screenshotPath: candidatePath,
    viewport: {
      width: input.doc.canvas.width,
      height: input.doc.canvas.height
    },
    browserExecutablePath: input.browserExecutablePath
  });

  const run = runLayerDocVerification({
    doc: input.doc,
    referencePath: input.referencePath,
    candidatePath,
    diffPath,
    threshold: input.threshold,
    includeAA: input.includeAA,
    gates: input.gates,
    visualEvidence: verificationVisualEvidence.htmlScreenshot
  });

  return {
    ...run,
    artifacts: {
      ...run.artifacts,
      previewHtmlPath
    }
  };
}
