import { NotFoundError } from '../../domain/shared/app-error.js';
import type { Clock } from '../../domain/identity/ports.js';
import type { TransportOptionRepository } from '../../domain/catalog/ports.js';

export class DeactivateTransportOptionUseCase {
  constructor(
    private readonly transportOptions: TransportOptionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(id: string): Promise<void> {
    const current = await this.transportOptions.findById(id);
    if (!current) throw new NotFoundError('Opción de transporte');

    const updated = await this.transportOptions.update(current.deactivate(this.clock.now()));
    if (!updated) throw new NotFoundError('Opción de transporte');
  }
}
