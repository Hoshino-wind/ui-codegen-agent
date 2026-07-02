import { bytesToBase64 } from "../shared/base64.js";

export interface ReferenceOverlayStyleInput {
  canvas: {
    width: number;
    height: number;
  };
  opacity: number;
  scale: number;
}

export function createReferenceOverlayDataUrl(referencePng: Uint8Array | undefined): string | null {
  if (!referencePng || referencePng.length === 0) {
    return null;
  }

  return `data:image/png;base64,${bytesToBase64(referencePng)}`;
}

export function createReferenceOverlayStyle(input: ReferenceOverlayStyleInput): { width: number; height: number; opacity: number } {
  return {
    width: input.canvas.width * input.scale,
    height: input.canvas.height * input.scale,
    opacity: input.opacity
  };
}
