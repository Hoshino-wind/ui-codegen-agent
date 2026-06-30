import type { Canvas } from "../layerdoc/types.js";

export interface HtmlPreviewSnapshotInput {
  html: string;
  canvas: Canvas;
}

export type HtmlImageSourceInliner = (source: string) => Promise<string> | string;

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
 * preview. This is useful as a portable preview artifact, but browser canvas
 * pixel reads can treat foreignObject SVGs as tainted; the editor verifier uses
 * the origin-clean LayerDoc rasterizer instead.
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
