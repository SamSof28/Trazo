import type { ObjectStorage, UploadObjectInput } from '../../domain/storage/ports.js';

export interface SupabaseStorageOptions {
  url: string;
  serviceRoleKey: string;
  bucket: string;
  fetch?: typeof fetch;
}

export class StorageError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

function encodePath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function readError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.trim().slice(0, 300);
  } catch {
    return '';
  }
}

/**
 * Supabase Storage REST adapter. Uses the service_role key, so it must only be
 * constructed in the backend (seed/operational jobs), never in the frontend.
 */
export class SupabaseStorage implements ObjectStorage {
  private readonly baseUrl: string;
  private readonly bucket: string;
  private readonly serviceRoleKey: string;
  private readonly fetchImpl: typeof fetch;
  private bucketReady = false;

  constructor(options: SupabaseStorageOptions) {
    this.baseUrl = options.url.replace(/\/+$/, '');
    this.bucket = options.bucket;
    this.serviceRoleKey = options.serviceRoleKey;
    this.fetchImpl = options.fetch ?? fetch;
  }

  async ensureBucket(): Promise<void> {
    if (this.bucketReady) return;

    const response = await this.fetchImpl(`${this.baseUrl}/storage/v1/bucket`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        id: this.bucket,
        name: this.bucket,
        public: true,
        file_size_limit: null,
        allowed_mime_types: ['image/webp', 'image/jpeg', 'image/png'],
      }),
    });

    if (!response.ok) {
      const detail = await readError(response);
      const alreadyExists = response.status === 409 || /already exists/i.test(detail);
      if (!alreadyExists) {
        throw new StorageError(
          `No se pudo crear el bucket "${this.bucket}" (${response.status}): ${detail}`,
          response.status,
        );
      }
    }

    this.bucketReady = true;
  }

  async upload(input: UploadObjectInput): Promise<void> {
    await this.ensureBucket();

    const objectPath = encodePath(input.path);
    const response = await this.fetchImpl(
      `${this.baseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}/${objectPath}`,
      {
        method: 'POST',
        headers: this.headers({
          'Content-Type': input.contentType,
          'cache-control': 'public, max-age=31536000, immutable',
          'x-upsert': 'true',
        }),
        body: input.body as unknown as NonNullable<Parameters<typeof fetch>[1]>['body'],
      },
    );

    if (!response.ok) {
      const detail = await readError(response);
      throw new StorageError(
        `No se pudo subir "${input.path}" (${response.status}): ${detail}`,
        response.status,
      );
    }
  }

  publicUrl(path: string): string {
    return `${this.baseUrl}/storage/v1/object/public/${encodeURIComponent(this.bucket)}/${encodePath(path)}`;
  }

  private headers(extra: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${this.serviceRoleKey}`,
      apikey: this.serviceRoleKey,
      ...extra,
    };
  }
}
