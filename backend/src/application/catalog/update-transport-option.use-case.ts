import { NotFoundError } from '../../domain/shared/app-error.js';
import type {
  TransportOption,
  UpdateTransportOptionData,
} from '../../domain/catalog/transport-option.js';
import type { Clock } from '../../domain/identity/ports.js';
import type {
  DestinationRepository,
  TransportOptionRepository,
} from '../../domain/catalog/ports.js';
import { assertActiveDestination } from './assert-destination.js';

export class UpdateTransportOptionUseCase {
  constructor(
    private readonly transportOptions: TransportOptionRepository,
    private readonly destinations: DestinationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(id: string, changes: UpdateTransportOptionData): Promise<TransportOption> {
    const current = await this.transportOptions.findById(id);
    if (!current) throw new NotFoundError('Opción de transporte');

    if (changes.destinationId !== undefined && changes.destinationId !== current.destinationId) {
      await assertActiveDestination(this.destinations, changes.destinationId);
    }
    if (
      changes.originDestinationId !== undefined &&
      changes.originDestinationId !== null &&
      changes.originDestinationId !== current.originDestinationId
    ) {
      await assertActiveDestination(this.destinations, changes.originDestinationId);
    }

    const updated = await this.transportOptions.update(
      current.withChanges(changes, this.clock.now()),
    );
    if (!updated) throw new NotFoundError('Opción de transporte');
    return updated;
  }
}
