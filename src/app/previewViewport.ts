import type { Canvas } from "../layerdoc/types.js";

export type PreviewMode = "desktop" | "mobile";

export interface PreviewViewportInput {
  mode: PreviewMode;
  canvas: Pick<Canvas, "width" | "height">;
}

export interface PreviewViewport {
  mode: PreviewMode;
  frame: {
    width: number;
    height: number;
  };
  scale: number;
  display: {
    width: number;
    height: number;
  };
  rulerTicks: number[];
}

const mobileFrame = {
  width: 390,
  height: 844
};

function roundDisplay(value: number): number {
  return Math.round(value * 100) / 100;
}

function rulerTicks(width: number): number[] {
  return [0, Math.round(width / 3), Math.round((width / 3) * 2), width];
}

export function createPreviewViewport(input: PreviewViewportInput): PreviewViewport {
  const frame =
    input.mode === "mobile"
      ? {
          width: Math.min(mobileFrame.width, input.canvas.width),
          height: Math.min(mobileFrame.height, input.canvas.height)
        }
      : {
          width: input.canvas.width,
          height: input.canvas.height
        };
  const scale = input.mode === "mobile" ? 0.72 : 0.46;

  return {
    mode: input.mode,
    frame,
    scale,
    display: {
      width: roundDisplay(frame.width * scale),
      height: roundDisplay(frame.height * scale)
    },
    rulerTicks: rulerTicks(frame.width)
  };
}
