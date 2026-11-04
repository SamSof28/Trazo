import type { Request, Response } from 'express';
import type {
  AnswerTripRequestPayload,
  CreateTripRequestInput,
  ListTripRequestsQuery,
  Paginated,
  TripRequestDto,
  TripRequestResponse,
} from '@turiviaje/shared';
import type { AccessTokenPayload } from '../../domain/identity/ports.js';
import { UnauthenticatedError } from '../../domain/shared/app-error.js';
import type { AnswerTripRequestUseCase } from '../../application/intake/answer-trip-request.use-case.js';
import type { CreateTripRequestUseCase } from '../../application/intake/create-trip-request.use-case.js';
import type { GetTripRequestUseCase } from '../../application/intake/get-trip-request.use-case.js';
import type { ListTripRequestsUseCase } from '../../application/intake/list-trip-requests.use-case.js';
import { toTripRequestDto } from '../../application/intake/presenter.js';

function actorOf(req: Request): AccessTokenPayload {
  if (!req.auth) throw new UnauthenticatedError();
  return req.auth;
}

export class TripRequestController {
  constructor(
    private readonly createUseCase: CreateTripRequestUseCase,
    private readonly getUseCase: GetTripRequestUseCase,
    private readonly listUseCase: ListTripRequestsUseCase,
    private readonly answerUseCase: AnswerTripRequestUseCase,
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
}
