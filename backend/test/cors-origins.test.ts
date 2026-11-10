import { describe, expect, it } from 'vitest';
import { normalizeCorsOrigins } from '../src/config/cors-origins.js';

describe('normalizeCorsOrigins', () => {
  it('trims whitespace and removes trailing slashes', () => {
    expect(
      normalizeCorsOrigins(' https://trazoai.vercel.app/ , http://localhost:5173/ '),
    ).toEqual(['https://trazoai.vercel.app', 'http://localhost:5173']);
  });

  it('drops empty entries', () => {
    expect(normalizeCorsOrigins(' , https://example.com/ ')).toEqual(['https://example.com']);
  });
});
