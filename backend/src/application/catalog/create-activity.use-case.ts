import { randomUUID } from 'node:crypto';
import { Activity, type CreateActivityData } from '../../domain/catalog/activity.js';
import type { Clock } from '../../domain/identity/ports.js';
import type { ActivityRepository, DestinationRepository } from '../../domain/catalog/ports.js';
import { assertActiveDestination } from './assert-destination.js';

export type CreateActivityCommand = Omit<CreateActivityData, 'id' | 'now'>;

export class CreateActivityUseCase {
  constructor(
    private readonly activities: ActivityRepository,
    private readonly destinations: DestinationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateActivityCommand): Promise<Activity> {
    await assertActiveDestination(this.destinations, input.destinationId);

    const activity = Activity.create({
      ...input,
      id: randomUUID(),
      now: this.clock.now(),
    });
    return this.activities.create(activity);
  }
}
