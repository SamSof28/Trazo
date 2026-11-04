export interface UploadObjectInput {
  path: string;
  body: Uint8Array;
  contentType: string;
}

/**
 * Minimal object storage port used by operational scripts (seed) to publish
 * catalog images. The HTTP layer never uploads files directly.
 */
export interface ObjectStorage {
  ensureBucket(): Promise<void>;
  upload(input: UploadObjectInput): Promise<void>;
  publicUrl(path: string): string;
}
