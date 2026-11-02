import type { Request, Response } from 'express';
import type {
  CreateDestinationInput,
  DestinationDto,
  DestinationResponse,
  ListDestinationsQuery,
  Paginated,
  UpdateDestinationInput,
} from '@turiviaje/shared';
import type { CreateDestinationUseCase } from '../../application/catalog/create-destination.use-case.js';
import type { DeactivateDestinationUseCase } from '../../application/catalog/deactivate-destination.use-case.js';
import type { GetDestinationUseCase } from '../../application/catalog/get-destination.use-case.js';
import type { ListDestinationsUseCase } from '../../application/catalog/list-destinations.use-case.js';
import type { UpdateDestinationUseCase } from '../../application/catalog/update-destination.use-case.js';
import { toDestinationDto } from '../../application/catalog/presenters.js';

export class DestinationController {
  constructor(
    private readonly listUseCase: ListDestinationsUseCase,
    private readonly getUseCase: GetDestinationUseCase,
    private readonly createUseCase: CreateDestinationUseCase,
    private readonly updateUseCase: UpdateDestinationUseCase,
    private readonly deactivateUseCase: DeactivateDestinationUseCase,
  ) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.validatedQuery as ListDestinationsQuery;
    const result = await this.listUseCase.execute({
      query: query.q,
      country: query.country,
      featured: query.featured,
      page: query.page,
      pageSize: query.pageSize,
    });

    const body: Paginated<DestinationDto> = {
      items: result.items.map(toDestinationDto),
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    };
    res.json(body);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.validatedParams as { id: string };
    const destination = await this.getUseCase.execute(id);
    const body: DestinationResponse = { destination: toDestinationDto(destination) };
    res.json(body);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const input = req.body as CreateDestinationInput;
    const destination = await this.createUseCase.execute(input);
    const body: DestinationResponse = { destination: toDestinationDto(destination) };
    res.status(201).json(body);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.validatedParams as { id: string };
    const input = req.body as UpdateDestinationInput;
    const destination = await this.updateUseCase.execute(id, input);
    const body: DestinationResponse = { destination: toDestinationDto(destination) };
    res.json(body);
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.validatedParams as { id: string };
    await this.deactivateUseCase.execute(id);
    res.status(204).end();
  };
}
