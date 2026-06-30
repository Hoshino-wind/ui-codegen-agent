import { readBrowserFileAsDataUrl } from "./imageAssetUpload.js";
import { createIntakeWorkspace, type IntakeWorkspace, type ReferenceCropAssetInput } from "./intakeWorkspace.js";

export interface ImageFileLike {
  name: string;
  type: string;
  size: number;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ImageFileIntakeDependencies<TFile extends ImageFileLike = ImageFileLike> {
  readImageDimensions: (file: TFile) => Promise<ImageDimensions>;
  readAsDataUrl?: (file: TFile) => Promise<string>;
}

function isPng(file: ImageFileLike): boolean {
  return file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
}

export async function createIntakeWorkspaceFromImageFile<TFile extends ImageFileLike>(
  file: TFile,
  dependencies: ImageFileIntakeDependencies<TFile>
): Promise<IntakeWorkspace> {
  if (!isPng(file)) {
    throw new Error(`Only PNG files are supported for homepage intake. Received "${file.type || file.name}".`);
  }

  const dimensions = await dependencies.readImageDimensions(file);
  const dataUri = dependencies.readAsDataUrl ? await dependencies.readAsDataUrl(file) : undefined;
  if (dataUri !== undefined && !dataUri.startsWith("data:image/png")) {
    throw new Error("PNG intake reader must return a PNG image data URI.");
  }

  return createIntakeWorkspace({
    uri: file.name,
    width: dimensions.width,
    height: dimensions.height,
    dataUri
  });
}

export function readBrowserImageDimensions(file: File): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    function cleanup(): void {
      URL.revokeObjectURL(url);
    }

    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      cleanup();
      resolve({ width, height });
    };
    image.onerror = () => {
      cleanup();
      reject(new Error(`Unable to read PNG dimensions from "${file.name}".`));
    };
    image.src = url;
  });
}

export function createIntakeWorkspaceFromBrowserFile(file: File): Promise<IntakeWorkspace> {
  return createIntakeWorkspaceFromImageFile(file, {
    readImageDimensions: readBrowserImageDimensions,
    readAsDataUrl: readBrowserFileAsDataUrl
  });
}

function loadBrowserImage(dataUri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to decode uploaded PNG for reference crop."));
    image.src = dataUri;
  });
}

export async function cropBrowserReferenceAsset(input: ReferenceCropAssetInput): Promise<string> {
  const sourceDataUri = input.sourceImage.dataUri;
  if (!sourceDataUri) {
    throw new Error("Uploaded PNG data is required before reference crops can be materialized.");
  }

  const image = await loadBrowserImage(sourceDataUri);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Browser canvas is unavailable for reference crop materialization.");
  }

  canvas.width = input.cropBounds.width;
  canvas.height = input.cropBounds.height;
  context.drawImage(
    image,
    input.cropBounds.x,
    input.cropBounds.y,
    input.cropBounds.width,
    input.cropBounds.height,
    0,
    0,
    input.cropBounds.width,
    input.cropBounds.height
  );

  return canvas.toDataURL("image/png");
}
