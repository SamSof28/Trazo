import { randomUUID } from 'node:crypto';
import { Hotel, type CreateHotelData } from '../../domain/catalog/hotel.js';
import type { Clock } from '../../domain/identity/ports.js';
import type { DestinationRepository, HotelRepository } from '../../domain/catalog/ports.js';
import { assertActiveDestination } from './assert-destination.js';

export type CreateHotelCommand = Omit<CreateHotelData, 'id' | 'now'>;

export class CreateHotelUseCase {
  constructor(
    private readonly hotels: HotelRepository,
    private readonly destinations: DestinationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateHotelCommand): Promise<Hotel> {
    await assertActiveDestination(this.destinations, input.destinationId);

    const hotel = Hotel.create({
      ...input,
      id: randomUUID(),
      now: this.clock.now(),
    });
    return this.hotels.create(hotel);
  }
}
