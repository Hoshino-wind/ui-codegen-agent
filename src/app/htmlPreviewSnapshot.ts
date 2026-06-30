import type { Canvas } from "../layerdoc/types.js";
import type { ImageDataSnapshot } from "../verifier/imageDataDiff.js";

export interface HtmlPreviewSnapshotInput {
  html: string;
  canvas: Canvas;
}

export type HtmlImageSourceInliner = (source: string) => Promise<string> | string;

export interface HtmlPreviewSnapshotDependencies {
  createImage?: () => HTMLImageElement;
  createCanvas?: (width: number, height: number) => HTMLCanvasElement;
  createObjectUrl?: (blob: Blob) => string;
  revokeObjectUrl?: (url: string) => void;
}

function bodyMarkupFromHtml(html: string): string {
  const match = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(html);
  return match?.[1]?.trim() ?? html;
}

export async function inlineHtmlImageSources(html: string, inlineSource: HtmlImageSourceInliner): Promise<string> {
  const matches = [...html.matchAll(/(<img\b[^>]*\bsrc=")([^"]*)("[^>]*>)/gi)];
  if (matches.length === 0) {
    return html;
  }

  let result = "";
  let cursor = 0;
  for (const match of matches) {
    const [fullMatch, prefix, source, suffix] = match;
    const index = match.index ?? 0;
    result += html.slice(cursor, index);
    result += `${prefix}${await inlineSource(source)}${suffix}`;
    cursor = index + fullMatch.length;
  }

  return result + html.slice(cursor);
}

/**
 * Build an SVG foreignObject capture surface from the deterministic HTML
 * preview. Browser and CLI verification can rasterize this surface into pixels
 * while keeping LayerDoc as the source of truth.
 */
export function createForeignObjectSnapshotSvg(input: HtmlPreviewSnapshotInput): string {
  const background = input.canvas.background ?? "#ffffff";
  const bodyMarkup = bodyMarkupFromHtml(input.html);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${input.canvas.width}" height="${input.canvas.height}" viewBox="0 0 ${input.canvas.width} ${input.canvas.height}">
  <foreignObject width="${input.canvas.width}" height="${input.canvas.height}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${input.canvas.width}px;height:${input.canvas.height}px;margin:0;background:${background};font-family:Inter,Arial,sans-serif;">
      ${bodyMarkup}
    </div>
  </foreignObject>
</svg>`;
}

function browserImage(): HTMLImageElement {
  return new Image();
}

function browserCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function loadImage(image: HTMLImageElement, source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load HTML preview snapshot SVG."));
    image.src = source;
  });
}

function createUnreadableCanvasError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(
    `HTML preview screenshot cannot be read because the browser blocked canvas pixel access after rendering SVG foreignObject content. ${message}`
  );
}

/**
 * Rasterize the deterministic HTML preview into ImageData for the in-browser
 * Studio verifier. The DOM dependencies are injectable so tests can verify the
 * behavior without a browser process.
 */
export async function renderHtmlPreviewSnapshot(
  input: HtmlPreviewSnapshotInput,
  dependencies: HtmlPreviewSnapshotDependencies = {}
): Promise<ImageDataSnapshot> {
  const width = input.canvas.width;
  const height = input.canvas.height;
  const svg = createForeignObjectSnapshotSvg(input);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const createObjectUrl = dependencies.createObjectUrl ?? URL.createObjectURL.bind(URL);
  const revokeObjectUrl = dependencies.revokeObjectUrl ?? URL.revokeObjectURL.bind(URL);
  const objectUrl = createObjectUrl(blob);

  try {
    const image = await loadImage((dependencies.createImage ?? browserImage)(), objectUrl);
    const canvas = (dependencies.createCanvas ?? browserCanvas)(width, height);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Browser canvas is unavailable.");
    }

    let imageData: ImageData;
    try {
      context.drawImage(image, 0, 0, width, height);
      imageData = context.getImageData(0, 0, width, height);
    } catch (error) {
      throw createUnreadableCanvasError(error);
    }

    return {
      width: imageData.width,
      height: imageData.height,
      data: new Uint8ClampedArray(imageData.data)
    };
  } finally {
    revokeObjectUrl(objectUrl);
  }
}
