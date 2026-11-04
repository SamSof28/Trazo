import { describe, expect, it, vi } from 'vitest';
import { SupabaseStorage } from '../src/infrastructure/storage/supabase-storage.js';

interface Call {
  url: string;
  init: Parameters<typeof fetch>[1] | undefined;
}

function makeFetch(responses: Response[]): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(
    async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      calls.push({ url: String(input), init });
      const response = responses.shift();
      if (!response) throw new Error('Unexpected fetch call');
      return response;
    },
  );
  return { fetch: fetchImpl as unknown as typeof fetch, calls };
}

describe('SupabaseStorage', () => {
  it('creates a public bucket and uploads an object with the service role', async () => {
    const { fetch, calls } = makeFetch([
      new Response('', { status: 200 }),
      new Response('', { status: 200 }),
    ]);
    const storage = new SupabaseStorage({
      url: 'https://project.supabase.co/',
      serviceRoleKey: 'service-role-key',
      bucket: 'catalog',
      fetch,
    });

    await storage.upload({
      path: 'hotels/cartagena/hotel-casa-san-agustin.webp',
      body: new Uint8Array([1, 2, 3]),
      contentType: 'image/webp',
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toBe('https://project.supabase.co/storage/v1/bucket');
    expect(JSON.parse(String(calls[0]?.init?.body))).toMatchObject({
      id: 'catalog',
      name: 'catalog',
      public: true,
    });
    expect(calls[0]?.init?.headers).toMatchObject({
      Authorization: 'Bearer service-role-key',
      apikey: 'service-role-key',
    });

    expect(calls[1]?.url).toBe(
      'https://project.supabase.co/storage/v1/object/catalog/hotels/cartagena/hotel-casa-san-agustin.webp',
    );
    expect(calls[1]?.init?.method).toBe('POST');
    expect(calls[1]?.init?.headers).toMatchObject({
      'Content-Type': 'image/webp',
      'x-upsert': 'true',
      'cache-control': 'public, max-age=31536000, immutable',
    });
  });

  it('accepts an already existing bucket and only creates it once', async () => {
    const { fetch, calls } = makeFetch([
      new Response('duplicate key value violates unique constraint', { status: 409 }),
      new Response('', { status: 200 }),
      new Response('', { status: 200 }),
    ]);
    const storage = new SupabaseStorage({
      url: 'https://project.supabase.co',
      serviceRoleKey: 'service-role-key',
      bucket: 'catalog',
      fetch,
    });

    await storage.upload({ path: 'destinations/cartagena.webp', body: new Uint8Array(), contentType: 'image/webp' });
    await storage.upload({ path: 'destinations/medellin.webp', body: new Uint8Array(), contentType: 'image/webp' });

    expect(calls.filter((call) => call.url.endsWith('/storage/v1/bucket'))).toHaveLength(1);
    expect(calls.filter((call) => call.url.includes('/storage/v1/object/'))).toHaveLength(2);
  });

  it('exposes the public URL and encodes each path segment', () => {
    const storage = new SupabaseStorage({
      url: 'https://project.supabase.co',
      serviceRoleKey: 'service-role-key',
      bucket: 'catalog',
      fetch: (async () => new Response('')) as typeof fetch,
    });

    expect(storage.publicUrl('activities/eje-cafetero/tour-de-cafe-en-finca.webp')).toBe(
      'https://project.supabase.co/storage/v1/object/public/catalog/activities/eje-cafetero/tour-de-cafe-en-finca.webp',
    );
    expect(storage.publicUrl('transport/san-andres/flight avianca.webp')).toBe(
      'https://project.supabase.co/storage/v1/object/public/catalog/transport/san-andres/flight%20avianca.webp',
    );
  });

  it('throws a StorageError with the provider status and detail', async () => {
    const { fetch } = makeFetch([
      new Response('', { status: 200 }),
      new Response('new row violates row-level security policy', { status: 403 }),
    ]);
    const storage = new SupabaseStorage({
      url: 'https://project.supabase.co',
      serviceRoleKey: 'service-role-key',
      bucket: 'catalog',
      fetch,
    });

    await expect(
      storage.upload({
        path: 'destinations/cartagena.webp',
        body: new Uint8Array(),
        contentType: 'image/webp',
      }),
    ).rejects.toMatchObject({
      name: 'StorageError',
      status: 403,
    });
  });
});
