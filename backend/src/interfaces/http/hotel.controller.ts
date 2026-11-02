import type { Request, Response } from 'express';
import type {
  CreateHotelInput,
  HotelDto,
  HotelResponse,
  ListHotelsQuery,
  Paginated,
  UpdateHotelInput,
} from '@turiviaje/shared';
import type { CreateHotelUseCase } from '../../application/catalog/create-hotel.use-case.js';
import type { DeactivateHotelUseCase } from '../../application/catalog/deactivate-hotel.use-case.js';
import type { ListHotelsUseCase } from '../../application/catalog/list-hotels.use-case.js';
import type { UpdateHotelUseCase } from '../../application/catalog/update-hotel.use-case.js';
import { toHotelDto } from '../../application/catalog/presenters.js';

export class HotelController {
  constructor(
    private readonly listUseCase: ListHotelsUseCase,
    private readonly createUseCase: CreateHotelUseCase,
    private readonly updateUseCase: UpdateHotelUseCase,
    private readonly deactivateUseCase: DeactivateHotelUseCase,
  ) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.validatedQuery as ListHotelsQuery;
    const result = await this.listUseCase.execute({
      destinationId: query.destinationId,
      maxPriceMinor: query.maxPriceMinor,
      currency: query.currency,
      page: query.page,
      pageSize: query.pageSize,
    });

    const body: Paginated<HotelDto> = {
      items: result.items.map(toHotelDto),
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    };
    res.json(body);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const input = req.body as CreateHotelInput;
    const hotel = await this.createUseCase.execute(input);
    const body: HotelResponse = { hotel: toHotelDto(hotel) };
    res.status(201).json(body);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.validatedParams as { id: string };
    const input = req.body as UpdateHotelInput;
    const hotel = await this.updateUseCase.execute(id, input);
    const body: HotelResponse = { hotel: toHotelDto(hotel) };
    res.json(body);
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.validatedParams as { id: string };
    await this.deactivateUseCase.execute(id);
    res.status(204).end();
  };
}
