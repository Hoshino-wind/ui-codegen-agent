import type { ImageAssetPatch } from "../editor/operations.js";

export interface ImageReplacementFileLike {
  name: string;
  type: string;
}

export interface ImageAssetUploadDependencies<TFile extends ImageReplacementFileLike = ImageReplacementFileLike> {
  readAsDataUrl: (file: TFile) => Promise<string>;
}

function isImageFile(file: ImageReplacementFileLike): boolean {
  return file.type.startsWith("image/");
}

// Keep the browser FileReader boundary isolated so the editor mutation stays testable.
export function readBrowserFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Image replacement "${file.name}" could not be read.`));
    reader.readAsDataURL(file);
  });
}

export async function createImageAssetPatchFromFile<TFile extends ImageReplacementFileLike>(
  file: TFile,
  dependencies: ImageAssetUploadDependencies<TFile>
): Promise<ImageAssetPatch> {
  if (!isImageFile(file)) {
    throw new Error("Image replacement must be an image file.");
  }

  const uri = await dependencies.readAsDataUrl(file);
  if (!uri.startsWith("data:image/")) {
    throw new Error("Image replacement reader must return an image data URI.");
  }

  return {
    uri,
    source: "uploaded"
  };
}
