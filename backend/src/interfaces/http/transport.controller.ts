import type { Request, Response } from 'express';
import type {
  CreateTransportOptionInput,
  ListTransportQuery,
  Paginated,
  TransportOptionDto,
  TransportOptionResponse,
  UpdateTransportOptionInput,
} from '@trazo/shared';
import type { CreateTransportOptionUseCase } from '../../application/catalog/create-transport-option.use-case.js';
import type { DeactivateTransportOptionUseCase } from '../../application/catalog/deactivate-transport-option.use-case.js';
import type { ListTransportOptionsUseCase } from '../../application/catalog/list-transport-options.use-case.js';
import type { UpdateTransportOptionUseCase } from '../../application/catalog/update-transport-option.use-case.js';
import { toTransportOptionDto } from '../../application/catalog/presenters.js';

export class TransportController {
  constructor(
    private readonly listUseCase: ListTransportOptionsUseCase,
    private readonly createUseCase: CreateTransportOptionUseCase,
    private readonly updateUseCase: UpdateTransportOptionUseCase,
    private readonly deactivateUseCase: DeactivateTransportOptionUseCase,
  ) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.validatedQuery as ListTransportQuery;
    const result = await this.listUseCase.execute({
      originDestinationId: query.originId,
      destinationId: query.destinationId,
      mode: query.mode,
      page: query.page,
      pageSize: query.pageSize,
    });

    const body: Paginated<TransportOptionDto> = {
      items: result.items.map(toTransportOptionDto),
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    };
    res.json(body);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const input = req.body as CreateTransportOptionInput;
    const option = await this.createUseCase.execute(input);
    const body: TransportOptionResponse = { transportOption: toTransportOptionDto(option) };
    res.status(201).json(body);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.validatedParams as { id: string };
    const input = req.body as UpdateTransportOptionInput;
    const option = await this.updateUseCase.execute(id, input);
    const body: TransportOptionResponse = { transportOption: toTransportOptionDto(option) };
    res.json(body);
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.validatedParams as { id: string };
    await this.deactivateUseCase.execute(id);
    res.status(204).end();
  };
}
