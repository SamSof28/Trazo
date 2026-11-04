import type { AccessTokenPayload } from '../../domain/identity/ports.js';
import type { PlanRepository } from '../../domain/planning/ports.js';
import type { Plan } from '../../domain/planning/plan.js';
import { NotFoundError } from '../../domain/shared/app-error.js';

/** Ownership is enforced in the use case. A foreign resource is reported as 404, never 403. */
export function assertPlanAccess(plan: Plan, actor: AccessTokenPayload): void {
  if (actor.role !== 'ADMIN' && plan.advisorId !== actor.userId) {
    throw new NotFoundError('Plan');
  }
}

export async function loadPlanForActor(
  plans: PlanRepository,
  id: string,
  actor: AccessTokenPayload,
): Promise<Plan> {
  const plan = await plans.findById(id);
  if (!plan || plan.deletedAt !== null) {
    throw new NotFoundError('Plan');
  }
  assertPlanAccess(plan, actor);
  return plan;
}
