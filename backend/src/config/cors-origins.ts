/**
 * CORS compares the browser's `Origin` header (scheme + host + port) exactly.
 * Normalize the comma-separated env var so a trailing slash does not silently
 * reject every request from that origin.
 */
export function normalizeCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}
