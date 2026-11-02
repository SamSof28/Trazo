import { randomUUID } from 'node:crypto';
import {
  TransportOption,
  type CreateTransportOptionData,
} from '../../domain/catalog/transport-option.js';
import type { Clock } from '../../domain/identity/ports.js';
import type {
  DestinationRepository,
  TransportOptionRepository,
} from '../../domain/catalog/ports.js';
import { assertActiveDestination } from './assert-destination.js';

export type CreateTransportOptionCommand = Omit<CreateTransportOptionData, 'id' | 'now'>;

export class CreateTransportOptionUseCase {
  constructor(
    private readonly transportOptions: TransportOptionRepository,
    private readonly destinations: DestinationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateTransportOptionCommand): Promise<TransportOption> {
    await assertActiveDestination(this.destinations, input.destinationId);
    if (input.originDestinationId) {
      await assertActiveDestination(this.destinations, input.originDestinationId);
    }

    const option = TransportOption.create({
      ...input,
      id: randomUUID(),
      now: this.clock.now(),
    });
    return this.transportOptions.create(option);
  }
}
