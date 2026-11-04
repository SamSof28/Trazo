import type { Request, Response } from 'express';
import type {
  ActivityDto,
  ActivityResponse,
  CreateActivityInput,
  ListActivitiesQuery,
  Paginated,
  UpdateActivityInput,
} from '@trazo/shared';
import type { CreateActivityUseCase } from '../../application/catalog/create-activity.use-case.js';
import type { DeactivateActivityUseCase } from '../../application/catalog/deactivate-activity.use-case.js';
import type { ListActivitiesUseCase } from '../../application/catalog/list-activities.use-case.js';
import type { UpdateActivityUseCase } from '../../application/catalog/update-activity.use-case.js';
import { toActivityDto } from '../../application/catalog/presenters.js';

export class ActivityController {
  constructor(
    private readonly listUseCase: ListActivitiesUseCase,
    private readonly createUseCase: CreateActivityUseCase,
    private readonly updateUseCase: UpdateActivityUseCase,
    private readonly deactivateUseCase: DeactivateActivityUseCase,
  ) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.validatedQuery as ListActivitiesQuery;
    const result = await this.listUseCase.execute({
      destinationId: query.destinationId,
      interest: query.interest,
      intensity: query.intensity,
      page: query.page,
      pageSize: query.pageSize,
    });

    const body: Paginated<ActivityDto> = {
      items: result.items.map(toActivityDto),
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    };
    res.json(body);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const input = req.body as CreateActivityInput;
    const activity = await this.createUseCase.execute(input);
    const body: ActivityResponse = { activity: toActivityDto(activity) };
    res.status(201).json(body);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.validatedParams as { id: string };
    const input = req.body as UpdateActivityInput;
    const activity = await this.updateUseCase.execute(id, input);
    const body: ActivityResponse = { activity: toActivityDto(activity) };
    res.json(body);
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.validatedParams as { id: string };
    await this.deactivateUseCase.execute(id);
    res.status(204).end();
  };
}
