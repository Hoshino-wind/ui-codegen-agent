export interface BrowserDownloadArtifact {
  fileName: string;
  mimeType: string;
  contents: string | Uint8Array;
}

export interface BrowserDownloadEnvironment {
  document: Pick<Document, "createElement"> & {
    body: Pick<HTMLElement, "append">;
  };
  url: Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;
}

export interface BrowserDownloadResult {
  fileName: string;
  mimeType: string;
  size: number;
}

function binaryBlobPart(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function defaultEnvironment(): BrowserDownloadEnvironment {
  return {
    document,
    url: URL
  };
}

/**
 * Trigger a browser download through a real attached anchor. Some browser
 * surfaces ignore clicks on detached anchors, so keep this behavior centralized
 * instead of hand-rolling download code in React event handlers.
 */
export function triggerBrowserDownload(
  artifact: BrowserDownloadArtifact,
  environment: BrowserDownloadEnvironment = defaultEnvironment()
): BrowserDownloadResult {
  const contents = typeof artifact.contents === "string" ? artifact.contents : binaryBlobPart(artifact.contents);
  const blob = new Blob([contents], { type: artifact.mimeType });
  const url = environment.url.createObjectURL(blob);
  const anchor = environment.document.createElement("a");

  anchor.href = url;
  anchor.download = artifact.fileName;
  environment.document.body.append(anchor);
  anchor.click();
  anchor.remove();
  environment.url.revokeObjectURL(url);

  return {
    fileName: artifact.fileName,
    mimeType: artifact.mimeType,
    size: blob.size
  };
}
