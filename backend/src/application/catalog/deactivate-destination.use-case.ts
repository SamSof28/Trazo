import { NotFoundError } from '../../domain/shared/app-error.js';
import type { Clock } from '../../domain/identity/ports.js';
import type { DestinationRepository } from '../../domain/catalog/ports.js';

export class DeactivateDestinationUseCase {
  constructor(
    private readonly destinations: DestinationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(id: string): Promise<void> {
    const current = await this.destinations.findById(id);
    if (!current) throw new NotFoundError('Destino');

    const updated = await this.destinations.update(current.deactivate(this.clock.now()));
    if (!updated) throw new NotFoundError('Destino');
  }
}
