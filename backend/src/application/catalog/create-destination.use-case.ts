import { randomUUID } from 'node:crypto';
import { Destination, type CreateDestinationData } from '../../domain/catalog/destination.js';
import type { Clock } from '../../domain/identity/ports.js';
import type { DestinationRepository } from '../../domain/catalog/ports.js';

export type CreateDestinationCommand = Omit<CreateDestinationData, 'id' | 'now'>;

export class CreateDestinationUseCase {
  constructor(
    private readonly destinations: DestinationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateDestinationCommand): Promise<Destination> {
    const destination = Destination.create({
      ...input,
      id: randomUUID(),
      now: this.clock.now(),
    });
    return this.destinations.create(destination);
  }
}
