import type { TransportOption } from '../../domain/catalog/transport-option.js';
import type {
  Page,
  TransportOptionRepository,
  TransportSearchCriteria,
} from '../../domain/catalog/ports.js';

export class ListTransportOptionsUseCase {
  constructor(private readonly transportOptions: TransportOptionRepository) {}

  async execute(criteria: TransportSearchCriteria): Promise<Page<TransportOption>> {
    return this.transportOptions.search(criteria);
  }
}
