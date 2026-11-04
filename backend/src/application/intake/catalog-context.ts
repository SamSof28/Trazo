import type { Destination } from '../../domain/catalog/destination.js';
import type { DestinationRepository } from '../../domain/catalog/ports.js';

/**
 * Loads every active destination so the parser and question builder always see the full catalog,
 * not just the first page. The catalog is small; this keeps matching deterministic.
 */
export async function loadActiveDestinations(
  destinations: DestinationRepository,
): Promise<Destination[]> {
  const all: Destination[] = [];
  let page = 1;

  for (;;) {
    const result = await destinations.search({ page, pageSize: 100 });
    all.push(...result.items);
    if (result.items.length === 0 || all.length >= result.total) break;
    page += 1;
  }

  return all;
}
