import type { LayerDoc, LayerNode, Rect } from "../layerdoc/types.js";
import type { ImageDataSnapshot } from "../verifier/imageDataDiff.js";

type Rgba = [number, number, number, number];

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function colorFromHex(value: string | undefined, fallback: Rgba): Rgba {
  if (!value?.startsWith("#")) {
    return fallback;
  }

  const hex = value.slice(1);
  const expanded = hex.length === 3 ? hex.split("").map((char) => `${char}${char}`).join("") : hex;
  if (!/^[\da-f]{6}$/i.test(expanded)) {
    return fallback;
  }

  return [
    Number.parseInt(expanded.slice(0, 2), 16),
    Number.parseInt(expanded.slice(2, 4), 16),
    Number.parseInt(expanded.slice(4, 6), 16),
    255
  ];
}

function roundedRect(bounds: Rect, canvasWidth: number, canvasHeight: number): Rect {
  const x = Math.max(0, Math.floor(bounds.x));
  const y = Math.max(0, Math.floor(bounds.y));
  const right = Math.min(canvasWidth, Math.ceil(bounds.x + bounds.width));
  const bottom = Math.min(canvasHeight, Math.ceil(bounds.y + bounds.height));

  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y)
  };
}

function paintRect(data: Uint8ClampedArray, canvasWidth: number, canvasHeight: number, bounds: Rect, color: Rgba): void {
  const rect = roundedRect(bounds, canvasWidth, canvasHeight);
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      const index = (canvasWidth * y + x) * 4;
      data[index] = color[0];
      data[index + 1] = color[1];
      data[index + 2] = color[2];
      data[index + 3] = color[3];
    }
  }
}

function inset(bounds: Rect, amount: number): Rect {
  return {
    x: bounds.x + amount,
    y: bounds.y + amount,
    width: Math.max(0, bounds.width - amount * 2),
    height: Math.max(0, bounds.height - amount * 2)
  };
}

function paintTextProxy(data: Uint8ClampedArray, canvasWidth: number, canvasHeight: number, layer: LayerNode): void {
  const color = colorFromHex(layer.style?.textColor, [15, 23, 42, 255]);
  const textLength = layer.content?.text?.length ?? 12;
  const lineCount = Math.max(1, Math.min(3, Math.ceil(textLength / 48)));
  const lineHeight = Math.max(4, Math.min(10, Math.floor(layer.bounds.height / (lineCount * 2))));
  const lineWidth = Math.max(12, Math.min(layer.bounds.width - 8, textLength * 6));

  for (let line = 0; line < lineCount; line += 1) {
    paintRect(
      data,
      canvasWidth,
      canvasHeight,
      {
        x: layer.bounds.x + 4,
        y: layer.bounds.y + 5 + line * lineHeight * 2,
        width: Math.max(0, lineWidth - line * 24),
        height: lineHeight
      },
      color
    );
  }
}

function paintAssetProxy(data: Uint8ClampedArray, canvasWidth: number, canvasHeight: number, bounds: Rect): void {
  paintRect(data, canvasWidth, canvasHeight, bounds, [226, 232, 240, 255]);
  paintRect(data, canvasWidth, canvasHeight, inset(bounds, 8), [241, 245, 249, 255]);
  paintRect(
    data,
    canvasWidth,
    canvasHeight,
    {
      x: bounds.x + 16,
      y: bounds.y + bounds.height - 24,
      width: Math.max(0, bounds.width - 32),
      height: 5
    },
    [20, 184, 166, 255]
  );
}

function paintLayer(data: Uint8ClampedArray, canvasWidth: number, canvasHeight: number, layer: LayerNode): void {
  const background = colorFromHex(layer.style?.backgroundColor, [255, 255, 255, 0]);

  if (layer.kind === "image" || layer.track === "asset") {
    paintAssetProxy(data, canvasWidth, canvasHeight, layer.bounds);
    return;
  }

  if (background[3] > 0) {
    paintRect(data, canvasWidth, canvasHeight, layer.bounds, background);
  }

  if (layer.kind === "text" || layer.kind === "button") {
    paintTextProxy(data, canvasWidth, canvasHeight, layer);
  }
}

function visibleLayers(doc: LayerDoc): LayerNode[] {
  const hiddenSectionIds = new Set(doc.sections.filter((section) => section.visible === false).map((section) => section.id));
  return doc.layers.filter((layer) => !layer.sectionId || !hiddenSectionIds.has(layer.sectionId));
}

/**
 * Create an origin-clean candidate snapshot from the current LayerDoc preview
 * model. This remains useful as a low-level fallback or fixture generator; the
 * Studio verifier uses the HTML preview screenshot path when the browser can
 * rasterize it.
 */
export function renderLayerDocSnapshot(doc: LayerDoc): ImageDataSnapshot {
  const width = doc.canvas.width;
  const height = doc.canvas.height;
  const background = colorFromHex(doc.canvas.background, [255, 255, 255, 255]);
  const data = new Uint8ClampedArray(width * height * 4);

  paintRect(data, width, height, { x: 0, y: 0, width, height }, background.map(clampChannel) as Rgba);
  for (const layer of visibleLayers(doc)) {
    paintLayer(data, width, height, layer);
  }

  return {
    width,
    height,
    data
  };
}
