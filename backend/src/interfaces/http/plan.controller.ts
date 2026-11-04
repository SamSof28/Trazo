import type { Request, Response } from 'express';
import type {
  AddPlanItemInput,
  ListPlansQuery,
  MovePlanItemInput,
  Paginated,
  PlanAlternativesQuery,
  PlanDto,
  PlanReportQuery,
  PlanResponse,
  ReplacePlanItemInput,
  UpdatePlanInput,
  UpdatePlanItemInput,
} from '@trazo/shared';
import type { AddPlanItemUseCase, MovePlanItemUseCase, RemovePlanItemUseCase, ReplacePlanItemUseCase, UpdatePlanItemUseCase } from '../../application/planning/plan-items.use-cases.js';
import type { ListPlanAlternativesUseCase } from '../../application/planning/plan-alternatives.use-case.js';
import type { ArchivePlanUseCase, DuplicatePlanUseCase, PublishPlanUseCase, SavePlanUseCase } from '../../application/planning/plan-lifecycle.use-cases.js';
import type { GetPlanReportUseCase } from '../../application/planning/plan-report.use-case.js';
import type { GetPlanUseCase } from '../../application/planning/get-plan.use-case.js';
import type { ListPlansUseCase } from '../../application/planning/list-plans.use-case.js';
import type { UpdatePlanUseCase } from '../../application/planning/update-plan.use-case.js';
import { reportToCsv, toPlanDto } from '../../application/planning/presenter.js';
import type { PlanView } from '../../application/planning/views.js';
import { renderPlanPdf } from '../../infrastructure/pdf/plan-pdf.js';
import { actorOf } from './actor.js';

function toResponse(view: PlanView): PlanResponse {
  return { plan: toPlanDto(view.plan, view.destination) };
}

export class PlanController {
  constructor(
    private readonly listUseCase: ListPlansUseCase,
    private readonly getUseCase: GetPlanUseCase,
    private readonly updateUseCase: UpdatePlanUseCase,
    private readonly addItemUseCase: AddPlanItemUseCase,
    private readonly replaceItemUseCase: ReplacePlanItemUseCase,
    private readonly updateItemUseCase: UpdatePlanItemUseCase,
    private readonly moveItemUseCase: MovePlanItemUseCase,
    private readonly removeItemUseCase: RemovePlanItemUseCase,
    private readonly saveUseCase: SavePlanUseCase,
    private readonly publishUseCase: PublishPlanUseCase,
    private readonly archiveUseCase: ArchivePlanUseCase,
    private readonly duplicateUseCase: DuplicatePlanUseCase,
    private readonly alternativesUseCase: ListPlanAlternativesUseCase,
    private readonly reportUseCase: GetPlanReportUseCase,
  ) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.validatedQuery as ListPlansQuery;
    const result = await this.listUseCase.execute({
      actor: actorOf(req),
      status: query.status,
      query: query.q,
      destinationId: query.destinationId,
      page: query.page,
      pageSize: query.pageSize,
    });
    const body: Paginated<PlanDto> = {
      items: result.items.map((view) => toPlanDto(view.plan, view.destination)),
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    };
    res.json(body);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.validatedParams as { id: string };
    const view = await this.getUseCase.execute(id, actorOf(req));
    res.json(toResponse(view));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.validatedParams as { id: string };
    const input = req.body as UpdatePlanInput;
    const view = await this.updateUseCase.execute(id, input, actorOf(req));
    res.json(toResponse(view));
  };

  addItem = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.validatedParams as { id: string };
    const input = req.body as AddPlanItemInput;
    const view = await this.addItemUseCase.execute(id, input, actorOf(req));
    res.status(201).json(toResponse(view));
  };

  replaceItem = async (req: Request, res: Response): Promise<void> => {
    const { id, itemId } = req.validatedParams as { id: string; itemId: string };
    const input = req.body as ReplacePlanItemInput;
    const view = await this.replaceItemUseCase.execute(id, itemId, input, actorOf(req));
    res.json(toResponse(view));
  };

  updateItem = async (req: Request, res: Response): Promise<void> => {
    const { id, itemId } = req.validatedParams as { id: string; itemId: string };
    const input = req.body as UpdatePlanItemInput;
    const view = await this.updateItemUseCase.execute(id, itemId, input, actorOf(req));
    res.json(toResponse(view));
  };

  moveItem = async (req: Request, res: Response): Promise<void> => {
    const { id, itemId } = req.validatedParams as { id: string; itemId: string };
    const input = req.body as MovePlanItemInput;
    const view = await this.moveItemUseCase.execute(id, itemId, input, actorOf(req));
    res.json(toResponse(view));
  };

  removeItem = async (req: Request, res: Response): Promise<void> => {
    const { id, itemId } = req.validatedParams as { id: string; itemId: string };
    const view = await this.removeItemUseCase.execute(id, itemId, actorOf(req));
    res.json(toResponse(view));
  };

  save = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.validatedParams as { id: string };
    const view = await this.saveUseCase.execute(id, actorOf(req));
    res.json(toResponse(view));
  };

  publish = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.validatedParams as { id: string };
    const view = await this.publishUseCase.execute(id, actorOf(req));
    res.json(toResponse(view));
  };

  archive = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.validatedParams as { id: string };
    const view = await this.archiveUseCase.execute(id, actorOf(req));
    res.json(toResponse(view));
  };

  duplicate = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.validatedParams as { id: string };
    const view = await this.duplicateUseCase.execute(id, actorOf(req));
    res.status(201).json(toResponse(view));
  };

  alternatives = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.validatedParams as { id: string };
    const query = req.validatedQuery as PlanAlternativesQuery;
    const body = await this.alternativesUseCase.execute(id, query.itemId, actorOf(req));
    res.json(body);
  };

  report = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.validatedParams as { id: string };
    const query = req.validatedQuery as PlanReportQuery;
    const report = await this.reportUseCase.execute(id, actorOf(req));

    if (query.format === 'csv') {
      res
        .status(200)
        .type('text/csv; charset=utf-8')
        .setHeader('Content-Disposition', `attachment; filename="plan-${id}.csv"`)
        .send(reportToCsv(report));
      return;
    }

    res.json(report);
  };

  pdf = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.validatedParams as { id: string };
    const report = await this.reportUseCase.execute(id, actorOf(req));
    res
      .status(200)
      .type('application/pdf')
      .setHeader('Content-Disposition', `attachment; filename="plan-${id}.pdf"`)
      .send(renderPlanPdf(report));
  };
}
