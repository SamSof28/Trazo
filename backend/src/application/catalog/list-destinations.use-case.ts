import type { Destination } from '../../domain/catalog/destination.js';
import type {
  DestinationRepository,
  DestinationSearchCriteria,
  Page,
} from '../../domain/catalog/ports.js';

export class ListDestinationsUseCase {
  constructor(private readonly destinations: DestinationRepository) {}

  async execute(criteria: DestinationSearchCriteria): Promise<Page<Destination>> {
    return this.destinations.search(criteria);
  }
}
