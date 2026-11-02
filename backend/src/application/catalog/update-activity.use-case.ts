import { NotFoundError } from '../../domain/shared/app-error.js';
import type { Activity, UpdateActivityData } from '../../domain/catalog/activity.js';
import type { Clock } from '../../domain/identity/ports.js';
import type { ActivityRepository, DestinationRepository } from '../../domain/catalog/ports.js';
import { assertActiveDestination } from './assert-destination.js';

export class UpdateActivityUseCase {
  constructor(
    private readonly activities: ActivityRepository,
    private readonly destinations: DestinationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(id: string, changes: UpdateActivityData): Promise<Activity> {
    const current = await this.activities.findById(id);
    if (!current) throw new NotFoundError('Actividad');

    if (changes.destinationId !== undefined && changes.destinationId !== current.destinationId) {
      await assertActiveDestination(this.destinations, changes.destinationId);
    }

    const updated = await this.activities.update(current.withChanges(changes, this.clock.now()));
    if (!updated) throw new NotFoundError('Actividad');
    return updated;
  }
}
