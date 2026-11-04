import type { Request, Response } from 'express';
import type {
  AnswerTripRequestPayload,
  CreateTripRequestInput,
  ListTripRequestsQuery,
  Paginated,
  PlanGenerationAccepted,
  TripRequestDto,
  TripRequestResponse,
} from '@trazo/shared';
import type { PlanGenerationRunner } from '../../domain/ai/ports.js';
import type { AnswerTripRequestUseCase } from '../../application/intake/answer-trip-request.use-case.js';
import type { CreateTripRequestUseCase } from '../../application/intake/create-trip-request.use-case.js';
import type { GetTripRequestUseCase } from '../../application/intake/get-trip-request.use-case.js';
import type { ListTripRequestsUseCase } from '../../application/intake/list-trip-requests.use-case.js';
import type { StartGenerationUseCase } from '../../application/planning/start-generation.use-case.js';
import { toTripRequestDto } from '../../application/intake/presenter.js';
import { actorOf } from './actor.js';

export class TripRequestController {
  constructor(
    private readonly createUseCase: CreateTripRequestUseCase,
    private readonly getUseCase: GetTripRequestUseCase,
    private readonly listUseCase: ListTripRequestsUseCase,
    private readonly answerUseCase: AnswerTripRequestUseCase,
    private readonly startGenerationUseCase: StartGenerationUseCase,
    private readonly runner: PlanGenerationRunner,
  ) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const input = req.body as CreateTripRequestInput;
    const view = await this.createUseCase.execute({
      prompt: input.prompt,
      actor: actorOf(req),
    });
    const body: TripRequestResponse = {
      tripRequest: toTripRequestDto(view.tripRequest, view.destination, view.questions),
    };
    res.status(201).json(body);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.validatedParams as { id: string };
    const view = await this.getUseCase.execute(id, actorOf(req));
    const body: TripRequestResponse = {
      tripRequest: toTripRequestDto(view.tripRequest, view.destination, view.questions),
    };
    res.json(body);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.validatedQuery as ListTripRequestsQuery;
    const result = await this.listUseCase.execute({
      actor: actorOf(req),
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });
    const body: Paginated<TripRequestDto> = {
      items: result.items.map((view) =>
        toTripRequestDto(view.tripRequest, view.destination, view.questions),
      ),
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    };
    res.json(body);
  };

  answer = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.validatedParams as { id: string };
    const input = req.body as AnswerTripRequestPayload;
    const view = await this.answerUseCase.execute(id, actorOf(req), input.answers);
    const body: TripRequestResponse = {
      tripRequest: toTripRequestDto(view.tripRequest, view.destination, view.questions),
    };
    res.json(body);
  };

  generate = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.validatedParams as { id: string };
    const { job } = await this.startGenerationUseCase.execute(id, actorOf(req));
    this.runner.run(job.id);
    const body: PlanGenerationAccepted = {
      tripRequestId: id,
      jobId: job.id,
      status: 'GENERATING',
      pollAfterMs: 1500,
    };
    res.status(202).json(body);
  };
}
