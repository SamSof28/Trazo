import { NotFoundError } from '../../domain/shared/app-error.js';
import type { Clock } from '../../domain/identity/ports.js';
import type { ActivityRepository } from '../../domain/catalog/ports.js';

export class DeactivateActivityUseCase {
  constructor(
    private readonly activities: ActivityRepository,
    private readonly clock: Clock,
  ) {}

  async execute(id: string): Promise<void> {
    const current = await this.activities.findById(id);
    if (!current) throw new NotFoundError('Actividad');

    const updated = await this.activities.update(current.deactivate(this.clock.now()));
    if (!updated) throw new NotFoundError('Actividad');
  }
}
