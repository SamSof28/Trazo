import { NotFoundError } from '../../domain/shared/app-error.js';
import type { Destination } from '../../domain/catalog/destination.js';
import type { DestinationRepository } from '../../domain/catalog/ports.js';

export class GetDestinationUseCase {
  constructor(private readonly destinations: DestinationRepository) {}

  async execute(id: string): Promise<Destination> {
    const destination = await this.destinations.findById(id);
    if (!destination || !destination.isActive) {
      throw new NotFoundError('Destino');
    }
    return destination;
  }
}
