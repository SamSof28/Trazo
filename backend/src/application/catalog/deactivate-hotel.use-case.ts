import { NotFoundError } from '../../domain/shared/app-error.js';
import type { Clock } from '../../domain/identity/ports.js';
import type { HotelRepository } from '../../domain/catalog/ports.js';

export class DeactivateHotelUseCase {
  constructor(
    private readonly hotels: HotelRepository,
    private readonly clock: Clock,
  ) {}

  async execute(id: string): Promise<void> {
    const current = await this.hotels.findById(id);
    if (!current) throw new NotFoundError('Hotel');

    const updated = await this.hotels.update(current.deactivate(this.clock.now()));
    if (!updated) throw new NotFoundError('Hotel');
  }
}
