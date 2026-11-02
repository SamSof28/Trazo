import type { Hotel } from '../../domain/catalog/hotel.js';
import type { HotelRepository, HotelSearchCriteria, Page } from '../../domain/catalog/ports.js';

export class ListHotelsUseCase {
  constructor(private readonly hotels: HotelRepository) {}

  async execute(criteria: HotelSearchCriteria): Promise<Page<Hotel>> {
    return this.hotels.search(criteria);
  }
}
