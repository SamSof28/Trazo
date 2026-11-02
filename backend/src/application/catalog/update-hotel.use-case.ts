import { NotFoundError } from '../../domain/shared/app-error.js';
import type { Hotel, UpdateHotelData } from '../../domain/catalog/hotel.js';
import type { Clock } from '../../domain/identity/ports.js';
import type { DestinationRepository, HotelRepository } from '../../domain/catalog/ports.js';
import { assertActiveDestination } from './assert-destination.js';

export class UpdateHotelUseCase {
  constructor(
    private readonly hotels: HotelRepository,
    private readonly destinations: DestinationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(id: string, changes: UpdateHotelData): Promise<Hotel> {
    const current = await this.hotels.findById(id);
    if (!current) throw new NotFoundError('Hotel');

    if (changes.destinationId !== undefined && changes.destinationId !== current.destinationId) {
      await assertActiveDestination(this.destinations, changes.destinationId);
    }

    const updated = await this.hotels.update(current.withChanges(changes, this.clock.now()));
    if (!updated) throw new NotFoundError('Hotel');
    return updated;
  }
}
