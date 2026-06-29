import { createIntakeWorkspace, type IntakeWorkspace } from "./intakeWorkspace.js";

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
  return createIntakeWorkspace({
    uri: file.name,
    width: dimensions.width,
    height: dimensions.height
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
  return createIntakeWorkspaceFromImageFile(file, { readImageDimensions: readBrowserImageDimensions });
}
